-- Inbox review agent audit trail.
-- One row per thread per review run. The agent classifies, we log everything.

create table if not exists public.inbox_reviews (
  id            uuid primary key default gen_random_uuid(),
  thread_id     text    not null,
  message_id    text,
  subject       text    not null default '',
  sender        text    not null default '',
  category      text    not null check (category in ('urgent', 'action', 'fyi', 'spam')),
  reason        text    not null default '',
  summary       text    not null default '',
  draft_reply   text,
  reviewed_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- Fast lookup for dedup: don't re-classify the same thread within a window.
create index if not exists idx_inbox_reviews_thread_id
  on public.inbox_reviews (thread_id, reviewed_at desc);

-- Aggregate queries for digest.
create index if not exists idx_inbox_reviews_reviewed_at
  on public.inbox_reviews (reviewed_at desc);

-- RLS: service-role only (cron writes, no user-facing reads).
alter table public.inbox_reviews enable row level security;
