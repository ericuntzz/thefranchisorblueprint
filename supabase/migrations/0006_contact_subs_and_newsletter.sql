-- Replaces ActiveCampaign as the system of record for inbound leads + newsletter signups.
-- Everything stays internal: form submissions land in Supabase, the cron drip processor
-- handles autoresponders + internal notifications via Resend templates.

-- ─── contact_submissions ────────────────────────────────────────────────────
-- One row per /contact form submission. Read by Eric/Jason via the Supabase
-- dashboard or a future internal admin view.
create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  first_name text,
  last_name text,
  business_name text,
  annual_revenue text,
  program_interest text,
  message text,
  -- IP + user agent for spam triage. Drop later if not useful.
  ip text,
  user_agent text,
  -- nullable link if the submitter happens to already be a customer
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists contact_submissions_email_idx
  on public.contact_submissions (email);
create index if not exists contact_submissions_created_idx
  on public.contact_submissions (created_at desc);

alter table public.contact_submissions enable row level security;
-- service_role only; no public RLS policies.

-- ─── newsletter_subscribers ────────────────────────────────────────────────
-- One row per email that has subscribed to the blog newsletter. Email is
-- unique — re-submitting an existing email is a no-op (handled at app layer).
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text not null default 'blog',
  -- soft unsubscribe — we keep the row for analytics, just stop sending.
  unsubscribed_at timestamptz,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists newsletter_subscribers_active_idx
  on public.newsletter_subscribers (created_at desc)
  where unsubscribed_at is null;

alter table public.newsletter_subscribers enable row level security;
-- service_role only; no public RLS policies.
