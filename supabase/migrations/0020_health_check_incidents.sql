create table if not exists health_check_incidents (
  id          uuid primary key default gen_random_uuid(),
  check_name  text not null,
  severity    text not null check (severity in ('degraded', 'down')),
  latency_ms  int,
  detail      text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_health_incidents_recent
  on health_check_incidents (created_at desc);

alter table health_check_incidents enable row level security;
