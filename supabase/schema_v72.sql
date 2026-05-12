-- Cadence V7.2 — additional tables

-- Brand DNA (editable persistent)
create table if not exists brand_dna (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('pilier','rule','hashtag','cta','hook','audience','format','anti_pattern')),
  label text not null,
  body jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table brand_dna enable row level security;

-- Inspirations (LinkedIn profiles + notes)
create table if not exists inspirations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text,
  avatar_url text,
  category text,
  score integer default 3,
  style_notes text,
  do_not_copy text,
  active boolean default true,
  created_at timestamptz not null default now()
);
alter table inspirations enable row level security;

-- Connectors registry (status, last sync, etc.)
create table if not exists connectors (
  id uuid primary key default gen_random_uuid(),
  kind text not null unique,
  config jsonb not null default '{}'::jsonb,
  status text not null default 'disconnected',
  last_sync_at timestamptz,
  last_error text,
  updated_at timestamptz default now()
);
alter table connectors enable row level security;

-- Suggestions (radar output)
create table if not exists suggestions (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_ref text,
  title text not null,
  hook text,
  angle text,
  pilier text,
  score integer default 50,
  why text,
  payload jsonb default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','used','ignored','saved')),
  created_at timestamptz not null default now(),
  unique (source, source_ref)
);
alter table suggestions enable row level security;
create index if not exists suggestions_status_idx on suggestions(status, created_at desc);
