-- Tracks which capabilities a customer has marked complete in the portal.
-- One row per (user, capability). Insert = complete, delete = uncomplete.

create table if not exists public.capability_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  capability_slug text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, capability_slug)
);

create index if not exists capability_progress_user_idx
  on public.capability_progress (user_id);

alter table public.capability_progress enable row level security;

drop policy if exists "users can read own progress" on public.capability_progress;
create policy "users can read own progress"
  on public.capability_progress for select
  using (auth.uid() = user_id);

drop policy if exists "users can mark own progress" on public.capability_progress;
create policy "users can mark own progress"
  on public.capability_progress for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can unmark own progress" on public.capability_progress;
create policy "users can unmark own progress"
  on public.capability_progress for delete
  using (auth.uid() = user_id);
