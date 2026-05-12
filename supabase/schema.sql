-- Cadence Supabase schema
create table if not exists linkedin_tokens (
  id uuid primary key default gen_random_uuid(),
  linkedin_user_id text unique not null,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz not null,
  scope text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table linkedin_tokens enable row level security;

create table if not exists publish_log (
  id bigserial primary key,
  notion_page_id text,
  linkedin_post_urn text,
  status text not null,
  error text,
  meta jsonb,
  created_at timestamptz default now()
);
alter table publish_log enable row level security;

-- Storage bucket for visuals (run once via dashboard if not present)
-- insert into storage.buckets (id, name, public) values ('cadence-visuals', 'cadence-visuals', true);
