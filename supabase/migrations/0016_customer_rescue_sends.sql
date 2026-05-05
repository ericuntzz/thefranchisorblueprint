-- Idempotency + cooldown ledger for the stuck-customer rescue cron.
--
-- The cron at /api/cron/stuck-customer-rescue checks this table to
-- enforce a 14-day cooldown between rescues for the same user — we
-- don't want to nag a customer who already got pinged and stayed
-- idle. Same-day idempotency is also enforced via Resend's per-message
-- idempotencyKey, but a server-side row gives us audit history.
--
-- Why not stuff this into scheduled_emails? scheduled_emails is a
-- queue (rows mean "send this"), not a log (rows mean "this was
-- sent"). Keeping the two separate keeps the queue's pruning logic
-- simple — completed scheduled rows can be reaped without losing
-- the rescue history.

create table if not exists customer_rescue_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Which chapter we pointed them at; useful for follow-up analysis
  -- (does pointing customers at chapter X actually unstick them?).
  chapter_slug text not null,
  -- How idle they were when we sent. Lets us correlate response rate
  -- against idle duration without recomputing from the email body.
  days_idle int not null,
  sent_at timestamptz not null default now()
);

-- Cooldown lookup: "did this user receive a rescue in the last 14
-- days?" runs against this index in O(log n). The cron filters by
-- user_id IN (...) and sent_at >= cutoff, so a composite is cheaper
-- than two single-column indexes.
create index if not exists customer_rescue_sends_user_recent
  on customer_rescue_sends (user_id, sent_at desc);

-- RLS: customers can't read this — internal-only. The cron uses the
-- service-role client which bypasses RLS, so we just deny everything
-- by default.
alter table customer_rescue_sends enable row level security;
-- (No policies = no row-level access for non-service-role clients.)
