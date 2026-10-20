-- Piece 19: fingerprint / Face ID sign-in (passkeys) and more than one Estate Manager.
--
-- Passkeys: a phone keeps a private key that only unlocks with the owner's fingerprint or face.
-- We store only the PUBLIC key, so nothing stored here can be used to sign in.
-- An Estate Manager signing in with a passkey has proved two things (this phone + their fingerprint),
-- so that sign-in counts as the two-step sign-in, the same as password + authenticator code.
-- Safe to run more than once.

-- ---------- passkeys (one row per phone per person) ----------
create table if not exists public.passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  credential_id text not null unique,          -- base64url, chosen by the phone
  public_key text not null,                    -- base64url COSE public key (not secret)
  counter bigint not null default 0,
  transports text[],
  device_name text check (device_name is null or char_length(device_name) <= 60),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists passkeys_user_idx on public.passkeys (user_id);
alter table public.passkeys enable row level security;
revoke all on public.passkeys from anon, authenticated;
grant select (id, user_id, device_name, created_at, last_used_at) on public.passkeys to authenticated;
drop policy if exists "own passkeys" on public.passkeys;
create policy "own passkeys" on public.passkeys for select to authenticated
  using (user_id = auth.uid() or public.auth_role() = 'estate_manager');

-- One-time challenges for the fingerprint check (server only).
create table if not exists public.passkey_challenges (
  id uuid primary key default gen_random_uuid(),
  challenge text not null,
  user_id uuid references public.profiles(id) on delete cascade,
  purpose text not null check (purpose in ('register','login')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '5 minutes',
  used_at timestamptz
);
alter table public.passkey_challenges enable row level security;
revoke all on public.passkey_challenges from anon, authenticated;

-- Sign-ins made with a passkey (server only). For an Estate Manager these count as two-step.
create table if not exists public.strong_sessions (
  session_id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.strong_sessions enable row level security;
revoke all on public.strong_sessions from anon, authenticated;

create or replace function public.is_strong_session() returns boolean
language sql security definer set search_path = public stable as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or exists (select 1 from public.strong_sessions s
                  where s.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid and s.user_id = auth.uid())
$$;
grant execute on function public.is_strong_session() to authenticated;

-- The caller's role (unchanged rules, plus: a manager's passkey sign-in counts as two-step).
create or replace function public.auth_role()
returns text language sql security definer set search_path = public stable as $$
  select case
           when p.sessions_revoked_at is not null
                and coalesce((auth.jwt() ->> 'iat')::bigint, 0) < extract(epoch from p.sessions_revoked_at)::bigint then null
           when p.role = 'estate_manager' and not public.is_strong_session() then null
           else p.role
         end
    from public.profiles p
   where p.id = auth.uid() and p.status = 'active'
$$;

-- Remove one of my passkeys (or, for the Estate Manager, anyone's: e.g. a lost phone).
create or replace function public.remove_passkey(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare k public.passkeys; v_name text;
begin
  select * into k from public.passkeys where id = p_id;
  if k.id is null then raise exception 'Not found'; end if;
  if k.user_id <> auth.uid() and public.auth_role() is distinct from 'estate_manager' then raise exception 'Not allowed'; end if;
  delete from public.passkeys where id = p_id;
  if k.user_id <> auth.uid() then
    select full_name into v_name from public.profiles where id = k.user_id;
    insert into public.audit_log (actor_id, actor_name, actor_role, action, target)
    select auth.uid(), full_name, 'estate_manager', 'Removed a fingerprint sign-in', v_name || coalesce(' (' || k.device_name || ')', '') from public.profiles where id = auth.uid();
  end if;
end; $$;
revoke execute on function public.remove_passkey(uuid) from public, anon;
grant execute on function public.remove_passkey(uuid) to authenticated;

-- When someone is signed out everywhere, their passkey sign-ins are no longer "strong" either.
create or replace function public.clear_strong_sessions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.sessions_revoked_at is distinct from old.sessions_revoked_at or new.status <> 'active' then
    delete from public.strong_sessions where user_id = new.id;
  end if;
  return new;
end; $$;
drop trigger if exists profiles_clear_strong on public.profiles;
create trigger profiles_clear_strong after update of sessions_revoked_at, status on public.profiles
  for each row execute function public.clear_strong_sessions();

-- ---------- more than one Estate Manager ----------
-- Pause / re-activate another Estate Manager. There must always be at least one active.
create or replace function public.set_manager_status(p_person uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
declare t public.profiles;
begin
  if public.auth_role() is distinct from 'estate_manager' then raise exception 'Only an Estate Manager can do this'; end if;
  if p_person = auth.uid() then raise exception 'You cannot change your own account'; end if;
  select * into t from public.profiles where id = p_person and role = 'estate_manager';
  if t.id is null then raise exception 'Estate Manager not found'; end if;
  if not p_active and (select count(*) from public.profiles where role = 'estate_manager' and status = 'active' and id <> p_person) < 1 then
    raise exception 'There must always be at least one active Estate Manager';
  end if;
  update public.profiles set status = case when p_active then 'active' else 'suspended' end where id = t.id;
  if not p_active then perform public.revoke_user_sessions(t.id); end if;
  -- (the change is written to the action history by the existing profiles trigger)
end; $$;
revoke execute on function public.set_manager_status(uuid, boolean) from public, anon;
grant execute on function public.set_manager_status(uuid, boolean) to authenticated;

-- Server-only: clean old challenges with the nightly retention job.
create or replace function public.clean_passkey_challenges() returns void
language sql security definer set search_path = public as $$
  delete from public.passkey_challenges where expires_at < now() - interval '1 day';
  delete from public.strong_sessions s where not exists (select 1 from auth.sessions a where a.id = s.session_id);
$$;
revoke execute on function public.clean_passkey_challenges() from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'passkey-cleanup';
    perform cron.schedule('passkey-cleanup', '15 3 * * *', 'select public.clean_passkey_challenges()');
  end if;
end $$;
