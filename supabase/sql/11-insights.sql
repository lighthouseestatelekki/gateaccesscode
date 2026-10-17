-- Piece 11: analytics. Everything is counted in Lagos time. "Entries" = successful IN scans at the gate.

create or replace function public.resident_insights(p_days int default 30)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare v_days int := least(greatest(coalesce(p_days, 30), 7), 90);
        v_since timestamptz := now() - make_interval(days => v_days);
        v_today date := (now() at time zone 'Africa/Lagos')::date;
        r jsonb;
begin
  if public.auth_role() is distinct from 'resident' then raise exception 'Residents only'; end if;
  with mine as (select id, code, holder_name, type, created_at from public.access_codes where issued_by = auth.uid()),
  logs as (
    select g.*, m.holder_name, m.type, (g.scanned_at at time zone 'Africa/Lagos') as l
      from public.gate_logs g join mine m on m.id = g.code_id
     where g.scanned_at >= v_since
  )
  select jsonb_build_object(
    'days', v_days,
    'entries', (select count(*) from logs where result = 'access' and direction = 'in'),
    'refused', (select count(*) from logs where result <> 'access'),
    'codes_created', (select count(*) from mine where created_at >= v_since and type <> 'employee'),
    'staff_entries', (select count(*) from logs where result = 'access' and direction = 'in' and type = 'employee'),
    'per_day', (select jsonb_agg(jsonb_build_object('day', d::date, 'n',
                  (select count(*) from logs where result = 'access' and direction = 'in' and l::date = d::date)) order by d)
                from generate_series(v_today - 13, v_today, interval '1 day') d),
    'per_hour', (select jsonb_agg(jsonb_build_object('hour', h, 'n',
                  (select count(*) from logs where result = 'access' and direction = 'in' and extract(hour from l)::int = h)) order by h)
                 from generate_series(0, 23) h),
    'top_visitors', (select coalesce(jsonb_agg(t order by t.n desc, t.name), '[]'::jsonb) from (
                      select holder_name as name, count(*) as n from logs
                       where result = 'access' and direction = 'in' and type <> 'employee'
                       group by holder_name order by count(*) desc, holder_name limit 5) t)
  ) into r;
  return r;
end; $$;

create or replace function public.manager_insights(p_days int default 30)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare v_days int := least(greatest(coalesce(p_days, 30), 7), 90);
        v_since timestamptz := now() - make_interval(days => v_days);
        v_today date := (now() at time zone 'Africa/Lagos')::date;
        r jsonb;
begin
  if public.auth_role() is distinct from 'estate_manager' then raise exception 'Estate Manager only'; end if;
  with logs as (
    select g.*, c.house_number, c.house_unit, c.type, (g.scanned_at at time zone 'Africa/Lagos') as l
      from public.gate_logs g left join public.access_codes c on c.id = g.code_id
     where g.scanned_at >= v_since
  )
  select jsonb_build_object(
    'days', v_days,
    'entries', (select count(*) from logs where result = 'access' and direction = 'in'),
    'entries_today', (select count(*) from logs where result = 'access' and direction = 'in' and l::date = v_today),
    'refused', (select count(*) from logs where result <> 'access'),
    'night_entries', (select count(*) from logs where result = 'access' and direction = 'in' and night_access),
    'codes_created', (select count(*) from public.access_codes where created_at >= v_since and type <> 'employee'),
    'residents_active', (select count(*) from public.profiles where role = 'resident' and status = 'active'),
    'residents_pending', (select count(*) from public.profiles where role = 'resident' and status = 'pending'),
    'staff_active', (select count(*) from public.employees where active),
    'sos', (select jsonb_build_object('total', count(*),
              'resolved', count(*) filter (where status = 'resolved'),
              'false_alarm', count(*) filter (where status = 'false_alarm'),
              'open', count(*) filter (where status in ('active','acknowledged')))
            from public.sos_alerts where created_at >= v_since),
    'per_day', (select jsonb_agg(jsonb_build_object('day', d::date, 'n',
                  (select count(*) from logs where result = 'access' and direction = 'in' and l::date = d::date)) order by d)
                from generate_series(v_today - 13, v_today, interval '1 day') d),
    'per_hour', (select jsonb_agg(jsonb_build_object('hour', h, 'n',
                  (select count(*) from logs where result = 'access' and direction = 'in' and extract(hour from l)::int = h)) order by h)
                 from generate_series(0, 23) h),
    'by_type', (select jsonb_build_object(
                  'guest', count(*) filter (where type = 'guest'),
                  'long_stay', count(*) filter (where type = 'long_stay'),
                  'employee', count(*) filter (where type = 'employee'))
                from logs where result = 'access' and direction = 'in'),
    'top_houses', (select coalesce(jsonb_agg(t order by t.n desc, t.house), '[]'::jsonb) from (
                    select house_number as house, house_unit as unit, count(*) as n from logs
                     where result = 'access' and direction = 'in' and house_number is not null
                     group by house_number, house_unit order by count(*) desc, house_number limit 8) t)
  ) into r;
  return r;
end; $$;

revoke execute on function public.resident_insights(int) from public, anon;
revoke execute on function public.manager_insights(int) from public, anon;
grant execute on function public.resident_insights(int) to authenticated;
grant execute on function public.manager_insights(int) to authenticated;
