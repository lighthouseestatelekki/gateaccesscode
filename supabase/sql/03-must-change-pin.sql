-- Piece 3: "must change PIN" flag (for forgotten-PIN resets)
-- Estate Manager resets a PIN -> the reset sets must_change_pin = true.
-- The resident signs in with the temporary PIN, is sent to the change-PIN screen,
-- and the app calls clear_must_change_pin() after the new PIN is saved.

alter table public.profiles
  add column if not exists must_change_pin boolean not null default false;

-- Residents and guards have no update rights on profiles (only the Estate Manager does),
-- so the user clears their OWN flag through this one narrow function.
create or replace function public.clear_must_change_pin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  update public.profiles
     set must_change_pin = false
   where id = auth.uid();
end;
$$;

revoke execute on function public.clear_must_change_pin() from public, anon;
grant execute on function public.clear_must_change_pin() to authenticated;
