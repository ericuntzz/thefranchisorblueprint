-- 0021_memory_snapshots.sql
-- ===========================================================================
-- Versioned Memory snapshots for chapter-level rollback.
--
-- The Blueprint is a living document — agent drafts, customer edits, scrapes,
-- and uploads all mutate `customer_memory` rows continuously. Without versions,
-- a customer who hits "redraft" and doesn't like the result has no clean way
-- to revert. Snapshotting before every meaningful write gives them an undo
-- list scoped to each chapter.
--
-- Design choices:
--   - One row per snapshot, identified by user_id + chapter_slug + created_at.
--     We don't number snapshots — created_at sorts perfectly and survives
--     concurrent writes.
--   - Capture content_md + fields + confidence in a single jsonb payload so
--     the row is self-contained for the rollback path.
--   - reason: human-readable label ("Before redraft", "After scrape", etc.)
--     surfaced in the rollback UI so the customer can pick the right point.
--   - source: which subsystem captured the snapshot — useful for debugging
--     and for the rollback UI's icon/color.
--   - Pruned by a periodic cron — we keep at most N snapshots per chapter
--     (see lib/memory/snapshots.ts), oldest dropped first.
-- ===========================================================================

create table if not exists public.memory_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_slug text not null,
  -- Snapshot of the chapter at capture time. Mirrors customer_memory's
  -- shape; readers cast as ChapterContent on the way out.
  payload jsonb not null,
  -- Free-form label shown in the rollback UI ("Before redraft",
  -- "Scraped from website", "After Jason coaching", etc.).
  reason text,
  -- Which subsystem captured this snapshot.
  source text not null check (
    source in (
      'pre_draft',
      'pre_redraft',
      'pre_scrape',
      'pre_user_edit',
      'pre_extract',
      'pre_field_save',
      'manual'
    )
  ),
  created_at timestamptz not null default now()
);

create index if not exists memory_snapshots_user_chapter_created_idx
  on public.memory_snapshots (user_id, chapter_slug, created_at desc);

alter table public.memory_snapshots enable row level security;

drop policy if exists "users can read own snapshots" on public.memory_snapshots;
create policy "users can read own snapshots"
  on public.memory_snapshots for select
  using (auth.uid() = user_id);

drop policy if exists "users can insert own snapshots" on public.memory_snapshots;
create policy "users can insert own snapshots"
  on public.memory_snapshots for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can delete own snapshots" on public.memory_snapshots;
create policy "users can delete own snapshots"
  on public.memory_snapshots for delete
  using (auth.uid() = user_id);
