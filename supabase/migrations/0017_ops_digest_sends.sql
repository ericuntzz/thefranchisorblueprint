create table if not exists ops_digest_sends (
  id         uuid primary key default gen_random_uuid(),
  sent_to    text not null,
  payload    jsonb not null default '{}',
  sent_at    timestamptz not null default now()
);

alter table ops_digest_sends enable row level security;
