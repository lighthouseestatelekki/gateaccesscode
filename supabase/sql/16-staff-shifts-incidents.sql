-- 16) Staff self-onboarding (photo, ID, next of kin / guarantor, resident approval),
-- guard shifts (clock in / out with handover notes) and incident reports. Run after 15.

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('announcement','code_in','code_out','code_refused','code_switched_off','approved','sos',
                  'code_expiring','code_changed','code_created_for_you','security','fixit','household','staff','incident'));

-- =====================================================================
-- STAFF ONBOARDING
-- The resident adds a staff member and sends them a private link. The staff member fills
-- in their own details on their phone. The resident reviews and approves. The staff code
-- only works once approved. Staff added before this change stay approved.
-- =====================================================================
alter table public.employees add column if not exists approved_at timestamptz;
alter table public.employees add column if not exists onboarding text not null default 'none'
  check (onboarding in ('none','invited','submitted','done'));
-- Existing staff: mark approved exactly once (when the onboarding column is first added they are all 'none').
update public.employees set approved_at = created_at where approved_at is null and onboarding = 'none';
alter table public.employees add column if not exists review_note text check (review_note is null or char_length(review_note) <= 300);
alter table public.employees add column if not exists photo text check (photo is null or (photo like 'data:image/jpeg;base64,%' and char_length(photo) <= 400000));
alter table public.employees add column if not exists id_type text check (id_type is null or id_type in ('NIN','Driver''s licence','Voter''s card','Passport','Other'));
alter table public.employees add column if not exists id_last4 text check (id_last4 is null or id_last4 ~ '^[A-Za-z0-9]{4}$');
alter table public.employees add column if not exists kin_kind text check (kin_kind is null or kin_kind in ('next_of_kin','guarantor'));
alter table public.employees add column if not exists kin_name text check (kin_name is null or char_length(kin_name) between 2 and 80);
alter table public.employees add column if not exists kin_phone text check (kin_phone is null or char_length(kin_phone) between 7 and 20);
alter table public.employees add column if not exists kin_relation text check (kin_relation is null or char_length(kin_relation) <= 40);
alter table public.employees add column if not exists consent_at timestamptz;
alter table public.employees add column if not exists submitted_at timestamptz;
alter table public.employees add column if not exists approved_by uuid references public.profiles(id);
alter table public.employees add column if not exists invite_expires_at timestamptz;

-- The private link's fingerprint lives in its own table that nobody can read from the app
-- (security on, no read rules). Only the functions below use it.
create table if not exists public.staff_invites (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  hash text not null unique,
  created_at timestamptz not null default now()
);
alter table public.staff_invites enable row level security;
revoke all on public.staff_invites from anon, authenticated;

create or replace function public.hash_invite(p_token text) returns text language sql immutable as $$
  select encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
$$;

-- A fresh private link for one staff member (any old link stops working). Returns the secret once.
create or replace function public.new_staff_invite(p_employee_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare tok text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  update public.employees
     set invite_expires_at = now() + interval '7 days',
         onboarding = case when onboarding in ('none','done') then 'invited' else onboarding end
   where id = p_employee_id and active and added_by = auth.uid()
     and public.auth_role() is not distinct from 'resident';
  if not found then raise exception 'Staff member not found'; end if;
  insert into public.staff_invites (employee_id, hash) values (p_employee_id, public.hash_invite(tok))
  on conflict (employee_id) do update set hash = excluded.hash, created_at = now();
  return tok;
end; $$;
grant execute on function public.new_staff_invite(uuid) to authenticated;

-- Adding staff now: the code is made at once (so hours can be set) but works only after approval.
create or replace function public.add_employee(p_full_name text, p_phone text, p_job_title text,
  p_days int[] default null, p_start time default null, p_end time default null, p_dom int[] default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me public.profiles; e public.employees; c public.access_codes; v_try int := 0; tok text;
begin
  if public.auth_role() is distinct from 'resident' then raise exception 'Only active residents can add staff'; end if;
  select * into me from public.profiles where id = auth.uid();
  if length(trim(coalesce(p_full_name, ''))) < 2 then raise exception 'Please enter the staff member''s name'; end if;
  if length(trim(coalesce(p_job_title, ''))) < 2 then raise exception 'Please enter their job, e.g. Driver'; end if;
  perform public.check_schedule(p_days, p_start, p_end, p_dom);
  if (select count(*) from public.employees where added_by = me.id and active) >= 20 then
    raise exception 'A house can have at most 20 staff';
  end if;
  insert into public.employees (added_by, house_number, house_unit, full_name, phone, job_title, onboarding, approved_at)
  values (me.id, me.house_number, me.house_unit, trim(p_full_name), nullif(trim(coalesce(p_phone, '')), ''), trim(p_job_title), 'invited', null)
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
  tok := public.new_staff_invite(e.id);
  return jsonb_build_object('employee', to_jsonb(e), 'code', to_jsonb(c), 'invite', tok);
end; $$;

-- ---- what the staff member sees when they open the link (no sign-in) ----
create or replace function public.staff_invite_info(p_token text)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare e public.employees;
begin
  select e2.* into e from public.staff_invites i join public.employees e2 on e2.id = i.employee_id
   where i.hash = public.hash_invite(p_token) and e2.active;
  if e.id is null then return jsonb_build_object('status', 'not_found'); end if;
  if e.invite_expires_at < now() then return jsonb_build_object('status', 'expired'); end if;
  return jsonb_build_object(
    'status', case when e.onboarding = 'submitted' then 'submitted' else 'open' end,
    'full_name', e.full_name, 'job_title', e.job_title, 'house', e.house_number, 'unit', e.house_unit,
    'note', e.review_note, 'phone', e.phone);
end; $$;

create or replace function public.staff_invite_submit(p_token text, p_full_name text, p_phone text,
  p_id_type text, p_id_last4 text, p_kin_kind text, p_kin_name text, p_kin_phone text, p_kin_relation text,
  p_photo text, p_consent boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.employees;
begin
  select e2.* into e from public.staff_invites i join public.employees e2 on e2.id = i.employee_id
   where i.hash = public.hash_invite(p_token) and e2.active for update of e2;
  if e.id is null or e.invite_expires_at < now() then raise exception 'This link is no longer valid. Please ask the house for a new one.'; end if;
  if e.onboarding = 'submitted' then raise exception 'Your details are already sent and waiting for the house to approve.'; end if;
  if not coalesce(p_consent, false) then raise exception 'Please tick that you agree, so the estate can keep your details for gate security.'; end if;
  if length(btrim(coalesce(p_full_name, ''))) < 2 then raise exception 'Please enter your full name.'; end if;
  if length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) < 7 then raise exception 'Please enter your phone number.'; end if;
  if p_photo is null or p_photo not like 'data:image/jpeg;base64,%' then raise exception 'Please take a photo of your face.'; end if;
  if char_length(p_photo) > 400000 then raise exception 'The photo is too large. Please take it again.'; end if;
  if p_id_type is null or upper(coalesce(p_id_last4, '')) !~ '^[A-Z0-9]{4}$' then raise exception 'Please choose your ID and enter its last 4 digits.'; end if;
  if p_kin_kind not in ('next_of_kin','guarantor') or length(btrim(coalesce(p_kin_name, ''))) < 2
     or length(regexp_replace(coalesce(p_kin_phone, ''), '\D', '', 'g')) < 7 then
    raise exception 'Please add your next of kin or guarantor''s name and phone number.';
  end if;
  update public.employees
     set full_name = btrim(p_full_name), phone = btrim(p_phone), id_type = p_id_type, id_last4 = upper(p_id_last4),
         kin_kind = p_kin_kind, kin_name = btrim(p_kin_name), kin_phone = btrim(p_kin_phone),
         kin_relation = nullif(btrim(coalesce(p_kin_relation, '')), ''), photo = p_photo,
         consent_at = now(), submitted_at = now(), onboarding = 'submitted', review_note = null
   where id = e.id;
  insert into public.notifications (recipient_id, kind, title, body, link)
  values (e.added_by, 'staff', btrim(p_full_name) || ' sent their details',
          'Please check their photo and ID, then approve so their staff code works.', '/staff');
  return jsonb_build_object('status', 'submitted');
end; $$;
revoke execute on function public.staff_invite_info(text) from public;
revoke execute on function public.staff_invite_submit(text, text, text, text, text, text, text, text, text, text, boolean) from public;
grant execute on function public.staff_invite_info(text) to anon, authenticated;
grant execute on function public.staff_invite_submit(text, text, text, text, text, text, text, text, text, text, boolean) to anon, authenticated;
revoke execute on function public.hash_invite(text) from public, anon;

-- ---- the resident approves, or sends it back with a note ----
create or replace function public.review_staff(p_employee_id uuid, p_approve boolean, p_note text default null)
returns public.employees language plpgsql security definer set search_path = public as $$
declare e public.employees;
begin
  if public.auth_role() is distinct from 'resident' then raise exception 'Only active residents can do this'; end if;
  select * into e from public.employees where id = p_employee_id and active and added_by = auth.uid() for update;
  if e.id is null then raise exception 'Staff member not found'; end if;
  if e.onboarding <> 'submitted' then raise exception 'There is nothing to review yet'; end if;
  if p_approve then
    update public.employees
       set onboarding = 'done', approved_at = coalesce(approved_at, now()), approved_by = auth.uid(),
           invite_expires_at = null, review_note = null
     where id = e.id returning * into e;
    delete from public.staff_invites where employee_id = e.id;
    update public.access_codes set holder_name = e.full_name where employee_id = e.id and active;
  else
    if length(btrim(coalesce(p_note, ''))) < 3 then raise exception 'Please say what they should fix'; end if;
    update public.employees
       set onboarding = 'invited', review_note = btrim(p_note), invite_expires_at = now() + interval '7 days'
     where id = e.id returning * into e;
  end if;
  return e;
end; $$;
grant execute on function public.review_staff(uuid, boolean, text) to authenticated;

-- ---- removing staff also deletes their personal details (as promised on the consent box) ----
create or replace function public.remove_employee(p_employee_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare e public.employees; is_em boolean := public.auth_role() = 'estate_manager';
begin
  if not is_em and public.auth_role() is distinct from 'resident' then raise exception 'Not allowed'; end if;
  update public.employees
     set active = false, photo = null, id_type = null, id_last4 = null, kin_kind = null, kin_name = null,
         kin_phone = null, kin_relation = null, invite_expires_at = null
   where id = p_employee_id and active and (is_em or added_by = auth.uid()) returning * into e;
  if not found then raise exception 'Staff member not found'; end if;
  delete from public.staff_invites where employee_id = e.id;
  update public.access_codes set active = false, changed_by = auth.uid(), changed_at = now()
   where employee_id = e.id and active;
end; $$;

-- ---- the gate check now shows the staff photo and ID, and refuses staff not yet approved ----
create or replace function public.verify_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_guard public.profiles; v_code public.access_codes; v_found boolean := false;
  v_last text; v_dir text; v_result text; v_reason text; v_job text;
  v_now timestamptz := now(); v_hour int; v_night boolean; v_emp public.employees;
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
    select * into v_emp from public.employees where id = v_code.employee_id;
    v_job := v_emp.job_title;
    -- someone already inside may always leave, even after their hours
    if v_emp.approved_at is null then
      v_result := 'denied'; v_reason := 'Staff not approved yet by the house';
    elsif v_last = 'in' or public.employee_on_duty(v_code, v_now) then
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
    'gate', v_guard.assigned_gate, 'night_access', v_night,
    'photo', v_emp.photo,
    'id_line', case when v_emp.id_last4 is not null then v_emp.id_type || ' ending ' || v_emp.id_last4 end);
end; $$;

-- =====================================================================
-- GUARD SHIFTS: clock in, clock out with a handover note for the next guard
-- =====================================================================
create table if not exists public.guard_shifts (
  id uuid primary key default gen_random_uuid(),
  guard_id uuid not null references public.profiles(id),
  gate int,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  handover_note text check (handover_note is null or char_length(handover_note) <= 500),
  auto_closed boolean not null default false
);
create unique index if not exists guard_one_open_shift on public.guard_shifts (guard_id) where ended_at is null;
create index if not exists guard_shifts_started_idx on public.guard_shifts (started_at desc);
alter table public.guard_shifts enable row level security;
drop policy if exists "guard reads own shifts" on public.guard_shifts;
create policy "guard reads own shifts" on public.guard_shifts for select to authenticated
  using (public.auth_role() = 'guard' and guard_id = auth.uid());
drop policy if exists "estate manager reads shifts" on public.guard_shifts;
create policy "estate manager reads shifts" on public.guard_shifts for select to authenticated
  using (public.auth_role() = 'estate_manager');
grant select on public.guard_shifts to authenticated;

-- Shifts left open for more than 16 hours are closed automatically (counted as 12 hours).
create or replace function public.close_stale_shifts() returns void language sql security definer set search_path = public as $$
  update public.guard_shifts set ended_at = started_at + interval '12 hours', auto_closed = true
   where ended_at is null and started_at < now() - interval '16 hours'
$$;
revoke execute on function public.close_stale_shifts() from public, anon, authenticated;

-- Guard's current shift plus the last handover note left at their gate.
create or replace function public.guard_shift_state()
returns jsonb language plpgsql security definer set search_path = public as $$
declare g public.profiles; s public.guard_shifts; h record;
begin
  if public.auth_role() is distinct from 'guard' then raise exception 'Only active guards can do this'; end if;
  perform public.close_stale_shifts();
  select * into g from public.profiles where id = auth.uid();
  select * into s from public.guard_shifts where guard_id = g.id and ended_at is null;
  select x.handover_note, x.ended_at, p.guard_number into h
    from public.guard_shifts x join public.profiles p on p.id = x.guard_id
   where x.ended_at is not null and x.handover_note is not null and x.gate is not distinct from g.assigned_gate
     and x.ended_at > now() - interval '2 days'
   order by x.ended_at desc limit 1;
  return jsonb_build_object('on_duty', s.id is not null, 'started_at', s.started_at,
    'handover', case when h.handover_note is not null then jsonb_build_object('note', h.handover_note, 'at', h.ended_at, 'guard_number', h.guard_number) end);
end; $$;

create or replace function public.guard_clock_in()
returns jsonb language plpgsql security definer set search_path = public as $$
declare g public.profiles;
begin
  if public.auth_role() is distinct from 'guard' then raise exception 'Only active guards can do this'; end if;
  perform public.close_stale_shifts();
  select * into g from public.profiles where id = auth.uid();
  insert into public.guard_shifts (guard_id, gate) values (g.id, g.assigned_gate) on conflict do nothing;
  return public.guard_shift_state();
end; $$;

create or replace function public.guard_clock_out(p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if public.auth_role() is distinct from 'guard' then raise exception 'Only active guards can do this'; end if;
  update public.guard_shifts set ended_at = now(), handover_note = nullif(btrim(coalesce(p_note, '')), '')
   where guard_id = auth.uid() and ended_at is null;
  if not found then raise exception 'You are not clocked in'; end if;
  return public.guard_shift_state();
end; $$;
grant execute on function public.guard_shift_state() to authenticated;
grant execute on function public.guard_clock_in() to authenticated;
grant execute on function public.guard_clock_out(text) to authenticated;

-- =====================================================================
-- INCIDENT REPORTS: guards report, the Estate Manager (and the house involved) are told
-- =====================================================================
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  ref bigint generated always as identity,
  reported_by uuid not null references public.profiles(id),
  gate int,
  category text not null check (category in ('suspicious','theft','damage','disturbance','vehicle','fire_hazard','other')),
  description text not null check (char_length(description) between 5 and 1000),
  house_number text,
  house_unit text,
  photo text check (photo is null or (photo like 'data:image/jpeg;base64,%' and char_length(photo) <= 600000)),
  status text not null default 'open' check (status in ('open','closed')),
  manager_note text check (manager_note is null or char_length(manager_note) <= 500),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists incidents_created_idx on public.incidents (created_at desc);
alter table public.incidents enable row level security;
drop policy if exists "guard reads own incidents" on public.incidents;
create policy "guard reads own incidents" on public.incidents for select to authenticated
  using (public.auth_role() = 'guard' and reported_by = auth.uid());
drop policy if exists "estate manager reads incidents" on public.incidents;
create policy "estate manager reads incidents" on public.incidents for select to authenticated
  using (public.auth_role() = 'estate_manager');
grant select on public.incidents to authenticated;

create or replace function public.incident_label(p text) returns text language sql immutable as $$
  select case p when 'suspicious' then 'Suspicious person' when 'theft' then 'Theft' when 'damage' then 'Damage'
    when 'disturbance' then 'Fight or disturbance' when 'vehicle' then 'Vehicle problem' when 'fire_hazard' then 'Fire or hazard'
    else 'Other' end
$$;

create or replace function public.report_incident(p_category text, p_description text, p_house text default null,
  p_unit text default null, p_photo text default null)
returns public.incidents language plpgsql security definer set search_path = public as $$
declare g public.profiles; r public.incidents;
begin
  if public.auth_role() is distinct from 'guard' then raise exception 'Only active guards can report incidents'; end if;
  select * into g from public.profiles where id = auth.uid();
  if (select count(*) from public.incidents where reported_by = g.id and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Too many reports in the last hour. Please call the Estate Manager.';
  end if;
  insert into public.incidents (reported_by, gate, category, description, house_number, house_unit, photo)
  values (g.id, g.assigned_gate, p_category, btrim(p_description), nullif(btrim(coalesce(p_house, '')), ''),
          nullif(btrim(coalesce(p_unit, '')), ''), p_photo)
  returning * into r;
  -- Estate Manager: every report.
  insert into public.notifications (recipient_id, kind, title, body, link)
  select p.id, 'incident', 'Incident #' || r.ref || ': ' || public.incident_label(r.category),
         'Guard ' || g.guard_number || coalesce(', House ' || r.house_number, '') || ' · ' || left(r.description, 160), '/manager/incidents'
    from public.profiles p where p.role = 'estate_manager' and p.status = 'active';
  -- The house involved (every adult there; all units if the guard did not pick one).
  if r.house_number is not null then
    insert into public.notifications (recipient_id, kind, title, body, link)
    select p.id, 'incident', 'Gate report about your house: ' || public.incident_label(r.category),
           left(r.description, 200) || ' (reported by the gate, ' || to_char(r.created_at at time zone 'Africa/Lagos', 'HH12:MI AM') || ')', '/inbox'
      from public.profiles p
     where p.role = 'resident' and p.status = 'active' and p.house_number = r.house_number
       and (r.house_unit is null or p.house_unit = r.house_unit);
  end if;
  return r;
end; $$;
grant execute on function public.report_incident(text, text, text, text, text) to authenticated;

create or replace function public.close_incident(p_id uuid, p_note text default null)
returns public.incidents language plpgsql security definer set search_path = public as $$
declare r public.incidents;
begin
  if public.auth_role() is distinct from 'estate_manager' then raise exception 'Only the Estate Manager can do this'; end if;
  update public.incidents set status = 'closed', closed_at = now(),
         manager_note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), manager_note)
   where id = p_id returning * into r;
  if r.id is null then raise exception 'Report not found'; end if;
  return r;
end; $$;
grant execute on function public.close_incident(uuid, text) to authenticated;
