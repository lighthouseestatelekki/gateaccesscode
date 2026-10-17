-- Piece 5: Estate Manager "Today" numbers.
-- codes_today  = access codes created since midnight Lagos time
-- inside_now   = codes whose most recent successful gate scan was IN
create or replace function public.manager_today_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_start timestamptz := (date_trunc('day', now() at time zone 'Africa/Lagos')) at time zone 'Africa/Lagos';
  v_codes int;
  v_inside int;
begin
  if public.auth_role() is distinct from 'estate_manager' then
    raise exception 'Only the Estate Manager can see this';
  end if;
  select count(*) into v_codes from public.access_codes where created_at >= v_start;
  select count(*) into v_inside from (
    select distinct on (code_id) code_id, direction
      from public.gate_logs
     where result = 'access' and code_id is not null
     order by code_id, scanned_at desc
  ) last where last.direction = 'in';
  return jsonb_build_object('codes_today', v_codes, 'inside_now', v_inside);
end;
$$;

revoke execute on function public.manager_today_stats() from public, anon;
grant execute on function public.manager_today_stats() to authenticated;
