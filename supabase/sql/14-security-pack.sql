-- 14) Security pack: Estate Manager two-step sign-in, sign out everywhere, household members.
-- Run this AFTER the matching app update is live (the app must already offer the authenticator step).

-- ---------- profiles: household + session columns ----------
alter table public.profiles add column if not exists household_role text not null default 'primary'
  check (household_role in ('primary','member'));
alter table public.profiles add column if not exists member_of uuid references public.profiles(id);
alter table public.profiles add column if not exists member_no int;
alter table public.profiles add column if not exists relation text check (relation is null or char_length(relation) <= 40);
alter table public.profiles add column if not exists sessions_revoked_at timestamptz;

-- One MAIN resident per unit; household members get their own numbers in that unit.
drop index if exists public.one_resident_per_unit;
create unique index if not exists one_primary_per_unit
  on public.profiles (house_number, house_unit) where role = 'resident' and household_role = 'primary';
create unique index if not exists one_member_number_per_unit
  on public.profiles (house_number, house_unit, member_no) where role = 'resident' and household_role = 'member';

-- New alert type for household changes.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('announcement','code_in','code_out','code_refused','code_switched_off','approved','sos',
                  'code_expiring','code_changed','code_created_for_you','security','fixit','household'));

-- ---------- the role check behind every rule ----------
-- Returns the caller's role only if: the account is active, their devices were not signed out after
-- this token was issued, and (for the Estate Manager) the sign-in was confirmed with the authenticator code.
create or replace function public.auth_role()
returns text language sql security definer set search_path = public stable as $$
  select case
           when p.sessions_revoked_at is not null
                and coalesce((auth.jwt() ->> 'iat')::bigint, 0) < extract(epoch from p.sessions_revoked_at)::bigint then null
           when p.role = 'estate_manager' and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then null
           else p.role
         end
    from public.profiles p
   where p.id = auth.uid() and p.status = 'active'
$$;

-- Is this sign-in still good? (The app checks this and signs out cleanly if not.)
create or replace function public.session_ok()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.status = 'active'
       and (p.sessions_revoked_at is null
            or coalesce((auth.jwt() ->> 'iat')::bigint, 0) >= extract(epoch from p.sessions_revoked_at)::bigint)
  )
$$;
grant execute on function public.session_ok() to authenticated;

-- ---------- sign out everywhere ----------
-- Estate Manager (or the server, or the main resident for their own household member) signs a person out of every device.
create or replace function public.revoke_user_sessions(p_user uuid)
returns boolean language plpgsql security definer set search_path = public, auth as $$
declare t public.profiles; caller public.profiles; ok boolean := true;
begin
  select * into t from public.profiles where id = p_user;
  if t.id is null then raise exception 'Person not found'; end if;
  select * into caller from public.profiles where id = auth.uid();
  -- coalesce(..., false) everywhere: an unknown value must never count as "allowed".
  if not (coalesce(auth.role() = 'service_role', false)
          or coalesce(public.auth_role() = 'estate_manager', false)
          or coalesce(caller.role = 'resident' and caller.household_role = 'primary' and caller.status = 'active'
                      and t.member_of = caller.id, false)) then
    raise exception 'Not allowed';
  end if;
  update public.profiles set sessions_revoked_at = now() where id = p_user;
  begin
    delete from auth.sessions where user_id = p_user;          -- ends refresh, so no new tokens
  exception when others then ok := false;                     -- still blocked by the check above
  end;
  return ok;
end; $$;
grant execute on function public.revoke_user_sessions(uuid) to authenticated;

-- ---------- household members ----------
-- Everyone active in my house (main resident first). Only for residents of that house.
create or replace function public.my_household()
returns table (id uuid, full_name text, relation text, household_role text, member_no int, status text, phone text, is_me boolean)
language sql security definer set search_path = public stable as $$
  select p.id, p.full_name, p.relation, p.household_role, p.member_no, p.status, p.phone, p.id = auth.uid()
    from public.profiles p, public.profiles me
   where me.id = auth.uid() and me.role = 'resident' and me.status = 'active'
     and p.role = 'resident' and p.house_number = me.house_number and p.house_unit = me.house_unit
     and p.status in ('active','suspended')
     and (p.household_role = 'primary' or p.status = 'active' or me.household_role = 'primary')
   order by (p.household_role = 'primary') desc, p.member_no
$$;
grant execute on function public.my_household() to authenticated;

-- The Estate Manager's "create a code for a house" goes to the house's main resident.
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
   where role = 'resident' and status = 'active' and household_role = 'primary'
     and house_number = p_house_number and house_unit = p_house_unit;
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

-- ---------- safety fixes ----------
-- These checks used "<>"/"not in", which let an account with NO valid role through
-- (e.g. suspended, signed out everywhere, or a manager who skipped the authenticator step).
create or replace function public.acknowledge_sos(p_id uuid)
returns public.sos_alerts language plpgsql security definer set search_path = public as $$
declare v public.sos_alerts; nm text;
begin
  if coalesce(public.auth_role(), '') not in ('guard','estate_manager') then
    raise exception 'Only guards and the Estate Manager can acknowledge SOS';
  end if;
  select coalesce(case when role = 'guard' then 'Guard ' || guard_number else full_name end, full_name)
    into nm from public.profiles where id = auth.uid();
  update public.sos_alerts set status = 'acknowledged', acknowledged_by = auth.uid(),
         acknowledged_by_name = nm, acknowledged_at = now()
   where id = p_id and status = 'active' returning * into v;
  if not found then
    select * into v from public.sos_alerts where id = p_id;
    if not found then raise exception 'SOS not found'; end if;
  end if;
  return v;
end; $$;

create or replace function public.close_sos(p_id uuid, p_outcome text)
returns public.sos_alerts language plpgsql security definer set search_path = public as $$
declare v public.sos_alerts;
begin
  if coalesce(public.auth_role(), '') not in ('guard','estate_manager') then
    raise exception 'Only guards and the Estate Manager can close SOS';
  end if;
  if p_outcome not in ('resolved','false_alarm') then raise exception 'Outcome must be resolved or false_alarm'; end if;
  update public.sos_alerts set status = p_outcome, closed_by = auth.uid(), closed_at = now(),
         acknowledged_by = coalesce(acknowledged_by, auth.uid()), acknowledged_at = coalesce(acknowledged_at, now())
   where id = p_id and status in ('active','acknowledged') returning * into v;
  if not found then raise exception 'This SOS is already closed'; end if;
  return v;
end; $$;

create or replace function public.set_fixit_status(p_id uuid, p_status text, p_note text default null)
returns public.fixit_requests
language plpgsql security definer set search_path = public as $$
declare r public.fixit_requests;
begin
  if public.auth_role() is distinct from 'estate_manager' then raise exception 'Only the Estate Manager can do this'; end if;
  if p_status not in ('open','in_progress','done') then raise exception 'Unknown status'; end if;
  update public.fixit_requests
     set status = p_status,
         manager_note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), manager_note),
         updated_at = now()
   where id = p_id
  returning * into r;
  if r.id is null then raise exception 'Request not found'; end if;
  return r;
end; $$;
