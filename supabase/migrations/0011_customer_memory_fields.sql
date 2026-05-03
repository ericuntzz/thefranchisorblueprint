-- Phase 1.5a step 4 of the agentic-portal buildout: structured fields layer
-- for customer_memory.
--
-- Adds two jsonb columns alongside the existing content_md prose:
--
--   fields        — Record<field_name, value>. Typed structured data
--                   per chapter. Schema lives in src/lib/memory/schemas.ts.
--                   See ChapterSchema / FieldDef there for the shape.
--
--   field_status  — Record<field_name, { source, updated_at, note? }>.
--                   Per-field provenance. Tracks where each value came
--                   from (voice_session, upload, form, agent_inference,
--                   research, scraper, user_correction, user_typed).
--
-- Both default to '{}' so existing rows are valid post-migration without
-- a backfill. Purely additive.
--
-- See docs/agentic-portal-buildout.md §4 for the broader Memory architecture.

alter table public.customer_memory
  add column if not exists fields jsonb not null default '{}'::jsonb;

alter table public.customer_memory
  add column if not exists field_status jsonb not null default '{}'::jsonb;

-- No new RLS policies needed — `fields` and `field_status` inherit the
-- row-level policies already on customer_memory (users can SELECT/INSERT
-- /UPDATE only their own rows; service role bypasses).

-- The atomic upsert RPC (upsert_memory_with_provenance) was scoped to
-- content_md + provenance entries. Field updates use a separate code
-- path — server actions and the agent's update_memory_field tool —
-- that read-modify-write the jsonb directly. This is fine because:
--   - field updates are partial (one field at a time, not bulk
--     replace), so the existing atomic-replace RPC's semantics don't
--     fit.
--   - postgres jsonb updates are atomic at the row level. A user
--     editing two fields in rapid succession may see one race the
--     other (last-writer-wins), but the row is never left in an
--     inconsistent state.
--
-- If we later need stronger guarantees (e.g. preventing two browser
-- tabs from clobbering each other), we'll add a per-field optimistic
-- concurrency check via field_status.updated_at. Not needed for v1.
