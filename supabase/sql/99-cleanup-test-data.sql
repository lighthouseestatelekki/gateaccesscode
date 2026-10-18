-- ONE-TIME CLEAN-UP BEFORE LAUNCH
-- Removes ALL test data: every resident, household member, guard, code, staff member, gate log
-- entry, alert, announcement, SOS alert, Fix-It request, incident, guard shift, move-out,
-- action-history entry, alert subscription and wrong-PIN counter.
-- KEEPS: the Estate Manager account(s) (and their authenticator), all settings, functions,
-- nightly jobs and secrets.
-- Runs as one transaction: if anything fails, nothing is deleted.
-- Fix-It photos are files, not rows: delete them in Supabase -> Storage -> fixit (see the guide).

begin;

delete from public.gate_logs;
delete from public.overstay_alerts;
delete from public.notifications;
delete from public.sos_alerts;
delete from public.announcements;
delete from public.fixit_requests;
delete from public.incidents;
delete from public.guard_shifts;
delete from public.move_outs;
delete from public.audit_log;
delete from public.push_subscriptions
 where user_id not in (select id from public.profiles where role = 'estate_manager');
delete from public.login_attempts;
delete from public.login_device_attempts;
delete from public.access_codes;
delete from public.staff_invites;
delete from public.employees;

-- residents, household members and guards: profile first, then their login
create temp table _gone on commit drop as
  select id from public.profiles where role in ('resident', 'guard');
update public.profiles set created_by = null where created_by in (select id from _gone);
update public.profiles set member_of = null where member_of in (select id from _gone);
delete from public.profiles where id in (select id from _gone);
delete from auth.sessions where user_id in (select id from _gone);
delete from auth.users where id in (select id from _gone);
-- any leftover test logins that never got a profile (including retired "moved-" logins)
delete from auth.users u
 where (u.email like '%@residents.lighthouseestate.app' or u.email like '%@guards.lighthouseestate.app')
   and not exists (select 1 from public.profiles p where p.id = u.id);

commit;

-- What is left (should be just the Estate Manager):
select role, full_name, email, status from public.profiles;
