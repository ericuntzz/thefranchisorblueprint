-- 0022_chapter_redlines.sql
-- ===========================================================================
-- Jason's redline notes against a customer's chapter draft.
--
-- Tier 2/3 customers get a human review pass on their drafted chapters
-- before final export. This table stores the redline annotations Jason
-- (or another admin reviewer) leaves: a comment scoped to a chapter
-- (and optionally to a `claim_id` anchor inside the markdown), plus a
-- resolved flag so the customer can mark each comment as addressed.
--
-- Distinct from `customer_memory_provenance` — provenance traces facts
-- back to sources; redlines trace ATTENTION back to a reviewer's
-- judgment.
--
-- Plus a single boolean column on `customer_memory` to stamp the
-- chapter as "Jason approved" once all critical redlines are resolved.
-- Surfaced on each export's cover page so the recipient knows whether
-- the chapter has had human eyes on it.
-- ===========================================================================

create table if not exists public.chapter_redlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_slug text not null,
  -- Optional anchor inside the markdown — e.g. "para-3" or "field-royalty_rate_pct"
  claim_id text,
  comment text not null,
  -- "info" | "warning" | "blocker" — the customer can resolve any, but
  -- blockers prevent the chapter from getting the "Jason approved" stamp.
  severity text not null default 'info' check (severity in ('info', 'warning', 'blocker')),
  reviewer_user_id uuid not null references auth.users(id) on delete cascade,
  reviewer_name text,
  resolved_at timestamptz,
  resolved_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chapter_redlines_user_chapter_idx
  on public.chapter_redlines (user_id, chapter_slug, created_at desc);
create index if not exists chapter_redlines_unresolved_idx
  on public.chapter_redlines (user_id, chapter_slug)
  where resolved_at is null;

alter table public.chapter_redlines enable row level security;

drop policy if exists "users can read own redlines" on public.chapter_redlines;
create policy "users can read own redlines"
  on public.chapter_redlines for select
  using (auth.uid() = user_id);

drop policy if exists "users can resolve own redlines" on public.chapter_redlines;
create policy "users can resolve own redlines"
  on public.chapter_redlines for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Insert / hard-delete left to service-role from admin routes.

-- ── customer_memory.jason_approved_at ──────────────────────────────────────
-- Stamped when Jason (or another admin reviewer) marks a chapter as
-- approved — every blocker redline must be resolved first. Surfaced on
-- the export cover page + chapter card.

alter table public.customer_memory
  add column if not exists jason_approved_at timestamptz,
  add column if not exists jason_approved_by_user_id uuid references auth.users(id) on delete set null;
