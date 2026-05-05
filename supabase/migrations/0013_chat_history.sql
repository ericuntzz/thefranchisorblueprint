-- Phase 2E.4 — persistent Jason AI chat history
-- ============================================================================
-- The dock used to reset to a fresh greeting on every page reload — opening
-- it tomorrow felt like meeting a new bot. Persisting the recent transcript
-- lets Jason AI greet returning customers with continuity ("last we talked
-- we were sorting your franchise fee — ready for royalties?") and gives the
-- model genuine context across sessions.
--
-- One row per user. The full TranscriptItem[] is stored as jsonb; the API
-- caps it at the last N items on write so a chatty customer doesn't bloat
-- the row indefinitely. Reads/writes are scoped via RLS to auth.uid().
-- ============================================================================

create table if not exists public.chat_history (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  transcript jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists chat_history_updated_at_idx
  on public.chat_history (updated_at desc);

alter table public.chat_history enable row level security;

drop policy if exists "users can read own chat history" on public.chat_history;
create policy "users can read own chat history"
  on public.chat_history for select
  using (auth.uid() = user_id);

drop policy if exists "users can insert own chat history" on public.chat_history;
create policy "users can insert own chat history"
  on public.chat_history for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can update own chat history" on public.chat_history;
create policy "users can update own chat history"
  on public.chat_history for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users can delete own chat history" on public.chat_history;
create policy "users can delete own chat history"
  on public.chat_history for delete
  using (auth.uid() = user_id);

-- Trigger: keep updated_at fresh on every UPDATE so the index stays useful
-- if we ever want a "most recently active customer" admin query.
create or replace function public.set_chat_history_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists chat_history_set_updated_at on public.chat_history;
create trigger chat_history_set_updated_at
  before update on public.chat_history
  for each row execute function public.set_chat_history_updated_at();
