-- ONE-TIME CLEAN-UP BEFORE LAUNCH
-- Removes ALL test data: every resident, guard, code, staff member, gate log entry,
-- notice, announcement, SOS alert, alert subscription and wrong-PIN counter.
-- KEEPS: the Estate Manager account(s), all settings, functions and secrets.
-- Runs as one transaction: if anything fails, nothing is deleted.

begin;

delete from public.gate_logs;
delete from public.notifications;
delete from public.sos_alerts;
delete from public.announcements;
delete from public.push_subscriptions
 where user_id not in (select id from public.profiles where role = 'estate_manager');
delete from public.login_attempts;
delete from public.access_codes;
delete from public.employees;

-- residents and guards: profile first, then their login
create temp table _gone as
  select id from public.profiles where role in ('resident', 'guard');
delete from public.profiles where id in (select id from _gone);
delete from auth.users where id in (select id from _gone);
-- any leftover test logins that never got a profile
delete from auth.users u
 where (u.email like '%@residents.lighthouseestate.app' or u.email like '%@guards.lighthouseestate.app')
   and not exists (select 1 from public.profiles p where p.id = u.id);

commit;

-- What is left (should be just the Estate Manager):
select role, full_name, email, status from public.profiles;
