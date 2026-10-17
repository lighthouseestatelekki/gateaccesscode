-- Piece 9: Long Stay codes (date range, unlimited in and out, max 30 days) and expiry reminders.

alter table public.access_codes add column if not exists reminder_sent_at timestamptz;

-- allow the new notice kind
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('announcement','code_in','code_out','code_refused','code_switched_off','approved','sos','code_expiring'));

-- ---------- create a Long Stay code ----------
create or replace function public.create_long_stay_code(p_holder_name text, p_valid_from timestamptz, p_valid_to timestamptz)
returns public.access_codes language plpgsql security definer set search_path = public as $$
declare v_res public.profiles; v_row public.access_codes; v_code text; v_try int := 0; v_from timestamptz;
begin
  select * into v_res from public.profiles where id = auth.uid() and role = 'resident' and status = 'active';
  if not found then raise exception 'Only active residents can create codes'; end if;
  if p_holder_name is null or length(trim(p_holder_name)) = 0 then raise exception 'Visitor name is required'; end if;
  v_from := greatest(coalesce(p_valid_from, now()), now() - interval '1 minute');
  if p_valid_to is null or p_valid_to <= now() then raise exception 'End date must be in the future'; end if;
  if p_valid_to <= v_from then raise exception 'End date must be after the start date'; end if;
  if p_valid_to - v_from > interval '30 days 1 minute' then raise exception 'A Long Stay code can last at most 30 days'; end if;
  if v_from > now() + interval '60 days' then raise exception 'Start date is too far ahead'; end if;
  loop
    v_try := v_try + 1;
    v_code := lpad((abs(('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))::bit(48)::bigint) % 1000000)::text, 6, '0');
    begin
      insert into public.access_codes (code, type, issued_by, house_number, house_unit, holder_name, valid_from, valid_to)
      values (v_code, 'long_stay', v_res.id, v_res.house_number, v_res.house_unit, trim(p_holder_name), v_from, p_valid_to)
      returning * into v_row;
      return v_row;
    exception when unique_violation then
      if v_try >= 20 then raise exception 'Could not generate a unique code, please try again'; end if;
    end;
  end loop;
end; $$;

-- ---------- gate check: Guest (one in, one out) and Long Stay (unlimited within dates) ----------
create or replace function public.verify_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_guard public.profiles; v_code public.access_codes; v_found boolean := false;
  v_last text; v_dir text; v_result text; v_reason text;
  v_now timestamptz := now(); v_hour int; v_night boolean;
begin
  select * into v_guard from public.profiles where id = auth.uid() and role = 'guard' and status = 'active';
  if not found then raise exception 'Only active guards can verify codes'; end if;

  v_hour := extract(hour from (v_now at time zone 'Africa/Lagos'))::int;
  v_night := (v_hour >= 22 or v_hour < 5);

  select * into v_code from public.access_codes where code = trim(coalesce(p_code, '')) for update;
  v_found := found;

  if not v_found then
    v_result := 'denied'; v_reason := 'Code not recognised';
  elsif not v_code.active then
    v_result := 'denied'; v_reason := 'Code has been switched off';
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
    v_result := 'denied'; v_reason := 'Code type not supported yet';
  end if;

  if v_result = 'access' then
    select direction into v_last from public.gate_logs
     where code_id = v_code.id and result = 'access' order by scanned_at desc limit 1;
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
    'valid_to', case when v_found then v_code.valid_to else null end,
    'gate', v_guard.assigned_gate, 'night_access', v_night);
end; $$;

-- ---------- residents extend / cancel Guest and Long Stay codes ----------
create or replace function public.cancel_my_code(p_code_id uuid)
returns public.access_codes language plpgsql security definer set search_path = public as $$
declare v_row public.access_codes;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'resident' and status = 'active') then
    raise exception 'Only active residents can change codes';
  end if;
  update public.access_codes set active = false, changed_by = auth.uid(), changed_at = now()
   where id = p_code_id and issued_by = auth.uid() and type in ('guest','long_stay') and active and used_at is null
  returning * into v_row;
  if not found then raise exception 'This code cannot be cancelled (it may already be used, cancelled or not yours)'; end if;
  return v_row;
end; $$;

create or replace function public.extend_my_code(p_code_id uuid, p_valid_to timestamptz)
returns public.access_codes language plpgsql security definer set search_path = public as $$
declare v_row public.access_codes; v_cur public.access_codes;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'resident' and status = 'active') then
    raise exception 'Only active residents can change codes';
  end if;
  if p_valid_to is null or p_valid_to <= now() then raise exception 'New expiry must be in the future'; end if;
  select * into v_cur from public.access_codes where id = p_code_id and issued_by = auth.uid();
  if found and v_cur.type = 'long_stay' and p_valid_to - greatest(v_cur.valid_from, now()) > interval '30 days 1 minute' then
    raise exception 'A Long Stay code can last at most 30 days from today';
  end if;
  update public.access_codes
     set valid_to = p_valid_to, changed_by = auth.uid(), changed_at = now(),
         reminder_sent_at = case when p_valid_to > now() + interval '24 hours' then null else reminder_sent_at end
   where id = p_code_id and issued_by = auth.uid() and type in ('guest','long_stay') and active and used_at is null
  returning * into v_row;
  if not found then raise exception 'This code cannot be extended (it may already be used, cancelled or not yours)'; end if;
  return v_row;
end; $$;

-- ---------- reminders: 24 hours before a code that lasts longer than a day expires ----------
create or replace function public.send_expiry_reminders()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with due as (
    update public.access_codes c set reminder_sent_at = now()
     where c.active and c.used_at is null and c.reminder_sent_at is null
       and c.valid_to > now() and c.valid_to <= now() + interval '24 hours'
       and c.valid_to - c.valid_from > interval '24 hours'
    returning c.*
  )
  insert into public.notifications (recipient_id, kind, title, body, link)
  select issued_by, 'code_expiring', holder_name || '''s code expires soon',
         'Code ' || code || ' stops working on ' ||
         to_char(valid_to at time zone 'Africa/Lagos', 'Dy DD Mon, HH12:MI AM') || '. Extend it from Home if they are staying longer.',
         '/home'
    from due;
  get diagnostics n = row_count;
  return n;
end; $$;

do $$ declare f text; begin
  foreach f in array array['create_long_stay_code(text,timestamptz,timestamptz)','verify_code(text)',
                           'cancel_my_code(uuid)','extend_my_code(uuid,timestamptz)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.send_expiry_reminders() from public, anon, authenticated;

-- run the reminder check every 15 minutes
create extension if not exists pg_cron;
do $$ begin
  perform cron.unschedule('code-expiry-reminders') where exists (select 1 from cron.job where jobname = 'code-expiry-reminders');
  perform cron.schedule('code-expiry-reminders', '*/15 * * * *', 'select public.send_expiry_reminders()');
end $$;

-- ---------- counts for the resident's "My codes" ----------
create or replace function public.my_code_counts()
returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'active',    count(*) filter (where active and used_at is null and (valid_to is null or valid_to > now())),
    'used',      count(*) filter (where used_at is not null),
    'expired',   count(*) filter (where active and used_at is null and valid_to <= now()),
    'cancelled', count(*) filter (where not active and used_at is null),
    'total',     count(*))
  from public.access_codes
  where issued_by = auth.uid() and public.auth_role() = 'resident';
$$;
revoke execute on function public.my_code_counts() from public, anon;
grant execute on function public.my_code_counts() to authenticated;
