-- TFB customer portal schema
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/rrordqfdrdtbobmmkdss/sql/new

-- Profiles: extends auth.users with our app-specific fields
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  stripe_customer_id text,
  tier int not null default 1 check (tier in (1, 2, 3)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_email_idx on public.profiles (lower(email));
create unique index if not exists profiles_stripe_customer_id_idx
  on public.profiles (stripe_customer_id) where stripe_customer_id is not null;

-- Purchases: one row per completed Stripe checkout session
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_session_id text not null unique,
  stripe_payment_intent_id text,
  product text not null,
  tier int not null check (tier in (1, 2, 3)),
  amount_cents int not null,
  currency text not null default 'usd',
  status text not null default 'paid' check (status in ('paid', 'refunded')),
  created_at timestamptz not null default now()
);

create index if not exists purchases_user_id_idx on public.purchases (user_id);

-- Row level security
alter table public.profiles enable row level security;
alter table public.purchases enable row level security;

-- Customers can read & update their own profile
drop policy if exists "users can read own profile" on public.profiles;
create policy "users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Customers can read their own purchases
drop policy if exists "users can read own purchases" on public.purchases;
create policy "users can read own purchases"
  on public.purchases for select
  using (auth.uid() = user_id);

-- (No public insert/update — only the service_role key from the Stripe webhook writes,
--  and service_role bypasses RLS by design.)

-- Trigger: keep updated_at fresh on profile updates
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
