-- V9.3 + V10.1 — Couche canonique content_items
-- Appliquée le 2026-05-22 sur project eevxjdxoasbafqvawbsr via Supabase MCP
-- migration : v10_1_content_items_canonical.
--
-- Stratégie : shadow-write Notion + post_embeddings vers content_items.
-- L'UI lit en priorité content_items si peuplée, sinon retombe sur la
-- fusion live (lib/content-items.ts fallback). Aucune dépendance dure.

create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),

  source_type text not null check (source_type in (
    'linkedin_published',
    'linkedin_import_zip',
    'notion_draft',
    'notion_archive',
    'cadence_generated',
    'unknown'
  )),
  confidence text not null check (confidence in ('confirmed', 'inferred', 'unknown')),
  canonical_source text not null check (canonical_source in ('linkedin', 'notion', 'cadence', 'unknown')),

  source_id text not null,
  notion_page_id text,
  linkedin_urn text,
  linkedin_url text,
  canonical_url text,

  title text,
  excerpt text,
  pilier text,

  published_at timestamptz,
  scheduled_at timestamptz,
  validation_status text check (validation_status in ('validated', 'pending') or validation_status is null),
  sync_status text check (sync_status in ('synced', 'pending', 'not_synced') or sync_status is null),

  embeddings_state text check (embeddings_state in ('indexed', 'pending', 'absent')) default 'absent',
  analytics_state text check (analytics_state in ('confirmed', 'inferred', 'absent')) default 'absent',

  meta jsonb default '{}'::jsonb,
  last_synced_at timestamptz,
  indexed_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_at timestamptz default now(),

  unique (source_type, source_id)
);

create index if not exists content_items_source_type_idx on content_items (source_type);
create index if not exists content_items_confidence_idx on content_items (confidence);
create index if not exists content_items_canonical_source_idx on content_items (canonical_source);
create index if not exists content_items_published_at_idx on content_items (published_at desc nulls last);
create index if not exists content_items_scheduled_at_idx on content_items (scheduled_at desc nulls last);
create index if not exists content_items_notion_page_id_idx on content_items (notion_page_id);
create index if not exists content_items_linkedin_urn_idx on content_items (linkedin_urn);

alter table content_items enable row level security;

comment on table content_items is
  'V10.1 — Couche canonique des posts. Service role only. Shadow-write Notion + post_embeddings. UI lit en priorité content_items si peuplée, sinon fallback live.';
