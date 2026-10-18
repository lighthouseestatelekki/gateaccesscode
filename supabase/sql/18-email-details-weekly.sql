-- 18) Richer emails: alerts carry a small "details" card (who, code, gate, time...), and a
-- weekly summary email every Monday at 7:00 AM Lagos time (each person can switch it off).
-- Run after 17.

alter table public.notifications add column if not exists details jsonb;
alter table public.profiles add column if not exists weekly_email boolean not null default true;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('announcement','code_in','code_out','code_refused','code_switched_off','approved','sos',
                  'code_expiring','code_changed','code_created_for_you','security','fixit','household','staff',
                  'incident','moving','weekly'));

create or replace function public.lagos_time(t timestamptz) returns text language sql immutable as $$
  select to_char(t at time zone 'Africa/Lagos', 'Dy DD Mon, HH12:MI AM')
$$;

-- ---------- gate activity: the visitor, code, gate and time ----------
create or replace function public.notify_code_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare c public.access_codes; t text; k text; b text; job text;
begin
  if new.code_id is null then return new; end if;
  select * into c from public.access_codes where id = new.code_id;
  if not found then return new; end if;
  if c.type = 'employee' then select job_title into job from public.employees where id = c.employee_id; end if;
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
  insert into public.notifications (recipient_id, kind, title, body, link, details)
  values (c.issued_by, k, t, b, '/home', jsonb_strip_nulls(jsonb_build_object(
    'Visitor', c.holder_name,
    'Type', case c.type when 'guest' then case when c.holder_name = 'Delivery' then 'Delivery pass' else 'One visit' end
                        when 'long_stay' then 'Long stay' when 'employee' then 'Staff' || coalesce(' · ' || job, '') else c.type end,
    'Code', substr(c.code, 1, 3) || ' ' || substr(c.code, 4, 3),
    'Gate', 'Gate ' || new.gate,
    'Time', public.lagos_time(new.scanned_at),
    'Reason', case when k = 'code_refused' then new.reason end)));
  return new;
end; $$;

-- ---------- fill in details for other alerts where we can ----------
create or replace function public.fill_notification_details()
returns trigger language plpgsql security definer set search_path = public as $$
declare s public.sos_alerts; i public.incidents; f public.fixit_requests; g public.profiles; v_ref bigint;
begin
  if new.details is not null then return new; end if;
  if new.kind = 'sos' and new.sos_id is not null then
    select * into s from public.sos_alerts where id = new.sos_id;
    if s.id is not null then
      new.details := jsonb_build_object('Resident', s.full_name,
        'House', 'House ' || s.house_number || ' · ' || public.unit_label(s.house_unit),
        'Time', public.lagos_time(s.created_at), '_phone', s.phone);
    end if;
  elsif new.kind = 'incident' then
    v_ref := nullif(substring(new.title from '#(\d+)'), '')::bigint;
    if v_ref is not null then select * into i from public.incidents where incidents.ref = v_ref; end if;
    if i.id is null then  -- the alert to the house has no number: take the newest report for it
      select * into i from public.incidents where created_at > now() - interval '1 minute' order by created_at desc limit 1;
    end if;
    if i.id is not null then
      select * into g from public.profiles where id = i.reported_by;
      new.details := jsonb_strip_nulls(jsonb_build_object('Report', '#' || i.ref || ' · ' || public.incident_label(i.category),
        'House', case when i.house_number is not null then 'House ' || i.house_number || coalesce(' · ' || public.unit_label(i.house_unit), '') end,
        'Reported by', 'Guard ' || g.guard_number || ', Gate ' || coalesce(i.gate, 1),
        'Time', public.lagos_time(i.created_at)));
    end if;
  elsif new.kind = 'fixit' then
    v_ref := nullif(substring(new.title from '#(\d+)'), '')::bigint;
    if v_ref is not null then select * into f from public.fixit_requests where fixit_requests.ref = v_ref; end if;
    if f.id is not null then
      new.details := jsonb_strip_nulls(jsonb_build_object('Request', '#' || f.ref || ' · ' || initcap(replace(f.category, '_', ' ')),
        'House', 'House ' || f.house_number || ' · ' || public.unit_label(f.house_unit),
        'Where', f.location,
        'Status', case f.status when 'open' then 'Open' when 'in_progress' then 'In progress' else 'Done' end));
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists notifications_fill_details on public.notifications;
create trigger notifications_fill_details before insert on public.notifications
  for each row execute function public.fill_notification_details();

-- ---------- weekly summary on/off ----------
create or replace function public.set_weekly_email(p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set weekly_email = coalesce(p_on, true) where id = auth.uid();
end; $$;
grant execute on function public.set_weekly_email(boolean) to authenticated;

-- ---------- the weekly summary (Monday 07:00 Lagos, covering the past 7 days) ----------
create or replace function public.send_weekly_summaries()
returns int language plpgsql security definer set search_path = public as $$
declare
  p record; n int := 0; since timestamptz := now() - interval '7 days';
  period text := to_char((now() - interval '7 days') at time zone 'Africa/Lagos', 'DD Mon') || ' – ' ||
                 to_char((now() - interval '1 day') at time zone 'Africa/Lagos', 'DD Mon YYYY');
  v_in int; v_people int; v_codes int; v_staff int; v_refused int; v_top jsonb; v_fix int;
  e_in int; e_people int; e_refused int; e_sos int; e_inc int; e_inc_open int; e_fix_open int; e_pending int; e_moves int; e_hours numeric;
begin
  -- residents: one summary per person, about their own home
  for p in
    select * from public.profiles
     where role = 'resident' and status = 'active' and weekly_email
       and email is not null and email like '%@%' and email not like '%lighthouseestate.app'
  loop
    select count(*) filter (where g.direction = 'in' and g.result = 'access'),
           count(distinct c.id) filter (where g.direction = 'in' and g.result = 'access' and c.type <> 'employee'),
           count(*) filter (where g.direction = 'in' and g.result = 'access' and c.type = 'employee'),
           count(*) filter (where g.result <> 'access')
      into v_in, v_people, v_staff, v_refused
      from public.gate_logs g join public.access_codes c on c.id = g.code_id
     where g.scanned_at >= since and c.house_number = p.house_number and c.house_unit = p.house_unit;
    select count(*) into v_codes from public.access_codes
     where created_at >= since and house_number = p.house_number and house_unit = p.house_unit and type <> 'employee';
    select coalesce(jsonb_agg(jsonb_build_object('name', holder_name, 'visits', visits) order by visits desc), '[]'::jsonb) into v_top
      from (select c.holder_name, count(*) visits
              from public.gate_logs g join public.access_codes c on c.id = g.code_id
             where g.scanned_at >= since and g.direction = 'in' and g.result = 'access' and c.type <> 'employee'
               and c.house_number = p.house_number and c.house_unit = p.house_unit
             group by c.holder_name order by count(*) desc limit 3) t;
    select count(*) into v_fix from public.fixit_requests where raised_by = p.id and status <> 'done';

    insert into public.notifications (recipient_id, kind, title, body, link, details)
    values (p.id, 'weekly', 'Your week at House ' || p.house_number,
      case when v_in = 0 and v_codes = 0 then 'A quiet week: no visitors came in with your codes.'
           else v_people || ' visitor' || case when v_people = 1 then '' else 's' end || ' came in ' || (v_in - v_staff) || ' time' ||
                case when v_in - v_staff = 1 then '' else 's' end || ', and you created ' || v_codes || ' code' || case when v_codes = 1 then '' else 's' end || '.' end,
      '/insights',
      jsonb_build_object('_weekly', true, '_period', period,
        '_stats', jsonb_build_array(
          jsonb_build_object('label', 'Visits', 'value', v_in - v_staff),
          jsonb_build_object('label', 'Codes created', 'value', v_codes),
          jsonb_build_object('label', 'Staff entries', 'value', v_staff),
          jsonb_build_object('label', 'Refused at gate', 'value', v_refused)),
        '_top', v_top,
        '_note', case when v_fix > 0 then v_fix || ' of your Fix-It request' || case when v_fix = 1 then ' is' else 's are' end || ' still open.' end));
    n := n + 1;
  end loop;

  -- Estate Manager: the whole estate
  select count(*) filter (where direction = 'in' and result = 'access'),
         count(distinct code_id) filter (where direction = 'in' and result = 'access'),
         count(*) filter (where result <> 'access')
    into e_in, e_people, e_refused from public.gate_logs where scanned_at >= since;
  select count(*) into e_sos from public.sos_alerts where created_at >= since;
  select count(*) into e_inc from public.incidents where created_at >= since;
  select count(*) into e_inc_open from public.incidents where status = 'open';
  select count(*) into e_fix_open from public.fixit_requests where status <> 'done';
  select count(*) into e_pending from public.profiles where role = 'resident' and status = 'pending';
  select count(*) into e_moves from public.move_outs where status in ('requested','confirmed') and move_date <= public.lagos_today() + 7;
  select coalesce(round(sum(extract(epoch from (coalesce(ended_at, now()) - started_at)) / 3600)::numeric, 0), 0) into e_hours
    from public.guard_shifts where started_at >= since;

  for p in
    select * from public.profiles where role = 'estate_manager' and status = 'active' and weekly_email
       and email is not null and email like '%@%'
  loop
    insert into public.notifications (recipient_id, kind, title, body, link, details)
    values (p.id, 'weekly', 'The estate this week',
      e_in || ' entries at the gate, ' || e_inc || ' incident report' || case when e_inc = 1 then '' else 's' end || ', ' ||
      e_sos || ' SOS alert' || case when e_sos = 1 then '' else 's' end || '.', '/manager/insights',
      jsonb_build_object('_weekly', true, '_period', period,
        '_stats', jsonb_build_array(
          jsonb_build_object('label', 'Gate entries', 'value', e_in),
          jsonb_build_object('label', 'Different codes', 'value', e_people),
          jsonb_build_object('label', 'Refused at gate', 'value', e_refused),
          jsonb_build_object('label', 'Guard hours', 'value', e_hours)),
        '_todo', jsonb_strip_nulls(jsonb_build_object(
          'Registrations to approve', nullif(e_pending, 0),
          'Open incidents', nullif(e_inc_open, 0),
          'Open Fix-It requests', nullif(e_fix_open, 0),
          'Move-outs in the next 7 days', nullif(e_moves, 0),
          'SOS alerts this week', nullif(e_sos, 0)))));
    n := n + 1;
  end loop;
  return n;
end; $$;
revoke execute on function public.send_weekly_summaries() from public, anon, authenticated;

create extension if not exists pg_cron;
do $$ begin
  perform cron.unschedule('weekly-summary') where exists (select 1 from cron.job where jobname = 'weekly-summary');
  perform cron.schedule('weekly-summary', '0 6 * * 1', 'select public.send_weekly_summaries()');  -- 06:00 UTC = 07:00 Lagos, Mondays
end $$;
