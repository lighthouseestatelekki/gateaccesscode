-- Piece 10: household staff (employee codes with schedules) and Estate Manager overrides.

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('announcement','code_in','code_out','code_refused','code_switched_off','approved','sos',
                  'code_expiring','code_changed','code_created_for_you'));

-- ---------- staff ----------
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  added_by uuid not null references public.profiles(id),
  house_number text not null,
  house_unit text not null,
  full_name text not null check (length(trim(full_name)) between 2 and 80),
  phone text,
  job_title text not null check (length(trim(job_title)) between 2 and 40),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists employees_added_by_idx on public.employees (added_by);
alter table public.employees enable row level security;
drop policy if exists "resident reads own staff" on public.employees;
drop policy if exists "estate manager reads all staff" on public.employees;
create policy "resident reads own staff" on public.employees for select to authenticated
  using (public.auth_role() = 'resident' and added_by = auth.uid());
create policy "estate manager reads all staff" on public.employees for select to authenticated
  using (public.auth_role() = 'estate_manager');

do $$ begin
  alter table public.access_codes add constraint access_codes_employee_fk foreign key (employee_id) references public.employees(id);
exception when duplicate_object then null; end $$;

-- ---------- helpers ----------
create or replace function public.random_code_digits()
returns text language sql volatile as $$
  select lpad((abs(('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))::bit(48)::bigint) % 1000000)::text, 6, '0')
$$;

create or replace function public.check_schedule(p_days int[], p_start time, p_end time, p_dom int[])
returns void language plpgsql immutable as $$
begin
  if p_days is not null and (cardinality(p_days) = 0 or exists (select 1 from unnest(p_days) d where d not between 0 and 6)) then
    raise exception 'Choose at least one working day';
  end if;
  if p_dom is not null and (cardinality(p_dom) = 0 or exists (select 1 from unnest(p_dom) d where d not between 1 and 31)) then
    raise exception 'Choose at least one date of the month';
  end if;
  if (p_start is null) <> (p_end is null) then raise exception 'Set both a start and an end time'; end if;
  if p_start is not null and p_start = p_end then raise exception 'Start and end time cannot be the same'; end if;
end; $$;

-- Is this employee code allowed in at this moment (Lagos time)?
create or replace function public.employee_on_duty(c public.access_codes, p_at timestamptz)
returns boolean language plpgsql stable as $$
declare l timestamp := p_at at time zone 'Africa/Lagos'; t time := l::time;
begin
  if c.days_of_week is not null and not (extract(dow from l)::int = any(c.days_of_week)) then return false; end if;
  if c.days_of_month is not null and not (extract(day from l)::int = any(c.days_of_month)) then return false; end if;
  if c.start_time is not null and c.end_time is not null then
    if c.start_time < c.end_time then return t >= c.start_time and t <= c.end_time; end if;
    return t >= c.start_time or t <= c.end_time;   -- overnight shift, e.g. 20:00 to 06:00
  end if;
  return true;
end; $$;

-- ---------- residents: add / reschedule / remove staff ----------
create or replace function public.add_employee(p_full_name text, p_phone text, p_job_title text,
  p_days int[] default null, p_start time default null, p_end time default null, p_dom int[] default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me public.profiles; e public.employees; c public.access_codes; v_try int := 0;
begin
  select * into me from public.profiles where id = auth.uid() and role = 'resident' and status = 'active';
  if not found then raise exception 'Only active residents can add staff'; end if;
  if length(trim(coalesce(p_full_name, ''))) < 2 then raise exception 'Please enter the staff member''s name'; end if;
  if length(trim(coalesce(p_job_title, ''))) < 2 then raise exception 'Please enter their job, e.g. Driver'; end if;
  perform public.check_schedule(p_days, p_start, p_end, p_dom);
  if (select count(*) from public.employees where added_by = me.id and active) >= 20 then
    raise exception 'A house can have at most 20 staff';
  end if;
  insert into public.employees (added_by, house_number, house_unit, full_name, phone, job_title)
  values (me.id, me.house_number, me.house_unit, trim(p_full_name), nullif(trim(coalesce(p_phone, '')), ''), trim(p_job_title))
  returning * into e;
  loop
    v_try := v_try + 1;
    begin
      insert into public.access_codes (code, type, issued_by, house_number, house_unit, holder_name, employee_id,
                                       valid_to, days_of_week, start_time, end_time, days_of_month)
      values (public.random_code_digits(), 'employee', me.id, me.house_number, me.house_unit, e.full_name, e.id,
              null, p_days, p_start, p_end, p_dom)
      returning * into c;
      exit;
    exception when unique_violation then
      if v_try >= 20 then raise exception 'Could not generate a unique code, please try again'; end if;
    end;
  end loop;
  return jsonb_build_object('employee', to_jsonb(e), 'code', to_jsonb(c));
end; $$;

create or replace function public.set_employee_schedule(p_code_id uuid,
  p_days int[] default null, p_start time default null, p_end time default null, p_dom int[] default null)
returns public.access_codes language plpgsql security definer set search_path = public as $$
declare v public.access_codes; is_em boolean := public.auth_role() = 'estate_manager';
begin
  if not is_em and public.auth_role() is distinct from 'resident' then raise exception 'Not allowed'; end if;
  perform public.check_schedule(p_days, p_start, p_end, p_dom);
  update public.access_codes
     set days_of_week = p_days, start_time = p_start, end_time = p_end, days_of_month = p_dom,
         changed_by = auth.uid(), changed_at = now()
   where id = p_code_id and type = 'employee' and active and (is_em or issued_by = auth.uid())
  returning * into v;
  if not found then raise exception 'This staff code cannot be changed'; end if;
  if is_em then
    insert into public.notifications (recipient_id, kind, title, body, link)
    values (v.issued_by, 'code_changed', v.holder_name || '''s working hours were changed',
            'The Estate Manager updated the schedule for staff code ' || v.code || '.', '/staff');
  end if;
  return v;
end; $$;

create or replace function public.remove_employee(p_employee_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare e public.employees; is_em boolean := public.auth_role() = 'estate_manager';
begin
  if not is_em and public.auth_role() is distinct from 'resident' then raise exception 'Not allowed'; end if;
  update public.employees set active = false
   where id = p_employee_id and active and (is_em or added_by = auth.uid()) returning * into e;
  if not found then raise exception 'Staff member not found'; end if;
  update public.access_codes set active = false, changed_by = auth.uid(), changed_at = now()
   where employee_id = e.id and active;
end; $$;

-- ---------- Estate Manager overrides ----------
create or replace function public.manager_change_code_dates(p_code_id uuid, p_valid_from timestamptz, p_valid_to timestamptz)
returns public.access_codes language plpgsql security definer set search_path = public as $$
declare v public.access_codes;
begin
  if public.auth_role() is distinct from 'estate_manager' then raise exception 'Only the Estate Manager can do this'; end if;
  if p_valid_to is null or p_valid_to <= coalesce(p_valid_from, now()) then raise exception 'End must be after start'; end if;
  update public.access_codes
     set valid_from = coalesce(p_valid_from, valid_from), valid_to = p_valid_to,
         reminder_sent_at = null, changed_by = auth.uid(), changed_at = now()
   where id = p_code_id and type in ('guest','long_stay') and used_at is null
  returning * into v;
  if not found then raise exception 'This code cannot be changed (it may already be used)'; end if;
  insert into public.notifications (recipient_id, kind, title, body, link)
  values (v.issued_by, 'code_changed', v.holder_name || '''s code was changed',
          'The Estate Manager changed when code ' || v.code || ' works. It now ends ' ||
          to_char(v.valid_to at time zone 'Africa/Lagos', 'Dy DD Mon, HH12:MI AM') || '.', '/home');
  return v;
end; $$;

create or replace function public.manager_set_code_active(p_code_id uuid, p_active boolean)
returns public.access_codes language plpgsql security definer set search_path = public as $$
declare v public.access_codes;
begin
  if public.auth_role() is distinct from 'estate_manager' then raise exception 'Only the Estate Manager can do this'; end if;
  update public.access_codes set active = p_active, changed_by = auth.uid(), changed_at = now()
   where id = p_code_id and active is distinct from p_active returning * into v;
  if not found then raise exception 'Nothing to change'; end if;
  if p_active then
    insert into public.notifications (recipient_id, kind, title, body, link)
    values (v.issued_by, 'code_changed', 'Code ' || v.code || ' was switched back on',
            'The Estate Manager switched the code for ' || v.holder_name || ' back on.', '/home');
  end if;
  return v;
end; $$;

create or replace function public.manager_create_code(p_house_number text, p_house_unit text, p_type text,
  p_holder_name text, p_valid_from timestamptz, p_valid_to timestamptz)
returns public.access_codes language plpgsql security definer set search_path = public as $$
declare r public.profiles; v public.access_codes; v_try int := 0;
begin
  if public.auth_role() is distinct from 'estate_manager' then raise exception 'Only the Estate Manager can do this'; end if;
  if p_type not in ('guest','long_stay') then raise exception 'Type must be guest or long_stay'; end if;
  if length(trim(coalesce(p_holder_name, ''))) = 0 then raise exception 'Visitor name is required'; end if;
  if p_valid_to is null or p_valid_to <= now() or p_valid_to <= coalesce(p_valid_from, now()) then
    raise exception 'End must be in the future and after the start';
  end if;
  select * into r from public.profiles
   where role = 'resident' and status = 'active' and house_number = p_house_number and house_unit = p_house_unit;
  if not found then raise exception 'No approved resident at that house and unit'; end if;
  loop
    v_try := v_try + 1;
    begin
      insert into public.access_codes (code, type, issued_by, house_number, house_unit, holder_name,
                                       valid_from, valid_to, changed_by, changed_at)
      values (public.random_code_digits(), p_type, r.id, r.house_number, r.house_unit, trim(p_holder_name),
              coalesce(p_valid_from, now()), p_valid_to, auth.uid(), now())
      returning * into v;
      exit;
    exception when unique_violation then
      if v_try >= 20 then raise exception 'Could not generate a unique code, please try again'; end if;
    end;
  end loop;
  insert into public.notifications (recipient_id, kind, title, body, link)
  values (r.id, 'code_created_for_you', 'The Estate Manager created a code for ' || v.holder_name,
          'Code ' || v.code || ' for House ' || v.house_number || ' works until ' ||
          to_char(v.valid_to at time zone 'Africa/Lagos', 'Dy DD Mon, HH12:MI AM') || '.', '/home');
  return v;
end; $$;

-- ---------- gate check with employee schedules ----------
create or replace function public.verify_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_guard public.profiles; v_code public.access_codes; v_found boolean := false;
  v_last text; v_dir text; v_result text; v_reason text; v_job text;
  v_now timestamptz := now(); v_hour int; v_night boolean;
begin
  select * into v_guard from public.profiles where id = auth.uid() and role = 'guard' and status = 'active';
  if not found then raise exception 'Only active guards can verify codes'; end if;

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

-- Resident counts: visitor codes only (staff are listed separately)
create or replace function public.my_code_counts()
returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'active',    count(*) filter (where active and used_at is null and (valid_to is null or valid_to > now())),
    'used',      count(*) filter (where used_at is not null),
    'expired',   count(*) filter (where active and used_at is null and valid_to <= now()),
    'cancelled', count(*) filter (where not active and used_at is null),
    'total',     count(*))
  from public.access_codes
  where issued_by = auth.uid() and public.auth_role() = 'resident' and type <> 'employee';
$$;

do $$ declare f text; begin
  foreach f in array array['add_employee(text,text,text,int[],time,time,int[])','set_employee_schedule(uuid,int[],time,time,int[])',
    'remove_employee(uuid)','manager_change_code_dates(uuid,timestamptz,timestamptz)','manager_set_code_active(uuid,boolean)',
    'manager_create_code(text,text,text,text,timestamptz,timestamptz)','verify_code(text)','my_code_counts()'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.random_code_digits() from public, anon, authenticated;
