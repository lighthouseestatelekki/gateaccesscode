-- 17) Estate Manager action history, moving out, privacy notice consent, "download my data",
-- and automatic deletion of old data (retention). Run after 16.
--
-- Retention (matches the privacy notice):
--   gate log, old visitor codes, incidents, guard shifts, action history ... 24 months
--   inbox alerts ............................................................ 12 months
--   personal details of people who moved out / were removed / declined ...... 90 days after
--   (staff photo, ID and next of kin are deleted the moment staff are removed)

-- ---------- new profile fields ----------
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check
  check (status in ('pending','active','suspended','declined','moved_out'));
alter table public.profiles add column if not exists moved_out_at timestamptz;
alter table public.profiles add column if not exists anonymised_at timestamptz;
alter table public.profiles add column if not exists privacy_version int;
alter table public.profiles add column if not exists privacy_accepted_at timestamptz;
alter table public.employees add column if not exists removed_at timestamptz;

-- A unit can take a new household once the old one has moved out.
drop index if exists public.one_primary_per_unit;
create unique index one_primary_per_unit on public.profiles (house_number, house_unit)
  where role = 'resident' and household_role = 'primary' and status <> 'moved_out';
drop index if exists public.one_member_number_per_unit;
create unique index one_member_number_per_unit on public.profiles (house_number, house_unit, member_no)
  where role = 'resident' and household_role = 'member' and status <> 'moved_out';

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('announcement','code_in','code_out','code_refused','code_switched_off','approved','sos',
                  'code_expiring','code_changed','code_created_for_you','security','fixit','household','staff','incident','moving'));

-- =====================================================================
-- ACTION HISTORY: every change the Estate Manager makes is written down.
-- Nobody (not even the Estate Manager) can edit or delete an entry from the app.
-- =====================================================================
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_name text,
  actor_role text,
  action text not null,
  target text,
  details jsonb
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);
alter table public.audit_log enable row level security;
drop policy if exists "estate manager reads history" on public.audit_log;
create policy "estate manager reads history" on public.audit_log for select to authenticated
  using (public.auth_role() = 'estate_manager');
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

create or replace function public.unit_label(u text) returns text language sql immutable as $$
  select case u when 'main' then 'Duplex' when 'ground' then 'Ground Floor' when 'upper' then 'First Floor' when 'boys' then 'BQ' else u end
$$;

create or replace function public.who_label(p public.profiles) returns text language sql immutable as $$
  select case
    when p.role = 'guard' then 'Guard ' || p.guard_number || ' (' || p.full_name || ')'
    when p.role = 'resident' then p.full_name || ', House ' || p.house_number || ' ' ||
      case p.house_unit when 'main' then 'Duplex' when 'ground' then 'Ground Floor' when 'upper' then 'First Floor' when 'boys' then 'BQ' else p.house_unit end
    else p.full_name end
$$;

create or replace function public.audit_manager_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare me public.profiles; v_action text; v_target text; v_details jsonb;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.role is distinct from 'estate_manager' then return null; end if;

  if tg_table_name = 'profiles' then
    if tg_op <> 'UPDATE' then return null; end if;
    v_target := public.who_label(new);
    if new.status is distinct from old.status then
      v_action := case
        when new.status = 'active' and old.status = 'pending' then 'Approved registration'
        when new.status = 'active' then 'Re-activated'
        when new.status = 'declined' then 'Declined registration'
        when new.status = 'suspended' then 'Suspended'
        when new.status = 'moved_out' then 'Moved out'
        else 'Changed status to ' || new.status end;
    elsif new.sessions_revoked_at is distinct from old.sessions_revoked_at then
      v_action := 'Signed out of all devices';
    elsif (new.house_number, new.house_unit) is distinct from (old.house_number, old.house_unit) then
      v_action := 'Changed house';
      v_details := jsonb_build_object('from', old.house_number || ' ' || old.house_unit, 'to', new.house_number || ' ' || new.house_unit);
    else
      return null;
    end if;

  elsif tg_table_name = 'access_codes' then
    v_target := 'Code ' || new.code || ' · ' || new.holder_name || ' · House ' || new.house_number;
    -- changes made on the resident's behalf (e.g. moving out) are not separate manager actions
    if tg_op = 'UPDATE' and new.changed_by is not distinct from new.issued_by then return null; end if;
    if tg_op = 'INSERT' then
      v_action := 'Created a code';
      v_details := jsonb_build_object('until', new.valid_to);
    elsif new.active is distinct from old.active then
      v_action := case when new.active then 'Switched a code back on' else 'Switched a code off' end;
    elsif (new.valid_from, new.valid_to) is distinct from (old.valid_from, old.valid_to) then
      v_action := 'Changed when a code works';
      v_details := jsonb_build_object('until_before', old.valid_to, 'until_after', new.valid_to);
    elsif (new.days_of_week, new.start_time, new.end_time, new.days_of_month) is distinct from
          (old.days_of_week, old.start_time, old.end_time, old.days_of_month) then
      v_action := 'Changed staff working hours';
    else
      return null;
    end if;

  elsif tg_table_name = 'announcements' then
    v_action := 'Sent an announcement';
    v_target := new.title;

  elsif tg_table_name = 'fixit_requests' then
    if new.status is not distinct from old.status then return null; end if;
    v_action := 'Fix-It #' || new.ref || ' set to ' || replace(new.status, '_', ' ');
    v_target := 'House ' || new.house_number || ' · ' || left(new.description, 80);

  elsif tg_table_name = 'incidents' then
    if new.status is not distinct from old.status then return null; end if;
    v_action := case when new.status = 'closed' then 'Closed incident #' || new.ref else 'Re-opened incident #' || new.ref end;
    v_target := coalesce(new.manager_note, left(new.description, 80));

  elsif tg_table_name = 'sos_alerts' then
    if new.status is not distinct from old.status then return null; end if;
    v_action := 'SOS ' || replace(new.status, '_', ' ');
    v_target := new.full_name || ', House ' || new.house_number;

  elsif tg_table_name = 'employees' then
    if not (old.active and not new.active) then return null; end if;
    v_action := 'Removed staff';
    v_target := new.full_name || ' (' || new.job_title || '), House ' || new.house_number;

  elsif tg_table_name = 'move_outs' then
    if tg_op = 'UPDATE' and new.status is not distinct from old.status then return null; end if;
    v_action := case new.status when 'confirmed' then 'Confirmed a move-out' when 'cancelled' then 'Cancelled a move-out'
                                when 'done' then 'Completed a move-out' else 'Started a move-out' end;
    v_target := 'House ' || new.house_number || ' ' || public.unit_label(new.house_unit) || ' on ' || to_char(new.move_date, 'Dy DD Mon YYYY');
  else
    return null;
  end if;

  insert into public.audit_log (actor_id, actor_name, actor_role, action, target, details)
  values (me.id, me.full_name, me.role, v_action, v_target, v_details);
  return null;
end; $$;

drop trigger if exists audit_profiles on public.profiles;
create trigger audit_profiles after update on public.profiles for each row execute function public.audit_manager_change();
drop trigger if exists audit_access_codes on public.access_codes;
create trigger audit_access_codes after insert or update on public.access_codes for each row execute function public.audit_manager_change();
drop trigger if exists audit_announcements on public.announcements;
create trigger audit_announcements after insert on public.announcements for each row execute function public.audit_manager_change();
drop trigger if exists audit_fixit on public.fixit_requests;
create trigger audit_fixit after update on public.fixit_requests for each row execute function public.audit_manager_change();
drop trigger if exists audit_incidents on public.incidents;
create trigger audit_incidents after update on public.incidents for each row execute function public.audit_manager_change();
drop trigger if exists audit_sos on public.sos_alerts;
create trigger audit_sos after update on public.sos_alerts for each row execute function public.audit_manager_change();
drop trigger if exists audit_employees on public.employees;
create trigger audit_employees after update on public.employees for each row execute function public.audit_manager_change();

-- =====================================================================
-- MOVING OUT: the main resident asks, the Estate Manager confirms (or starts it).
-- On the day: all codes stop, staff and household members are removed, everyone in the
-- unit is signed out, and the unit is free for the next household.
-- =====================================================================
create table if not exists public.move_outs (
  id uuid primary key default gen_random_uuid(),
  house_number text not null,
  house_unit text not null,
  resident_id uuid not null references public.profiles(id),
  move_date date not null,
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'requested' check (status in ('requested','confirmed','done','cancelled')),
  requested_by uuid not null references public.profiles(id),
  confirmed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create unique index if not exists one_open_move_out on public.move_outs (house_number, house_unit) where status in ('requested','confirmed');
alter table public.move_outs enable row level security;
drop policy if exists "house reads own move out" on public.move_outs;
create policy "house reads own move out" on public.move_outs for select to authenticated
  using (public.auth_role() = 'resident' and exists (
    select 1 from public.profiles me where me.id = auth.uid() and me.house_number = move_outs.house_number and me.house_unit = move_outs.house_unit));
drop policy if exists "estate manager reads move outs" on public.move_outs;
create policy "estate manager reads move outs" on public.move_outs for select to authenticated
  using (public.auth_role() = 'estate_manager');
grant select on public.move_outs to authenticated;
drop trigger if exists audit_move_outs on public.move_outs;
create trigger audit_move_outs after insert or update on public.move_outs for each row execute function public.audit_manager_change();

create or replace function public.lagos_today() returns date language sql stable as $$
  select (now() at time zone 'Africa/Lagos')::date
$$;

-- Does the actual hand-over. Only called from the functions below.
create or replace function public.perform_move_out(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.move_outs; ids uuid[];
begin
  select * into m from public.move_outs where id = p_id for update;
  if m.id is null or m.status <> 'confirmed' then return; end if;
  select coalesce(array_agg(id), '{}') into ids from public.profiles
   where role = 'resident' and house_number = m.house_number and house_unit = m.house_unit and status <> 'moved_out';

  -- every code for the unit stops (changed_by = issuer, so no "switched off" alerts are sent)
  update public.access_codes set active = false, changed_by = issued_by, changed_at = now()
   where house_number = m.house_number and house_unit = m.house_unit and active;
  -- staff: removed, personal details deleted now
  update public.employees
     set active = false, removed_at = now(), photo = null, id_type = null, id_last4 = null, kin_kind = null,
         kin_name = null, kin_phone = null, kin_relation = null, invite_expires_at = null
   where house_number = m.house_number and house_unit = m.house_unit and active;
  delete from public.staff_invites i using public.employees e
   where e.id = i.employee_id and e.house_number = m.house_number and e.house_unit = m.house_unit;
  -- people: closed and signed out everywhere; their details are deleted after 90 days
  update public.profiles set status = 'moved_out', moved_out_at = now(), sessions_revoked_at = now()
   where id = any(ids);
  delete from auth.sessions where user_id = any(ids);
  delete from public.push_subscriptions where user_id = any(ids);
  update public.move_outs set status = 'done', done_at = now() where id = m.id;
  if auth.uid() is null then  -- the nightly job: write the history entry here
    insert into public.audit_log (actor_name, actor_role, action, target)
    values ('Automatic (nightly)', 'system', 'Completed a move-out',
            'House ' || m.house_number || ' ' || public.unit_label(m.house_unit) || ' on ' || to_char(m.move_date, 'Dy DD Mon YYYY'));
  end if;

  insert into public.notifications (recipient_id, kind, title, body, link)
  select p.id, 'moving', 'House ' || m.house_number || ' has moved out',
         'All codes, staff and household members for this unit were removed. The unit is free for the next household.', '/manager/moving'
    from public.profiles p where p.role = 'estate_manager' and p.status = 'active';
end; $$;
revoke execute on function public.perform_move_out(uuid) from public, anon, authenticated;

-- Main resident asks to move out on a date.
create or replace function public.request_move_out(p_date date, p_note text default null)
returns public.move_outs language plpgsql security definer set search_path = public as $$
declare me public.profiles; m public.move_outs;
begin
  if public.auth_role() is distinct from 'resident' then raise exception 'Only active residents can do this'; end if;
  select * into me from public.profiles where id = auth.uid();
  if me.household_role is distinct from 'primary' then raise exception 'Only the main resident of the house can do this'; end if;
  if p_date is null or p_date < public.lagos_today() then raise exception 'Please choose today or a later date'; end if;
  if p_date > public.lagos_today() + 365 then raise exception 'Please choose a date within the next 12 months'; end if;
  if exists (select 1 from public.move_outs where house_number = me.house_number and house_unit = me.house_unit and status in ('requested','confirmed')) then
    raise exception 'You already have a moving-out request';
  end if;
  insert into public.move_outs (house_number, house_unit, resident_id, move_date, note, requested_by)
  values (me.house_number, me.house_unit, me.id, p_date, nullif(btrim(coalesce(p_note, '')), ''), me.id)
  returning * into m;
  insert into public.notifications (recipient_id, kind, title, body, link)
  select p.id, 'moving', 'Moving out: House ' || me.house_number,
         me.full_name || ' plans to move out on ' || to_char(p_date, 'Dy DD Mon YYYY') || '. Please confirm.', '/manager/moving'
    from public.profiles p where p.role = 'estate_manager' and p.status = 'active';
  return m;
end; $$;

-- Estate Manager confirms. If the date is today or past, it happens straight away.
create or replace function public.confirm_move_out(p_id uuid)
returns public.move_outs language plpgsql security definer set search_path = public as $$
declare m public.move_outs;
begin
  if public.auth_role() is distinct from 'estate_manager' then raise exception 'Only the Estate Manager can do this'; end if;
  update public.move_outs set status = 'confirmed', confirmed_by = auth.uid()
   where id = p_id and status = 'requested' returning * into m;
  if m.id is null then raise exception 'Request not found'; end if;
  insert into public.notifications (recipient_id, kind, title, body, link)
  values (m.resident_id, 'moving', 'Moving out confirmed',
          'The Estate Manager confirmed your move-out on ' || to_char(m.move_date, 'Dy DD Mon YYYY') || '. Your codes stop working that day.', '/moving');
  if m.move_date <= public.lagos_today() then perform public.perform_move_out(m.id); end if;
  select * into m from public.move_outs where id = m.id;
  return m;
end; $$;

-- Estate Manager starts a move-out for a household (already confirmed).
create or replace function public.manager_start_move_out(p_resident uuid, p_date date)
returns public.move_outs language plpgsql security definer set search_path = public as $$
declare r public.profiles; m public.move_outs;
begin
  if public.auth_role() is distinct from 'estate_manager' then raise exception 'Only the Estate Manager can do this'; end if;
  if p_date is null or p_date < public.lagos_today() - 30 then raise exception 'Please choose a date'; end if;
  select * into r from public.profiles where id = p_resident and role = 'resident' and status <> 'moved_out';
  if r.id is null then raise exception 'Resident not found'; end if;
  if exists (select 1 from public.move_outs where house_number = r.house_number and house_unit = r.house_unit and status in ('requested','confirmed')) then
    raise exception 'This unit already has a moving-out request. Confirm or cancel it under Moving out.';
  end if;
  insert into public.move_outs (house_number, house_unit, resident_id, move_date, status, requested_by, confirmed_by)
  values (r.house_number, r.house_unit, r.id, p_date, 'confirmed', auth.uid(), auth.uid())
  returning * into m;
  if m.move_date <= public.lagos_today() then perform public.perform_move_out(m.id); end if;
  select * into m from public.move_outs where id = m.id;
  return m;
end; $$;

-- Either side can cancel before it happens.
create or replace function public.cancel_move_out(p_id uuid)
returns public.move_outs language plpgsql security definer set search_path = public as $$
declare m public.move_outs; is_em boolean := public.auth_role() is not distinct from 'estate_manager';
begin
  if not is_em and public.auth_role() is distinct from 'resident' then raise exception 'Not allowed'; end if;
  update public.move_outs set status = 'cancelled'
   where id = p_id and status in ('requested','confirmed') and (is_em or resident_id = auth.uid())
  returning * into m;
  if m.id is null then raise exception 'Request not found'; end if;
  if is_em then
    insert into public.notifications (recipient_id, kind, title, body, link)
    values (m.resident_id, 'moving', 'Moving out cancelled', 'The Estate Manager cancelled the moving-out request.', '/moving');
  else
    insert into public.notifications (recipient_id, kind, title, body, link)
    select p.id, 'moving', 'Moving out cancelled: House ' || m.house_number, 'The resident cancelled their moving-out request.', '/manager/moving'
      from public.profiles p where p.role = 'estate_manager' and p.status = 'active';
  end if;
  return m;
end; $$;
grant execute on function public.request_move_out(date, text) to authenticated;
grant execute on function public.confirm_move_out(uuid) to authenticated;
grant execute on function public.manager_start_move_out(uuid, date) to authenticated;
grant execute on function public.cancel_move_out(uuid) to authenticated;

-- Runs every night: confirmed move-outs whose day has come.
create or replace function public.process_move_outs()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from public.move_outs where status = 'confirmed' and move_date <= public.lagos_today() loop
    perform public.perform_move_out(r.id);
    n := n + 1;
  end loop;
  return n;
end; $$;
revoke execute on function public.process_move_outs() from public, anon, authenticated;

-- =====================================================================
-- PRIVACY: accepting the notice, and "download my data"
-- =====================================================================
create or replace function public.accept_privacy(p_version int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_version is null or p_version < 1 then raise exception 'Unknown version'; end if;
  update public.profiles set privacy_version = p_version, privacy_accepted_at = now()
   where id = auth.uid() and status in ('pending','active');
end; $$;
grant execute on function public.accept_privacy(int) to authenticated;

-- Everything the app holds about the signed-in resident, as one file.
create or replace function public.my_data_export()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null or me.status not in ('pending','active') then raise exception 'Please sign in again'; end if;
  return jsonb_build_object(
    'exported_at', now(),
    'about_you', jsonb_build_object('full_name', me.full_name, 'phone', me.phone, 'email', me.email,
       'house_number', me.house_number, 'house_unit', me.house_unit, 'role', me.role, 'status', me.status,
       'household_role', me.household_role, 'relation', me.relation,
       'next_of_kin', jsonb_build_object('name', me.nok_name, 'phone', me.nok_phone, 'relationship', me.nok_relationship),
       'registered_at', me.created_at, 'privacy_notice_accepted_at', me.privacy_accepted_at),
    'codes_you_created', coalesce((select jsonb_agg(jsonb_build_object('code', c.code, 'type', c.type, 'for', c.holder_name,
       'from', c.valid_from, 'until', c.valid_to, 'active', c.active, 'created_at', c.created_at) order by c.created_at desc)
       from public.access_codes c where c.issued_by = me.id), '[]'::jsonb),
    'gate_log_for_your_codes', coalesce((select jsonb_agg(jsonb_build_object('at', g.scanned_at, 'code', c.code, 'for', c.holder_name,
       'direction', g.direction, 'result', g.result, 'reason', g.reason) order by g.scanned_at desc)
       from public.gate_logs g join public.access_codes c on c.id = g.code_id where c.issued_by = me.id), '[]'::jsonb),
    'your_staff', coalesce((select jsonb_agg(jsonb_build_object('name', e.full_name, 'job', e.job_title, 'phone', e.phone,
       'active', e.active, 'id', case when e.id_last4 is not null then e.id_type || ' ending ' || e.id_last4 end,
       'next_of_kin_or_guarantor', e.kin_name)) from public.employees e where e.added_by = me.id), '[]'::jsonb),
    'fix_it_requests', coalesce((select jsonb_agg(jsonb_build_object('ref', f.ref, 'category', f.category, 'description', f.description,
       'status', f.status, 'created_at', f.created_at)) from public.fixit_requests f where f.raised_by = me.id), '[]'::jsonb),
    'sos_alerts', coalesce((select jsonb_agg(jsonb_build_object('at', s.created_at, 'status', s.status))
       from public.sos_alerts s where s.raised_by = me.id), '[]'::jsonb),
    'inbox', coalesce((select jsonb_agg(jsonb_build_object('at', n.created_at, 'title', n.title, 'body', n.body) order by n.created_at desc)
       from public.notifications n where n.recipient_id = me.id), '[]'::jsonb)
  );
end; $$;
grant execute on function public.my_data_export() to authenticated;

-- =====================================================================
-- RETENTION: old data is deleted every night
-- =====================================================================
create or replace function public.apply_retention()
returns jsonb language plpgsql security definer set search_path = public as $$
declare n_logs int; n_codes int; n_notes int; n_people int; n_staff int; n_inc int; n_shift int; n_audit int;
begin
  delete from public.gate_logs where scanned_at < now() - interval '24 months';
  get diagnostics n_logs = row_count;

  -- old visitor codes no longer referenced by the gate log
  delete from public.access_codes c
   where c.type <> 'employee' and c.created_at < now() - interval '24 months'
     and coalesce(c.valid_to, c.created_at) < now() - interval '24 months'
     and not exists (select 1 from public.gate_logs g where g.code_id = c.id);
  get diagnostics n_codes = row_count;

  delete from public.notifications where created_at < now() - interval '12 months';
  get diagnostics n_notes = row_count;

  delete from public.incidents where created_at < now() - interval '24 months';
  get diagnostics n_inc = row_count;
  delete from public.guard_shifts where started_at < now() - interval '24 months';
  get diagnostics n_shift = row_count;
  delete from public.audit_log where at < now() - interval '24 months';
  get diagnostics n_audit = row_count;

  -- people who left (or were declined) more than 90 days ago: personal details removed
  update public.profiles
     set full_name = case when role = 'guard' then 'Former guard' else 'Former resident' end,
         phone = null, email = null, nok_name = null, nok_phone = null, nok_relationship = null, relation = null,
         anonymised_at = now()
   where anonymised_at is null and role in ('resident','guard') and (
         (status = 'moved_out' and moved_out_at < now() - interval '90 days')
      or (status = 'declined' and created_at < now() - interval '90 days'));
  get diagnostics n_people = row_count;
  delete from public.push_subscriptions s using public.profiles p
   where p.id = s.user_id and p.anonymised_at is not null;
  delete from public.sos_alerts where created_at < now() - interval '24 months';
  update public.sos_alerts set phone = null where phone is not null and created_at < now() - interval '90 days';

  -- staff removed more than 90 days ago
  update public.employees set full_name = 'Former staff', phone = null
   where not active and removed_at < now() - interval '90 days' and full_name <> 'Former staff';
  get diagnostics n_staff = row_count;
  update public.access_codes c set holder_name = 'Former staff'
    from public.employees e where e.id = c.employee_id and e.full_name = 'Former staff' and c.holder_name <> 'Former staff';
  delete from public.staff_invites i using public.employees e
   where e.id = i.employee_id and (not e.active or e.invite_expires_at < now());

  return jsonb_build_object('gate_logs', n_logs, 'codes', n_codes, 'inbox', n_notes, 'people', n_people,
                            'staff', n_staff, 'incidents', n_inc, 'shifts', n_shift, 'history', n_audit);
end; $$;
revoke execute on function public.apply_retention() from public, anon, authenticated;

-- Removing staff also records when (used by retention).
create or replace function public.remove_employee(p_employee_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare e public.employees; is_em boolean := public.auth_role() = 'estate_manager';
begin
  if not is_em and public.auth_role() is distinct from 'resident' then raise exception 'Not allowed'; end if;
  update public.employees
     set active = false, removed_at = now(), photo = null, id_type = null, id_last4 = null, kin_kind = null, kin_name = null,
         kin_phone = null, kin_relation = null, invite_expires_at = null
   where id = p_employee_id and active and (is_em or added_by = auth.uid()) returning * into e;
  if not found then raise exception 'Staff member not found'; end if;
  delete from public.staff_invites where employee_id = e.id;
  update public.access_codes set active = false, changed_by = auth.uid(), changed_at = now()
   where employee_id = e.id and active;
end; $$;

-- ---------- nightly jobs (Lagos 00:15 = 23:15 UTC) ----------
create extension if not exists pg_cron;
do $$ begin
  perform cron.unschedule('move-outs') where exists (select 1 from cron.job where jobname = 'move-outs');
  perform cron.schedule('move-outs', '15 23 * * *', 'select public.process_move_outs()');
  perform cron.unschedule('retention') where exists (select 1 from cron.job where jobname = 'retention');
  perform cron.schedule('retention', '45 23 * * *', 'select public.apply_retention()');
end $$;
