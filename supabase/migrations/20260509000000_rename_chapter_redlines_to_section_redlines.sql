-- 20260509000000_rename_chapter_redlines_to_section_redlines.sql
-- ===========================================================================
-- Rename chapter_redlines → section_redlines as part of the product-wide
-- chapter→section terminology change (Eric, 2026-05-09). Franchisors
-- think in business / FDD terms — sections — not creative-writing terms
-- — chapters. The codebase, UI, routes, and types were all renamed in
-- the matching application-level commit; this migration brings the DB
-- in line.
--
-- Renames the table, the slug column, and the indexes. Re-creates the
-- RLS policies under the new table name (Postgres carries policies
-- across an ALTER TABLE RENAME, but we drop+recreate explicitly for
-- clarity in audit). Existing rows + values are preserved.
--
-- The `customer_memory.file_slug` column is INTENTIONALLY left alone —
-- it refers to the markdown-file storage layer, a separate metaphor
-- from "chapter / section". Same reasoning applies to the
-- `MemoryFileSlug` TypeScript type. If we want to align those too, do
-- it as a deliberate follow-up rather than entangling them with this
-- terminology change.
-- ===========================================================================

alter table public.chapter_redlines rename to section_redlines;
alter table public.section_redlines rename column chapter_slug to section_slug;

-- Indexes — Postgres auto-renames index objects after a table rename
-- ONLY when the old name was prefixed by the table name (it isn't
-- always). Drop + recreate to be safe.
drop index if exists public.chapter_redlines_user_chapter_idx;
drop index if exists public.chapter_redlines_unresolved_idx;
create index if not exists section_redlines_user_section_idx
  on public.section_redlines (user_id, section_slug, created_at desc);
create index if not exists section_redlines_unresolved_idx
  on public.section_redlines (user_id, section_slug)
  where resolved_at is null;

-- RLS policies — drop + recreate under the new table name. The policy
-- names + bodies stay identical; only the table reference changes.
alter table public.section_redlines enable row level security;

drop policy if exists "users can read own redlines" on public.section_redlines;
create policy "users can read own redlines"
  on public.section_redlines for select
  using (auth.uid() = user_id);

drop policy if exists "users can resolve own redlines" on public.section_redlines;
create policy "users can resolve own redlines"
  on public.section_redlines for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
