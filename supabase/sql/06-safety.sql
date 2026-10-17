-- Piece 6: go-live safety
-- 1) Wrong-PIN counter per login. Only the server (Edge Function with the service key) can touch it.
create table if not exists public.login_attempts (
  login text primary key,             -- the internal login email, e.g. house14-main@residents...
  fails int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.login_attempts enable row level security;
-- (no policies on purpose: signed-in users and visitors cannot read or change it)

-- 2) Registration now goes through the server function, so residents no longer insert profiles directly.
drop policy if exists "resident registers" on public.profiles;

-- 3) Estate Manager can switch off any code (e.g. from the gate log).
create or replace function public.manager_switch_off_code(p_code_id uuid)
returns public.access_codes
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.access_codes;
begin
  if public.auth_role() is distinct from 'estate_manager' then
    raise exception 'Only the Estate Manager can switch off codes';
  end if;
  update public.access_codes
     set active = false, changed_by = auth.uid(), changed_at = now()
   where id = p_code_id and active
  returning * into v_row;
  if not found then
    raise exception 'This code is already switched off';
  end if;
  return v_row;
end;
$$;
revoke execute on function public.manager_switch_off_code(uuid) from public, anon;
grant execute on function public.manager_switch_off_code(uuid) to authenticated;
