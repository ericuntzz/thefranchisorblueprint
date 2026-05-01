-- Coaching session tracking — closes the gaps from the post-build audit:
-- (1) Refund of a coaching add-on doesn't reverse unused credits
-- (2) No call-usage tracking — we can't tell which credits are spent
-- Both fixed by tracking each booking as a row + an atomic debit RPC.

-- ─── Sessions table ──────────────────────────────────────────────────────
create table if not exists public.coaching_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Calendly identifiers (canonical mapping from webhook event → row)
  calendly_event_uri text,           -- the Calendly event URI ("scheduled event")
  calendly_invitee_uri text unique,  -- the invitee URI — unique per booking
  calendly_event_type_uri text,      -- which Calendly event type was booked

  scheduled_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'canceled', 'no_show')),

  -- Coach-private notes (Eric/Jason can fill these in via Supabase Studio
  -- for now; eventually a coach dashboard).
  notes text,

  created_at timestamptz not null default now(),
  canceled_at timestamptz,
  completed_at timestamptz
);

create index if not exists coaching_sessions_user_idx
  on public.coaching_sessions (user_id);

create index if not exists coaching_sessions_event_uri_idx
  on public.coaching_sessions (calendly_event_uri)
  where calendly_event_uri is not null;

alter table public.coaching_sessions enable row level security;

drop policy if exists "users can read own sessions" on public.coaching_sessions;
create policy "users can read own sessions"
  on public.coaching_sessions for select
  using (auth.uid() = user_id);
-- service_role only writes (via Calendly webhook + manual coach updates)

-- ─── Atomic credit debit ────────────────────────────────────────────────
-- Returns true if a credit was successfully debited, false if balance was 0.
-- The Calendly webhook calls this when a session is booked.
create or replace function public.debit_coaching_credit(uid uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rows_updated int;
begin
  update public.profiles
  set coaching_credits = coaching_credits - 1
  where id = uid and coaching_credits > 0;
  get diagnostics rows_updated = row_count;
  return rows_updated > 0;
end;
$$;

-- ─── Atomic refund-aware credit clawback ────────────────────────────────
-- When a customer refunds a coaching add-on, we want to deduct UNUSED
-- credits but not the ones they already spent.
--
-- Rule: deduct min(grant, current_balance). Never go negative.
-- If they bought 6 credits, used 2, then refunded — they keep the 2 used,
-- lose the 4 unused. Fair to both parties.
create or replace function public.clawback_unused_credits(uid uuid, grant_amount int)
returns int  -- returns the actual amount clawed back
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance int;
  to_deduct int;
begin
  select coaching_credits into current_balance
  from public.profiles where id = uid for update;

  to_deduct := least(grant_amount, coalesce(current_balance, 0));
  if to_deduct > 0 then
    update public.profiles
    set coaching_credits = coaching_credits - to_deduct
    where id = uid;
  end if;
  return to_deduct;
end;
$$;
