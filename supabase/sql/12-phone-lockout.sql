-- 12) Lock the phone, not the house.
-- Wrong PINs now count per phone. 5 wrong PINs blocks only that phone for 15 minutes.
-- The house itself only locks after 20 wrong PINs (from all phones together) within an hour,
-- and then the resident and the Estate Manager get a "security" alert.

-- Per-phone counter (one row per house/guard login + phone).
create table if not exists public.login_device_attempts (
  login text not null,
  device text not null,
  fails int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (login, device)
);
alter table public.login_device_attempts enable row level security;
-- (no policies on purpose: only the server function can read or change it)

-- The existing per-house table becomes the 1-hour total.
alter table public.login_attempts add column if not exists window_start timestamptz;

-- Allow the new alert type.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('announcement','code_in','code_out','code_refused','code_switched_off','approved','sos',
                  'code_expiring','code_changed','code_created_for_you','security'));

-- Clear any old house-wide locks so nobody stays blocked by the old rule.
update public.login_attempts set fails = 0, locked_until = null, window_start = null;
