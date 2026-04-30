-- Phase 0 of the agentic-portal buildout: Memory + provenance + website URL.
--
-- See docs/agentic-portal-buildout.md §4 for the full design rationale. The
-- TL;DR: each customer gets a directory of markdown files (customer_memory)
-- that double as the agent's memory AND the live drafts of chapters in the
-- Franchisor Blueprint. Per-claim provenance lives in a sibling table so
-- the on-hover "where did this come from?" UI has a fast lookup.
--
-- This migration is purely additive — no existing column changes, no data
-- backfill needed. Safe to apply on a live db.

-- ============================================================================
-- 1) Capture the customer's website URL.
-- ============================================================================
-- We need this in two places:
--   - profiles.website_url        — for post-purchase scrape (Phase 1)
--   - assessment_sessions.website_url — for pre-purchase capture so we can
--                                        scrape during the few hours/days
--                                        between assessment and purchase.

alter table public.profiles
  add column if not exists website_url text;

alter table public.assessment_sessions
  add column if not exists website_url text;

-- ============================================================================
-- 2) customer_memory — the per-user file directory.
-- ============================================================================
-- One row per (user, file_slug). content_md is the markdown body — read by
-- the agent at every turn, edited by the customer, and at export time
-- compiled into the deliverable bundle. confidence is a soft tag the UI
-- *may* surface (we render provenance on hover, not as visible badges).

create table if not exists public.customer_memory (
  user_id uuid not null references auth.users(id) on delete cascade,
  file_slug text not null,
  content_md text not null default '',
  confidence text not null default 'draft' check (confidence in ('verified', 'inferred', 'draft')),
  last_updated_by text not null default 'agent' check (last_updated_by in ('agent', 'user', 'jason', 'scraper')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, file_slug)
);

-- Lookup index for "give me everything I know about this user" — by far the
-- hottest query path (every chat turn, every draft request).
create index if not exists customer_memory_user_idx on public.customer_memory(user_id);

-- Touch updated_at on every UPDATE. We rely on this for cache-busting on
-- the agent's prompt-cache breakpoints (we cache memory snapshots for 5min
-- TTL keyed by max(updated_at)).
create or replace function public.touch_customer_memory_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists customer_memory_set_updated_at on public.customer_memory;
create trigger customer_memory_set_updated_at
  before update on public.customer_memory
  for each row execute function public.touch_customer_memory_updated_at();

-- RLS: same pattern as everything else — users see/edit only their rows.
-- Service role bypasses RLS for agent-side writes.
alter table public.customer_memory enable row level security;

drop policy if exists "users can read own memory" on public.customer_memory;
create policy "users can read own memory"
  on public.customer_memory for select
  using (auth.uid() = user_id);

drop policy if exists "users can insert own memory" on public.customer_memory;
create policy "users can insert own memory"
  on public.customer_memory for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can update own memory" on public.customer_memory;
create policy "users can update own memory"
  on public.customer_memory for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No DELETE policy: we don't want customers blowing away chapter drafts
-- accidentally. To "clear" a chapter they UPDATE content_md = '' instead.
-- Service role can still hard-delete if support needs to reset something.

-- ============================================================================
-- 3) customer_memory_provenance — per-claim audit trail.
-- ============================================================================
-- Every meaningful claim in a chapter (a number, a paragraph, a
-- specific assertion) gets a row here pointing back to its source. The
-- on-hover provenance UI joins on (user_id, file_slug, claim_id).
--
-- claim_id is an anchor we embed in the markdown — e.g. <!-- claim:para-3 -->
-- — so we can match a paragraph in the rendered doc to its provenance row
-- without a brittle text match. The agent inserts these inline as it drafts.

create table if not exists public.customer_memory_provenance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_slug text not null,
  claim_id text not null,
  source_type text not null check (source_type in (
    'voice_session',
    'upload',
    'form',
    'agent_inference',
    'jason_playbook',
    'research',
    'assessment',
    'scraper'
  )),
  source_ref text,        -- URL or storage path; null when the source is intrinsic (voice timestamp etc.)
  source_excerpt text,    -- the actual quote/line from the source, surfaced on hover
  created_at timestamptz not null default now()
);

-- Hot path: "give me all provenance for this user's view of this chapter."
create index if not exists customer_memory_provenance_lookup_idx
  on public.customer_memory_provenance(user_id, file_slug);

-- RLS — same pattern.
alter table public.customer_memory_provenance enable row level security;

drop policy if exists "users can read own provenance" on public.customer_memory_provenance;
create policy "users can read own provenance"
  on public.customer_memory_provenance for select
  using (auth.uid() = user_id);

-- Provenance is agent-written, never user-written. No INSERT/UPDATE/DELETE
-- policies for authenticated users — only service role can mutate.

-- ============================================================================
-- 4) upsert_memory_with_provenance — atomic "rewrite chapter + record sources"
-- ============================================================================
-- The most common write pattern: the agent finishes drafting a chapter,
-- the new content_md goes in, and we want to atomically replace the
-- provenance rows for that chapter with the new set. Single RPC keeps the
-- two writes in lock-step so we never leave provenance pointing at content
-- that was already overwritten.

create or replace function public.upsert_memory_with_provenance(
  p_user_id uuid,
  p_file_slug text,
  p_content_md text,
  p_confidence text,
  p_last_updated_by text,
  p_provenance jsonb  -- array of { claim_id, source_type, source_ref, source_excerpt }
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Upsert the chapter content.
  insert into public.customer_memory (user_id, file_slug, content_md, confidence, last_updated_by)
  values (p_user_id, p_file_slug, p_content_md, p_confidence, p_last_updated_by)
  on conflict (user_id, file_slug)
  do update set
    content_md = excluded.content_md,
    confidence = excluded.confidence,
    last_updated_by = excluded.last_updated_by;

  -- Replace provenance for this chapter atomically.
  delete from public.customer_memory_provenance
   where user_id = p_user_id and file_slug = p_file_slug;

  if p_provenance is not null and jsonb_array_length(p_provenance) > 0 then
    insert into public.customer_memory_provenance
      (user_id, file_slug, claim_id, source_type, source_ref, source_excerpt)
    select
      p_user_id,
      p_file_slug,
      (rec->>'claim_id')::text,
      (rec->>'source_type')::text,
      (rec->>'source_ref')::text,
      (rec->>'source_excerpt')::text
    from jsonb_array_elements(p_provenance) as rec;
  end if;
end;
$$;

-- ============================================================================
-- 5) customer-uploads storage bucket.
-- ============================================================================
-- Holds raw artifacts: voice recordings + transcripts, uploaded documents,
-- parsed JSON. Path convention: /{user_id}/{kind}/{filename}.
-- Private bucket — every read is via signed URL generated server-side.

insert into storage.buckets (id, name, public)
values ('customer-uploads', 'customer-uploads', false)
on conflict (id) do nothing;

-- RLS on storage.objects — users can only see/upload to their own folder.
-- The folder name is the user_id (string-compared), which Supabase exposes
-- as storage.foldername(name) returning a text[].
drop policy if exists "users can read own uploads" on storage.objects;
create policy "users can read own uploads"
  on storage.objects for select
  using (
    bucket_id = 'customer-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users can insert own uploads" on storage.objects;
create policy "users can insert own uploads"
  on storage.objects for insert
  with check (
    bucket_id = 'customer-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- No UPDATE/DELETE for users — keeps the upload audit trail intact.
-- Service role can clean up via the admin client.
