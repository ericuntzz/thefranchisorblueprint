create table if not exists stripe_reconciliation_issues (
  id          uuid primary key default gen_random_uuid(),
  stripe_ref  text not null unique,
  issue_type  text not null,
  details     jsonb not null default '{}',
  resolved    boolean not null default false,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_stripe_recon_unresolved
  on stripe_reconciliation_issues (resolved, created_at desc)
  where resolved = false;

alter table stripe_reconciliation_issues enable row level security;
