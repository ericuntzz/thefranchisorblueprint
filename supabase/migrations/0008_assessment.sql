-- Replaces the JotForm-hosted Franchise Readiness Assessment with our own
-- in-house quiz engine. Two tables:
--
--   assessment_sessions   — one row per assessment attempt. Created when the
--                           user answers Q1 (no email gate at start). Lead
--                           capture happens at the end and updates this row.
--   assessment_responses  — one row per (session, question) answer. Lets us
--                           reconstruct the exact path a user took, drives
--                           per-category scoring, and supports save-state
--                           resume.
--
-- Both tables are service_role-only via RLS — the public assessment APIs
-- run server-side with the service_role client, never from the browser.

-- ─── assessment_sessions ────────────────────────────────────────────────────
create table if not exists public.assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  -- Linked at email-capture time, when we either match an existing user by
  -- email or just store the email anonymously (we don't auto-create auth
  -- users from a free assessment — that happens on a paid Stripe purchase).
  user_id uuid references auth.users(id) on delete set null,

  -- Lead capture fields (collected at the END, gated behind results).
  email text,
  first_name text,
  business_name text,
  annual_revenue text,        -- "<$250k" | "$250k-$500k" | "$500k-$1M" | "$1M-$5M" | "$5M+"
  urgency text,               -- "ready_now" | "3_months" | "6_months" | "exploring"

  -- Computed score state. Nullable until completed_at is set.
  total_score int,            -- 0–45
  band text,                  -- 'franchise_ready' | 'nearly_there' | 'building_foundation' | 'early_stage'
  category_scores jsonb,      -- { business_model: 8, financials: 5, ... }

  -- Lifecycle timestamps.
  started_at timestamptz not null default now(),
  completed_at timestamptz,

  -- Save-state resume token. Returned to the client as a cookie so they can
  -- pick up where they left off if they close the tab. Nullable so we can
  -- rotate it without dropping a session.
  resume_token text unique,

  -- Lightweight observability.
  ip text,
  user_agent text,
  -- Where the assessment was started from — homepage hero, pricing card,
  -- programs page CTA, etc. Helps measure which surfaces drive the funnel.
  source text
);

create index if not exists assessment_sessions_email_idx
  on public.assessment_sessions (email);
create index if not exists assessment_sessions_user_idx
  on public.assessment_sessions (user_id);
create index if not exists assessment_sessions_completed_idx
  on public.assessment_sessions (completed_at desc nulls last);
create index if not exists assessment_sessions_resume_idx
  on public.assessment_sessions (resume_token)
  where resume_token is not null;

alter table public.assessment_sessions enable row level security;
-- service_role only; no public RLS policies.

comment on table public.assessment_sessions is
  'One row per Franchise Readiness Assessment attempt. Created on Q1 answer; finalized at lead-capture/submit. Service-role only.';

-- ─── assessment_responses ───────────────────────────────────────────────────
create table if not exists public.assessment_responses (
  session_id uuid not null references public.assessment_sessions(id) on delete cascade,
  -- Stable IDs from the question registry: 'q1' through 'q15'.
  question_id text not null,
  -- Answer letter A/B/C/D for radio questions; for slider questions the
  -- answer_value is the bucketed letter that maps to the same score band.
  answer_value text not null,
  answer_score int not null,    -- 0, 1, 2, or 3
  answered_at timestamptz not null default now(),

  primary key (session_id, question_id)
);

create index if not exists assessment_responses_session_idx
  on public.assessment_responses (session_id, answered_at);

alter table public.assessment_responses enable row level security;
-- service_role only.

comment on table public.assessment_responses is
  'Per-question answers for an assessment session. Indexed by session for fast scoring + per-category aggregation. Service-role only.';
