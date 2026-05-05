-- Phase 2E.5 — saved past chats on the Jason AI dock
-- ============================================================================
-- The dock now exposes a "+ New chat" button so the customer can start
-- fresh without losing their previous thread. Cleared transcripts get
-- archived into this column as a small list of {id, archivedAt, preview,
-- transcript} entries; a sibling "history" dropdown lets the customer
-- pull a past chat back into the active slot.
--
-- One column on the existing chat_history row keeps the schema dead
-- simple — we don't want a thread-per-conversation table for what is
-- ultimately a "last few chats" list. Server caps the array length on
-- write so a customer who chronically clicks New Chat doesn't bloat the
-- row unbounded.
-- ============================================================================

alter table public.chat_history
  add column if not exists saved_threads jsonb not null default '[]'::jsonb;
