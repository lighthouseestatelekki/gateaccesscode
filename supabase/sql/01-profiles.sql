-- Lighthouse Lekki v1 — Piece 1: profiles table, helper, security rules

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('resident','guard','estate_manager')),
  full_name text not null,
  phone text,
  email text,
  house_number text,
  house_unit text check (house_unit in ('main','ground','upper','chalet','boys')),
  status text not null default 'pending'
    check (status in ('pending','active','suspended','declined')),
  guard_number text,
  assigned_gate int check (assigned_gate in (1,2)),
  nok_name text,
  nok_phone text,
  nok_relationship text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint resident_has_house
    check (role <> 'resident' or (house_number is not null and house_unit is not null)),
  constraint guard_has_number
    check (role <> 'guard' or (guard_number is not null and assigned_gate is not null))
);

create unique index one_resident_per_unit
  on public.profiles (house_number, house_unit) where role = 'resident';

create unique index one_guard_per_number
  on public.profiles (guard_number) where role = 'guard';

-- Returns the caller's role, but ONLY if their account is active.
create or replace function public.auth_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid() and status = 'active'
$$;

alter table public.profiles enable row level security;

create policy "read own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "estate manager reads all profiles"
  on public.profiles for select to authenticated
  using (public.auth_role() = 'estate_manager');

create policy "resident registers"
  on public.profiles for insert to authenticated
  with check (id = auth.uid() and role = 'resident'
              and status = 'pending' and created_by is null);

create policy "estate manager creates staff"
  on public.profiles for insert to authenticated
  with check (public.auth_role() = 'estate_manager'
              and role in ('guard','estate_manager')
              and created_by = auth.uid());

create policy "estate manager updates profiles"
  on public.profiles for update to authenticated
  using (public.auth_role() = 'estate_manager')
  with check (public.auth_role() = 'estate_manager');
