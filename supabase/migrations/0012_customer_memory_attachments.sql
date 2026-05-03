-- Phase 1.5a — per-chapter attachments
-- ============================================================================
-- The customer can attach files (PDF, DOCX, TXT, etc.) and reference links
-- to any chapter to give Jason more material to draft from. We store the
-- attachment list on customer_memory itself rather than a sibling table:
--   - all chapter state in one row → simpler reads
--   - additive column → no impact on existing query plans
--   - survives the upsert_memory_with_provenance RPC (which only touches
--     content_md / confidence / last_updated_by) so attachments persist
--     across redrafts without us having to special-case them
--
-- Schema of each entry:
--   {
--     id: text          -- short ulid-ish, generated client-side or by API
--     kind: 'file' | 'link'
--     ref: text         -- storage object path (file) OR https URL (link)
--     label: text       -- filename for files, page title or user-typed label for links
--     mime_type: text   -- present for files; nullable
--     size_bytes: int   -- present for files; nullable
--     excerpt: text     -- scraped/extracted text snippet (~2KB max), used by the agent prompt
--     created_at: timestamptz
--   }
--
-- The agent reads this column at draft time and includes the labels +
-- excerpts in Opus's prompt context. Files of types we can't parse yet
-- (PDF, DOCX, images) get an excerpt of "(file attached — content not yet
-- ingested)" so Opus at least knows they exist.

alter table public.customer_memory
  add column if not exists attachments jsonb not null default '[]'::jsonb;

-- No additional index — the row is read by (user_id, file_slug) which is
-- already the primary key, and we query the column as a whole.

comment on column public.customer_memory.attachments is
  'Array of per-chapter file/link attachments the customer added to enrich the agent''s drafting context. See migration 0012 for shape.';
