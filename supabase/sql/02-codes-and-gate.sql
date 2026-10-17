-- Lighthouse Lekki v1 — Piece 2: access codes, gate log, create + verify functions

create table public.access_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[0-9]{6}$'),
  type text not null check (type in ('guest','long_stay','employee')),
  issued_by uuid not null references public.profiles(id),
  house_number text not null,
  house_unit text not null,
  holder_name text not null,
  employee_id uuid,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  days_of_week int[],
  start_time time,
  end_time time,
  days_of_month int[],
  active boolean not null default true,
  used_at timestamptz,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.gate_logs (
  id uuid primary key default gen_random_uuid(),
  code_id uuid references public.access_codes(id),
  attempted_code text not null,
  gate int not null check (gate in (1,2)),
  direction text check (direction in ('in','out')),
  result text not null check (result in ('access','expired','denied')),
  reason text,
  guard_id uuid not null references public.profiles(id),
  scanned_at timestamptz not null default now(),
  night_access boolean not null default false
);

create index gate_logs_scanned_at_idx on public.gate_logs (scanned_at);
create index gate_logs_code_idx on public.gate_logs (code_id, scanned_at);

alter table public.access_codes enable row level security;
alter table public.gate_logs enable row level security;

create policy "resident reads own codes"
  on public.access_codes for select to authenticated
  using (public.auth_role() = 'resident' and issued_by = auth.uid());

create policy "estate manager reads all codes"
  on public.access_codes for select to authenticated
  using (public.auth_role() = 'estate_manager');

create policy "estate manager reads gate log"
  on public.gate_logs for select to authenticated
  using (public.auth_role() = 'estate_manager');

-- Residents create Guest codes ONLY through this function.
create or replace function public.create_guest_code(p_holder_name text, p_valid_to timestamptz)
returns public.access_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.profiles;
  v_row public.access_codes;
  v_code text;
  v_try int := 0;
begin
  select * into v_res from public.profiles
   where id = auth.uid() and role = 'resident' and status = 'active';
  if not found then
    raise exception 'Only active residents can create codes';
  end if;
  if p_holder_name is null or length(trim(p_holder_name)) = 0 then
    raise exception 'Visitor name is required';
  end if;
  if p_valid_to is null or p_valid_to <= now() then
    raise exception 'Expiry must be in the future';
  end if;
  loop
    v_try := v_try + 1;
    v_code := lpad(
      (abs(('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))::bit(48)::bigint)
        % 1000000)::text, 6, '0');
    begin
      insert into public.access_codes
        (code, type, issued_by, house_number, house_unit, holder_name, valid_to)
      values
        (v_code, 'guest', v_res.id, v_res.house_number, v_res.house_unit,
         trim(p_holder_name), p_valid_to)
      returning * into v_row;
      return v_row;
    exception when unique_violation then
      if v_try >= 20 then
        raise exception 'Could not generate a unique code, please try again';
      end if;
    end;
  end loop;
end;
$$;

-- Guards verify a code ONLY through this function. It checks and logs in one step.
create or replace function public.verify_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guard public.profiles;
  v_code public.access_codes;
  v_found boolean := false;
  v_last text;
  v_dir text;
  v_result text;
  v_reason text;
  v_now timestamptz := now();
  v_hour int;
  v_night boolean;
begin
  select * into v_guard from public.profiles
   where id = auth.uid() and role = 'guard' and status = 'active';
  if not found then
    raise exception 'Only active guards can verify codes';
  end if;

  v_hour := extract(hour from (v_now at time zone 'Africa/Lagos'))::int;
  v_night := (v_hour >= 22 or v_hour < 5);

  select * into v_code from public.access_codes
   where code = trim(coalesce(p_code, '')) for update;
  v_found := found;

  if not v_found then
    v_result := 'denied'; v_reason := 'Code not recognised';
  elsif not v_code.active then
    v_result := 'denied'; v_reason := 'Code has been switched off';
  elsif v_code.type = 'guest' then
    if v_code.used_at is not null then
      v_result := 'expired'; v_reason := 'Guest code already used';
    elsif v_now < v_code.valid_from then
      v_result := 'denied'; v_reason := 'Code is not valid yet';
    elsif v_code.valid_to is not null and v_now > v_code.valid_to then
      v_result := 'expired'; v_reason := 'Code has expired';
    else
      v_result := 'access'; v_reason := null;
    end if;
  else
    v_result := 'denied'; v_reason := 'Code type not supported yet';
  end if;

  if v_result = 'access' then
    select direction into v_last from public.gate_logs
     where code_id = v_code.id and result = 'access'
     order by scanned_at desc limit 1;
    v_dir := case when v_last = 'in' then 'out' else 'in' end;
    if v_code.type = 'guest' and v_dir = 'out' then
      update public.access_codes set used_at = v_now where id = v_code.id;
    end if;
  end if;

  insert into public.gate_logs
    (code_id, attempted_code, gate, direction, result, reason, guard_id, scanned_at, night_access)
  values
    (case when v_found then v_code.id else null end,
     left(coalesce(p_code, ''), 20), v_guard.assigned_gate, v_dir, v_result,
     v_reason, v_guard.id, v_now, v_night);

  return jsonb_build_object(
    'result', v_result,
    'direction', v_dir,
    'reason', v_reason,
    'type', case when v_found then v_code.type else null end,
    'house', case when v_found then v_code.house_number else null end,
    'unit', case when v_found then v_code.house_unit else null end,
    'holder', case when v_found then v_code.holder_name else null end,
    'gate', v_guard.assigned_gate,
    'night_access', v_night
  );
end;
$$;

revoke execute on function public.create_guest_code(text, timestamptz) from public, anon;
revoke execute on function public.verify_code(text) from public, anon;
grant execute on function public.create_guest_code(text, timestamptz) to authenticated;
grant execute on function public.verify_code(text) to authenticated;
