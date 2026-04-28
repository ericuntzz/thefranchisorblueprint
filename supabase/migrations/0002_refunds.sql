-- Refund tracking: capture when and how much was refunded so we can
-- recompute tier access correctly and show a clean "access revoked" UI.

alter table public.purchases
  add column if not exists refunded_at timestamptz,
  add column if not exists refund_amount_cents int not null default 0;

-- Webhook handler looks up purchases by payment_intent_id when a refund
-- arrives — index it for cheap lookups.
create index if not exists purchases_payment_intent_idx
  on public.purchases (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
