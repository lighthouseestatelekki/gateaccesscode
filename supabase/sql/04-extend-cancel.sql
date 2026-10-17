-- Piece 4: residents extend or cancel their OWN Guest codes.
-- Residents have no direct update rights on access_codes; these two narrow functions are the only way.

create or replace function public.cancel_my_code(p_code_id uuid)
returns public.access_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.access_codes;
begin
  if not exists (select 1 from public.profiles
                  where id = auth.uid() and role = 'resident' and status = 'active') then
    raise exception 'Only active residents can change codes';
  end if;
  update public.access_codes
     set active = false, changed_by = auth.uid(), changed_at = now()
   where id = p_code_id and issued_by = auth.uid() and type = 'guest'
     and active and used_at is null
  returning * into v_row;
  if not found then
    raise exception 'This code cannot be cancelled (it may already be used, cancelled or not yours)';
  end if;
  return v_row;
end;
$$;

create or replace function public.extend_my_code(p_code_id uuid, p_valid_to timestamptz)
returns public.access_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.access_codes;
begin
  if not exists (select 1 from public.profiles
                  where id = auth.uid() and role = 'resident' and status = 'active') then
    raise exception 'Only active residents can change codes';
  end if;
  if p_valid_to is null or p_valid_to <= now() then
    raise exception 'New expiry must be in the future';
  end if;
  update public.access_codes
     set valid_to = p_valid_to, changed_by = auth.uid(), changed_at = now()
   where id = p_code_id and issued_by = auth.uid() and type = 'guest'
     and active and used_at is null
  returning * into v_row;
  if not found then
    raise exception 'This code cannot be extended (it may already be used, cancelled or not yours)';
  end if;
  return v_row;
end;
$$;

revoke execute on function public.cancel_my_code(uuid) from public, anon;
revoke execute on function public.extend_my_code(uuid, timestamptz) from public, anon;
grant execute on function public.cancel_my_code(uuid) to authenticated;
grant execute on function public.extend_my_code(uuid, timestamptz) to authenticated;
