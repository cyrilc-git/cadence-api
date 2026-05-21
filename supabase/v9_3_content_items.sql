-- V9.3 — Table d'unification content_items (shadow-write).
-- Objectif : représenter chaque post de manière normalisée, indépendamment
-- de sa source (Notion, LinkedIn import, Cadence). Lecture seule côté UI
-- jusqu'à validation produit. Aucune dépendance dure : si la table n'existe
-- pas, lib/content-items.ts retombe sur la fusion live Notion + embeddings.
--
-- À appliquer manuellement via Supabase SQL editor quand la couche
-- shadow-write sera activée. Ne casse rien tant qu'elle n'est pas branchée.

create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),

  -- Provenance normalisée (cf. lib/provenance.ts SourceType)
  source_type text not null check (source_type in (
    'linkedin_published',
    'linkedin_import_zip',
    'notion_draft',
    'notion_archive',
    'cadence_generated',
    'unknown'
  )),
  confidence text not null check (confidence in ('confirmed', 'inferred', 'unknown')),

  -- Identifiants externes
  source_id text not null,              -- id Notion / source_ref pgvector / urn LI
  notion_page_id text,
  linkedin_urn text,
  linkedin_url text,
  canonical_url text,

  -- Contenu
  title text,
  excerpt text,
  pilier text,

  -- Cycle de vie
  published_at timestamptz,
  scheduled_at timestamptz,
  validation_status text check (validation_status in ('validated', 'pending') or validation_status is null),
  sync_status text check (sync_status in ('synced', 'pending', 'not_synced') or sync_status is null),

  -- Méta
  meta jsonb default '{}'::jsonb,
  last_synced_at timestamptz,
  indexed_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_at timestamptz default now(),

  -- Dédoublonnage côté lecture
  unique (source_type, source_id)
);

create index if not exists content_items_source_type_idx on content_items (source_type);
create index if not exists content_items_confidence_idx on content_items (confidence);
create index if not exists content_items_published_at_idx on content_items (published_at desc nulls last);
create index if not exists content_items_scheduled_at_idx on content_items (scheduled_at desc nulls last);

alter table content_items enable row level security;

comment on table content_items is
  'V9.3 unification layer. Shadow-write only until UI cutover. Lecture privilégie le live (Notion + post_embeddings) tant que cette table est vide.';
