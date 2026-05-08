-- Cadence — schema minimal pour V5 perso (Cyril unique user)
-- Multi-tenant viendra plus tard (V5.1 SaaS)

create table if not exists linkedin_tokens (
  id uuid primary key default gen_random_uuid(),
  linkedin_user_id text not null,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz not null,
  scope text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists linkedin_tokens_user_idx on linkedin_tokens(linkedin_user_id);

-- Service role uniquement (pas de RLS user-side pour V5 perso)
alter table linkedin_tokens enable row level security;

-- Logs de publi (audit + retry)
create table if not exists publish_log (
  id uuid primary key default gen_random_uuid(),
  notion_page_id text,
  linkedin_post_urn text,
  status text not null,
  error text,
  created_at timestamptz default now()
);

create index if not exists publish_log_created_idx on publish_log(created_at desc);
