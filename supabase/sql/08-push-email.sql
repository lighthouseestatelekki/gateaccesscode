-- Piece 8: deliver every inbox notice as a phone push alert and an email.
-- How it works: when notices are added, the database calls the "notify" Edge Function once,
-- with a secret only the database and that function know.

create extension if not exists pg_net with schema extensions;

-- Phones that agreed to receive alerts
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own push subscriptions read" on public.push_subscriptions;
drop policy if exists "own push subscriptions add" on public.push_subscriptions;
drop policy if exists "own push subscriptions remove" on public.push_subscriptions;
create policy "own push subscriptions read" on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy "own push subscriptions add" on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid() and public.auth_role() is not null);
create policy "own push subscriptions remove" on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- Server-only secrets (no read rules at all: only the service key can see them)
create table if not exists public.app_secrets (name text primary key, value text not null);
alter table public.app_secrets enable row level security;
insert into public.app_secrets (name, value)
values ('notify_hook', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (name) do nothing;

-- One call per batch of new notices (an announcement to 100 residents = 1 call, not 100)
create or replace function public.deliver_notifications()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare v_ids uuid[]; v_secret text;
begin
  select array_agg(id) into v_ids from new_rows;
  if v_ids is null then return null; end if;
  select value into v_secret from public.app_secrets where name = 'notify_hook';
  begin
    perform net.http_post(
      url := 'https://tsqddeqbpupdnwaunwdq.supabase.co/functions/v1/notify',
      body := jsonb_build_object('action', 'deliver', 'ids', to_jsonb(v_ids)),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret),
      timeout_milliseconds := 10000
    );
  exception when others then
    -- never block the in-app notice if the delivery call cannot be queued
    raise warning 'deliver_notifications: %', sqlerrm;
  end;
  return null;
end; $$;
revoke execute on function public.deliver_notifications() from public, anon, authenticated;

drop trigger if exists notifications_deliver on public.notifications;
create trigger notifications_deliver after insert on public.notifications
  referencing new table as new_rows
  for each statement execute function public.deliver_notifications();
