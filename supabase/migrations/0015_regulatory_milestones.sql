-- 0015_regulatory_milestones.sql
--
-- Tracks the external regulatory milestones a franchisor must hit to
-- launch — entity formation, EIN, trademark, insurance, FDD filings,
-- etc. Distinct from the chapter-level "Memory" deliverables (which
-- track the WORK the franchisor is doing) — these are EXTERNAL events
-- with regulators / vendors / law firms.
--
-- One row per (user_id, milestone_id). The milestone_id is a stable
-- slug defined in `src/lib/milestones/types.ts`; new milestones can
-- be added without a schema change. Status is a small enum; notes is
-- free-form for the customer to capture details ("filed via Sarah Lee
-- on 2026-04-30, registration #12345").

create table if not exists public.regulatory_milestones (
  user_id uuid not null references auth.users(id) on delete cascade,
  milestone_id text not null,
  status text not null check (status in ('pending', 'in_progress', 'complete', 'skipped')),
  target_date date,
  completed_at timestamptz,
  notes text,
  updated_at timestamptz not null default now(),
  primary key (user_id, milestone_id)
);

create index if not exists regulatory_milestones_user_idx
  on public.regulatory_milestones (user_id);

-- Auto-touch updated_at on every UPDATE so callers don't need to set
-- it explicitly.
create or replace function public.touch_regulatory_milestones_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_regulatory_milestones_updated_at on public.regulatory_milestones;
create trigger touch_regulatory_milestones_updated_at
  before update on public.regulatory_milestones
  for each row
  execute function public.touch_regulatory_milestones_updated_at();

-- Row-Level Security: each user sees + writes only their own rows.
alter table public.regulatory_milestones enable row level security;

create policy "users can read own regulatory milestones"
  on public.regulatory_milestones
  for select
  using (auth.uid() = user_id);

create policy "users can insert own regulatory milestones"
  on public.regulatory_milestones
  for insert
  with check (auth.uid() = user_id);

create policy "users can update own regulatory milestones"
  on public.regulatory_milestones
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete own regulatory milestones"
  on public.regulatory_milestones
  for delete
  using (auth.uid() = user_id);

comment on table public.regulatory_milestones is
  'Per-user external regulatory milestones (entity, EIN, trademark, FDD filings, etc.). Distinct from customer_memory which tracks Blueprint chapter content.';
