-- Richer capability tracking: log first view (started_at) + most-recent view
-- (last_viewed_at) in addition to completion. Enables:
--   - "Stuck on this for 14+ days" nudges
--   - "Day X of your journey" markers
--   - "First-run" detection for the Day 1 overlay
--
-- Schema changes:
--   - completed_at becomes nullable (a row can mean "viewed but not complete")
--   - new started_at, last_viewed_at columns
--
-- Semantic changes (the API routes will be updated to match):
--   - "Mark complete"   → upsert (started_at, last_viewed_at, completed_at = now())
--   - "Mark not complete" → UPDATE SET completed_at = null (keep view history)
--   - View a capability → log_capability_view RPC (upsert last_viewed_at)

alter table public.capability_progress
  alter column completed_at drop default;

alter table public.capability_progress
  alter column completed_at drop not null;

alter table public.capability_progress
  add column if not exists started_at timestamptz;

alter table public.capability_progress
  add column if not exists last_viewed_at timestamptz;

-- Backfill existing rows. Anything in the table today is "completed" (the
-- old code only inserted on completion), so started_at / last_viewed_at
-- match completed_at — best fact we have.
update public.capability_progress
set started_at = coalesce(started_at, completed_at, now()),
    last_viewed_at = coalesce(last_viewed_at, completed_at, now());

-- View logger: upsert last_viewed_at; on first call also sets started_at.
-- security_definer so we can call it from server code without worrying
-- about the user's RLS context. Caller is responsible for passing the
-- right uid (it's only invoked from authed server routes).
create or replace function public.log_capability_view(uid uuid, slug text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.capability_progress (user_id, capability_slug, started_at, last_viewed_at)
  values (uid, slug, now(), now())
  on conflict (user_id, capability_slug)
  do update set
    last_viewed_at = now(),
    started_at = coalesce(public.capability_progress.started_at, now());
$$;

-- Allow customers to UPDATE their own progress rows (the unmark flow now
-- uses UPDATE instead of DELETE so we don't lose the view history).
drop policy if exists "users can update own progress" on public.capability_progress;
create policy "users can update own progress"
  on public.capability_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
