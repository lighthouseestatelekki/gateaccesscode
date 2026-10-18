-- 15) Who is inside the estate now (Estate Manager only) and overstay alerts to the Estate Manager.
-- Also: the gate check now respects "Sign out everywhere" for guards. Run after 14.

-- ---------- the gate check (only change: guard check uses auth_role) ----------
create or replace function public.verify_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_guard public.profiles; v_code public.access_codes; v_found boolean := false;
  v_last text; v_dir text; v_result text; v_reason text; v_job text;
  v_now timestamptz := now(); v_hour int; v_night boolean;
begin
  -- auth_role() also honours "Sign out everywhere", so a signed-out guard phone stops working at once.
  if public.auth_role() is distinct from 'guard' then raise exception 'Only active guards can verify codes'; end if;
  select * into v_guard from public.profiles where id = auth.uid();

  v_hour := extract(hour from (v_now at time zone 'Africa/Lagos'))::int;
  v_night := (v_hour >= 22 or v_hour < 5);

  select * into v_code from public.access_codes where code = trim(coalesce(p_code, '')) for update;
  v_found := found;
  if v_found then
    select direction into v_last from public.gate_logs
     where code_id = v_code.id and result = 'access' order by scanned_at desc limit 1;
  end if;

  if not v_found then
    v_result := 'denied'; v_reason := 'Code not recognised';
  elsif not v_code.active then
    v_result := 'denied'; v_reason := 'Code has been switched off';
  elsif v_code.type = 'employee' then
    select job_title into v_job from public.employees where id = v_code.employee_id;
    -- someone already inside may always leave, even after their hours
    if v_last = 'in' or public.employee_on_duty(v_code, v_now) then
      v_result := 'access'; v_reason := null;
    else
      v_result := 'denied'; v_reason := 'Outside their working days or hours';
    end if;
  elsif v_code.type in ('guest', 'long_stay') then
    if v_code.type = 'guest' and v_code.used_at is not null then
      v_result := 'expired'; v_reason := 'Guest code already used';
    elsif v_now < v_code.valid_from then
      v_result := 'denied'; v_reason := 'Code is not valid yet';
    elsif v_code.valid_to is not null and v_now > v_code.valid_to then
      v_result := 'expired'; v_reason := 'Code has expired';
    else
      v_result := 'access'; v_reason := null;
    end if;
  else
    v_result := 'denied'; v_reason := 'Code type not supported';
  end if;

  if v_result = 'access' then
    v_dir := case when v_last = 'in' then 'out' else 'in' end;
    if v_code.type = 'guest' and v_dir = 'out' then
      update public.access_codes set used_at = v_now where id = v_code.id;
    end if;
  end if;

  insert into public.gate_logs (code_id, attempted_code, gate, direction, result, reason, guard_id, scanned_at, night_access)
  values (case when v_found then v_code.id else null end, left(coalesce(p_code, ''), 20), v_guard.assigned_gate,
          v_dir, v_result, v_reason, v_guard.id, v_now, v_night);

  return jsonb_build_object(
    'result', v_result, 'direction', v_dir, 'reason', v_reason,
    'type', case when v_found then v_code.type else null end,
    'house', case when v_found then v_code.house_number else null end,
    'unit', case when v_found then v_code.house_unit else null end,
    'holder', case when v_found then v_code.holder_name else null end,
    'job_title', v_job,
    'valid_to', case when v_found then v_code.valid_to else null end,
    'gate', v_guard.assigned_gate, 'night_access', v_night);
end; $$;

-- ---------- who is inside now ----------
-- Everyone whose last gate scan was IN (visitors, deliveries, long stay and staff).
-- Overstays (code ended, still inside) come first.
create or replace function public.inside_now()
returns table (code_id uuid, holder text, type text, house_number text, house_unit text,
               entered_at timestamptz, valid_to timestamptz, overstay boolean, job_title text)
language sql security definer set search_path = public stable as $$
  with last as (
    select distinct on (g.code_id) g.code_id, g.direction, g.scanned_at
      from public.gate_logs g
     where g.result = 'access' and g.code_id is not null and g.scanned_at > now() - interval '45 days'
     order by g.code_id, g.scanned_at desc
  )
  select c.id, c.holder_name, c.type, c.house_number, c.house_unit, l.scanned_at, c.valid_to,
         coalesce(c.type in ('guest','long_stay') and c.valid_to < now(), false),
         e.job_title
    from last l join public.access_codes c on c.id = l.code_id
    left join public.employees e on e.id = c.employee_id
   where l.direction = 'in' and public.auth_role() is not distinct from 'estate_manager'
   order by 8 desc, l.scanned_at desc
$$;
grant execute on function public.inside_now() to authenticated;

-- ---------- overstay alerts to the Estate Manager (checked every 15 minutes) ----------
create table if not exists public.overstay_alerts (
  code_id uuid primary key references public.access_codes(id) on delete cascade,
  alerted_at timestamptz not null default now()
);
alter table public.overstay_alerts enable row level security;

create or replace function public.send_overstay_alerts()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in
    with last as (
      select distinct on (g.code_id) g.code_id, g.direction
        from public.gate_logs g
       where g.result = 'access' and g.code_id is not null and g.scanned_at > now() - interval '45 days'
       order by g.code_id, g.scanned_at desc)
    select c.* from last l join public.access_codes c on c.id = l.code_id
     where l.direction = 'in' and c.type in ('guest','long_stay') and c.valid_to < now() - interval '15 minutes'
       and not exists (select 1 from public.overstay_alerts a where a.code_id = c.id)
  loop
    insert into public.overstay_alerts (code_id) values (r.id);
    insert into public.notifications (recipient_id, kind, title, body, link)
    select p.id, 'security', 'Still inside: ' || r.holder_name,
           'House ' || r.house_number || '. Their code ended at '
             || to_char(r.valid_to at time zone 'Africa/Lagos', 'HH12:MI AM') || ' and they have not gone out.',
           '/manager/inside'
      from public.profiles p where p.role = 'estate_manager' and p.status = 'active';
    n := n + 1;
  end loop;
  return n;
end; $$;
revoke execute on function public.send_overstay_alerts() from public, anon, authenticated;

create extension if not exists pg_cron;
do $$ begin
  perform cron.unschedule('overstay-alerts') where exists (select 1 from cron.job where jobname = 'overstay-alerts');
  perform cron.schedule('overstay-alerts', '*/15 * * * *', 'select public.send_overstay_alerts()');
end $$;
