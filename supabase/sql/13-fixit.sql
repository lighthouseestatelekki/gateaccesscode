-- 13) Fix-It requests: residents report estate problems (with an optional photo),
-- the Estate Manager tracks them Open -> In progress -> Done, and the resident is told at each step.

create table if not exists public.fixit_requests (
  id uuid primary key default gen_random_uuid(),
  ref bigint generated always as identity,          -- friendly number, e.g. #12
  raised_by uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  house_number text not null,
  house_unit text not null,
  category text not null check (category in ('streetlight','drainage','water','power','road','waste','security','other')),
  description text not null check (char_length(description) between 5 and 1000),
  location text check (location is null or char_length(location) <= 200),
  photo_path text,
  status text not null default 'open' check (status in ('open','in_progress','done')),
  manager_note text check (manager_note is null or char_length(manager_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fixit_status_idx on public.fixit_requests (status, created_at desc);
create index if not exists fixit_raised_by_idx on public.fixit_requests (raised_by, created_at desc);
alter table public.fixit_requests enable row level security;

drop policy if exists "resident reads own fixit" on public.fixit_requests;
create policy "resident reads own fixit" on public.fixit_requests
  for select to authenticated using (raised_by = auth.uid());
drop policy if exists "estate manager reads all fixit" on public.fixit_requests;
create policy "estate manager reads all fixit" on public.fixit_requests
  for select to authenticated using (public.auth_role() = 'estate_manager');
-- No insert/update policies: changes go through the two functions below.

-- New alert type.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('announcement','code_in','code_out','code_refused','code_switched_off','approved','sos',
                  'code_expiring','code_changed','code_created_for_you','security','fixit'));

-- Resident reports a problem. House and name come from their profile, never from the form.
create or replace function public.report_fixit(p_category text, p_description text, p_location text default null, p_photo_path text default null)
returns public.fixit_requests
language plpgsql security definer set search_path = public as $$
declare me public.profiles; r public.fixit_requests;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null or me.role <> 'resident' or me.status <> 'active' then
    raise exception 'Only active residents can report a problem';
  end if;
  if (select count(*) from public.fixit_requests where raised_by = me.id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'You have reported 10 problems today. Please try again tomorrow.';
  end if;
  if p_photo_path is not null and split_part(p_photo_path, '/', 1) <> me.id::text then
    raise exception 'Photo not allowed';
  end if;
  insert into public.fixit_requests (raised_by, full_name, house_number, house_unit, category, description, location, photo_path)
  values (me.id, me.full_name, me.house_number, me.house_unit, p_category, btrim(p_description), nullif(btrim(coalesce(p_location, '')), ''), p_photo_path)
  returning * into r;
  return r;
end; $$;

-- Estate Manager moves a request along, with an optional note the resident sees.
create or replace function public.set_fixit_status(p_id uuid, p_status text, p_note text default null)
returns public.fixit_requests
language plpgsql security definer set search_path = public as $$
declare r public.fixit_requests;
begin
  if public.auth_role() <> 'estate_manager' then raise exception 'Only the Estate Manager can do this'; end if;
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

-- Alerts: new request -> every Estate Manager; status change -> the resident.
create or replace function public.notify_fixit()
returns trigger language plpgsql security definer set search_path = public as $$
declare label text;
begin
  label := initcap(replace(new.category, '_', ' '));
  if tg_op = 'INSERT' then
    insert into public.notifications (recipient_id, kind, title, body, link)
    select p.id, 'fixit', 'New Fix-It #' || new.ref || ': ' || label,
           'House ' || new.house_number || ' · ' || left(new.description, 140), '/manager/fixit'
      from public.profiles p where p.role = 'estate_manager' and p.status = 'active';
  elsif new.status is distinct from old.status then
    insert into public.notifications (recipient_id, kind, title, body, link)
    values (new.raised_by, 'fixit',
            'Fix-It #' || new.ref || ' ' || case new.status when 'in_progress' then 'is being worked on' when 'done' then 'is done' else 'was reopened' end,
            coalesce(new.manager_note, label || ': ' || left(new.description, 120)), '/fixit');
  end if;
  return new;
end; $$;
drop trigger if exists fixit_notify on public.fixit_requests;
create trigger fixit_notify after insert or update on public.fixit_requests
  for each row execute function public.notify_fixit();

grant select on public.fixit_requests to authenticated;
grant execute on function public.report_fixit(text, text, text, text) to authenticated;
grant execute on function public.set_fixit_status(uuid, text, text) to authenticated;

-- ---------- Photos (Supabase Storage) ----------
-- A private "fixit" bucket. Residents upload into a folder named after themselves;
-- they see their own photos, the Estate Manager sees all. Max 5 MB, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fixit', 'fixit', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "fixit residents upload own photos" on storage.objects;
create policy "fixit residents upload own photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fixit' and (storage.foldername(name))[1] = auth.uid()::text and public.auth_role() = 'resident');
drop policy if exists "fixit read own or manager" on storage.objects;
create policy "fixit read own or manager" on storage.objects
  for select to authenticated
  using (bucket_id = 'fixit' and ((storage.foldername(name))[1] = auth.uid()::text or public.auth_role() = 'estate_manager'));
