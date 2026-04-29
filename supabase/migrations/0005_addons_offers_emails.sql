-- Adds the data layer for upgrade flow + drip email scheduling.

-- profiles.coaching_credits — extra coaching calls a customer has bought
-- via add-on products (Blueprint Plus, sample call, phase coaching, etc.).
-- Tier-based document access stays unchanged; coaching is a separate axis.
alter table public.profiles
  add column if not exists coaching_credits int not null default 0;

-- upgrade_offers — one row per (user, source→target) eligibility window.
-- Created automatically at purchase. After 48hrs, the 10% promo is no longer
-- applied at checkout, but the credit-forward base price is valid forever.
create table if not exists public.upgrade_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_tier int not null check (source_tier in (1, 2)),
  target_tier int not null check (target_tier in (2, 3)),
  base_amount_cents int not null,
  promo_amount_cents int not null,
  promo_expires_at timestamptz not null,
  triggered_by text not null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, source_tier, target_tier)
);

create index if not exists upgrade_offers_user_idx on public.upgrade_offers (user_id);

alter table public.upgrade_offers enable row level security;

drop policy if exists "users can read own offers" on public.upgrade_offers;
create policy "users can read own offers"
  on public.upgrade_offers for select
  using (auth.uid() = user_id);

-- scheduled_emails — drip queue. A row is "due" when send_after <= now()
-- and sent_at + failed_at are both null. Vercel Cron processes it.
create table if not exists public.scheduled_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  recipient_email text not null,
  template text not null,
  payload jsonb not null default '{}'::jsonb,
  send_after timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  attempts int not null default 0,
  -- dedupe_key prevents enqueueing the same logical email twice
  dedupe_key text unique,
  created_at timestamptz not null default now()
);

create index if not exists scheduled_emails_due_idx
  on public.scheduled_emails (send_after)
  where sent_at is null and failed_at is null;

alter table public.scheduled_emails enable row level security;
-- No public RLS policies. service_role only.
