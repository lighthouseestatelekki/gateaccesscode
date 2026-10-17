-- Piece 7: in-app inbox, announcements and SOS.

-- ========== Inbox ==========
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('announcement','code_in','code_out','code_refused','code_switched_off','approved','sos')),
  title text not null,
  body text,
  link text,
  sos_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications
  for select to authenticated using (recipient_id = auth.uid());

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.notifications set read_at = now()
   where recipient_id = auth.uid() and read_at is null
     and (p_ids is null or id = any(p_ids));
  get diagnostics n = row_count;
  return n;
end; $$;

-- ========== Announcements (to residents only) ==========
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 120),
  body text not null check (length(trim(body)) between 1 and 2000),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  recipients int not null default 0
);
alter table public.announcements enable row level security;
drop policy if exists "estate manager reads announcements" on public.announcements;
create policy "estate manager reads announcements" on public.announcements
  for select to authenticated using (public.auth_role() = 'estate_manager');

create or replace function public.post_announcement(p_title text, p_body text)
returns public.announcements language plpgsql security definer set search_path = public as $$
declare v public.announcements; n int;
begin
  if public.auth_role() is distinct from 'estate_manager' then
    raise exception 'Only the Estate Manager can send announcements';
  end if;
  insert into public.announcements (title, body, created_by)
  values (trim(p_title), trim(p_body), auth.uid()) returning * into v;
  insert into public.notifications (recipient_id, kind, title, body, link)
  select id, 'announcement', v.title, v.body, '/inbox'
    from public.profiles where role = 'resident' and status = 'active';
  get diagnostics n = row_count;
  update public.announcements set recipients = n where id = v.id returning * into v;
  return v;
end; $$;

-- ========== Code activity -> tell the resident who issued the code ==========
create or replace function public.notify_code_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare c public.access_codes; t text; k text; b text;
begin
  if new.code_id is null then return new; end if;
  select * into c from public.access_codes where id = new.code_id;
  if not found then return new; end if;
  if new.result = 'access' and new.direction = 'in' then
    k := 'code_in';  t := c.holder_name || ' has arrived';
    b := 'Entered at Gate ' || new.gate || ' using code ' || c.code || '.';
  elsif new.result = 'access' and new.direction = 'out' then
    k := 'code_out'; t := c.holder_name || ' has left';
    b := 'Exited at Gate ' || new.gate || '. Code ' || c.code || ' is now used.';
  else
    k := 'code_refused'; t := c.holder_name || '''s code was refused';
    b := 'At Gate ' || new.gate || ': ' || coalesce(new.reason, 'not accepted') || '.';
  end if;
  insert into public.notifications (recipient_id, kind, title, body, link)
  values (c.issued_by, k, t, b, '/home');
  return new;
end; $$;
drop trigger if exists gate_logs_notify on public.gate_logs;
create trigger gate_logs_notify after insert on public.gate_logs
  for each row execute function public.notify_code_activity();

-- Estate Manager switched a resident's code off -> tell the resident
create or replace function public.notify_code_switched_off()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.active and not new.active and new.changed_by is distinct from new.issued_by then
    insert into public.notifications (recipient_id, kind, title, body, link)
    values (new.issued_by, 'code_switched_off', 'Code ' || new.code || ' was switched off',
            'The Estate Manager switched off the code for ' || new.holder_name || '.', '/home');
  end if;
  return new;
end; $$;
drop trigger if exists access_codes_switched_off on public.access_codes;
create trigger access_codes_switched_off after update of active on public.access_codes
  for each row execute function public.notify_code_switched_off();

-- Registration approved -> welcome message
create or replace function public.notify_approved()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'resident' and old.status = 'pending' and new.status = 'active' then
    insert into public.notifications (recipient_id, kind, title, body, link)
    values (new.id, 'approved', 'Your registration is approved',
            'JazakAllahu Khairan. You can now create access codes for your visitors.', '/home');
  end if;
  return new;
end; $$;
drop trigger if exists profiles_approved on public.profiles;
create trigger profiles_approved after update of status on public.profiles
  for each row execute function public.notify_approved();

-- ========== SOS ==========
create table if not exists public.sos_alerts (
  id uuid primary key default gen_random_uuid(),
  raised_by uuid not null references public.profiles(id),
  full_name text not null,
  phone text,
  house_number text not null,
  house_unit text not null,
  status text not null default 'active' check (status in ('active','acknowledged','resolved','false_alarm')),
  created_at timestamptz not null default now(),
  acknowledged_by uuid references public.profiles(id),
  acknowledged_by_name text,
  acknowledged_at timestamptz,
  closed_by uuid references public.profiles(id),
  closed_at timestamptz
);
create index if not exists sos_open_idx on public.sos_alerts (status, created_at desc);
alter table public.sos_alerts enable row level security;
drop policy if exists "everyone active reads sos" on public.sos_alerts;
create policy "everyone active reads sos" on public.sos_alerts
  for select to authenticated using (public.auth_role() is not null);

create or replace function public.raise_sos()
returns public.sos_alerts language plpgsql security definer set search_path = public as $$
declare me public.profiles; v public.sos_alerts;
begin
  select * into me from public.profiles where id = auth.uid() and role = 'resident' and status = 'active';
  if not found then raise exception 'Only active residents can send SOS'; end if;
  -- one open alert per person: pressing again does not spam everyone
  select * into v from public.sos_alerts where raised_by = me.id and status in ('active','acknowledged')
   order by created_at desc limit 1;
  if found then return v; end if;
  insert into public.sos_alerts (raised_by, full_name, phone, house_number, house_unit)
  values (me.id, me.full_name, me.phone, me.house_number, me.house_unit) returning * into v;
  insert into public.notifications (recipient_id, kind, title, body, link, sos_id)
  select p.id, 'sos', 'SOS: House ' || v.house_number,
         v.full_name || coalesce(' · ' || v.phone, '') || ' needs help now.', '/sos', v.id
    from public.profiles p where p.status = 'active' and p.id <> me.id;
  return v;
end; $$;

create or replace function public.acknowledge_sos(p_id uuid)
returns public.sos_alerts language plpgsql security definer set search_path = public as $$
declare v public.sos_alerts; nm text;
begin
  if public.auth_role() not in ('guard','estate_manager') then
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
  if public.auth_role() not in ('guard','estate_manager') then
    raise exception 'Only guards and the Estate Manager can close SOS';
  end if;
  if p_outcome not in ('resolved','false_alarm') then raise exception 'Outcome must be resolved or false_alarm'; end if;
  update public.sos_alerts set status = p_outcome, closed_by = auth.uid(), closed_at = now(),
         acknowledged_by = coalesce(acknowledged_by, auth.uid()), acknowledged_at = coalesce(acknowledged_at, now())
   where id = p_id and status in ('active','acknowledged') returning * into v;
  if not found then raise exception 'This SOS is already closed'; end if;
  return v;
end; $$;

-- The resident who raised it may call it off themselves (pressed by mistake).
create or replace function public.cancel_my_sos(p_id uuid)
returns public.sos_alerts language plpgsql security definer set search_path = public as $$
declare v public.sos_alerts;
begin
  update public.sos_alerts set status = 'false_alarm', closed_by = auth.uid(), closed_at = now()
   where id = p_id and raised_by = auth.uid() and status in ('active','acknowledged') returning * into v;
  if not found then raise exception 'This SOS is already closed'; end if;
  return v;
end; $$;

-- permissions
do $$ declare f text; begin
  foreach f in array array['mark_notifications_read(uuid[])','post_announcement(text,text)','raise_sos()',
                           'acknowledge_sos(uuid)','close_sos(uuid,text)','cancel_my_sos(uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.notify_code_activity() from public, anon, authenticated;
revoke execute on function public.notify_code_switched_off() from public, anon, authenticated;
revoke execute on function public.notify_approved() from public, anon, authenticated;

-- Live updates in the app (Supabase Realtime still applies the read rules above)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.sos_alerts; exception when duplicate_object then null; end;
  end if;
end $$;
