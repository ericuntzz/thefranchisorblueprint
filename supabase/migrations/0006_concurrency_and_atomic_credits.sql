-- Concurrency + atomicity fixes flagged in the post-build audit.

-- 1) Atomic coaching credits increment.
-- The TS code did a SELECT-then-UPDATE that's racy under concurrent purchases
-- (two simultaneous coaching-credit purchases could both read the starting
-- value, both compute "+N", and overwrite each other — losing credits).
-- Pure SQL UPDATE with `coaching_credits + delta` is atomic in Postgres.
create or replace function public.add_coaching_credits(uid uuid, delta int)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set coaching_credits = coalesce(coaching_credits, 0) + delta
  where id = uid;
$$;

-- 2) Email queue claim function — prevents double-send when both Vercel Cron
-- and Supabase pg_cron pick up the same row.
-- FOR UPDATE SKIP LOCKED gives us the canonical "queue worker" pattern:
-- each invocation claims a different batch, no overlap, no waiting.
alter table public.scheduled_emails
  add column if not exists claimed_at timestamptz;

create index if not exists scheduled_emails_claimed_idx
  on public.scheduled_emails (claimed_at)
  where claimed_at is not null;

create or replace function public.claim_due_emails(batch_size int default 25)
returns setof public.scheduled_emails
language sql
security definer
set search_path = public
as $$
  -- "claim" = mark claimed_at, return only the rows we successfully marked.
  -- The 5-min stale-claim window lets us recover rows from a crashed worker.
  update public.scheduled_emails se
  set claimed_at = now()
  where se.id in (
    select id
    from public.scheduled_emails
    where sent_at is null
      and failed_at is null
      and send_after <= now()
      and (claimed_at is null or claimed_at < now() - interval '5 minutes')
    order by send_after asc
    limit batch_size
    for update skip locked
  )
  returning *;
$$;
