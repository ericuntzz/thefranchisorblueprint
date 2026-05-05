create table if not exists refund_outreach_sends (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  days_remaining int not null,
  readiness_pct int not null,
  sent_at     timestamptz not null default now()
);

alter table refund_outreach_sends enable row level security;
