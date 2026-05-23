-- V12.1 — Visual memory layer
-- Appliquée le 2026-05-23 sur project eevxjdxoasbafqvawbsr via Supabase MCP
-- migration : v12_1_visual_memory_layer.
--
-- Stocke les visuels associés à des posts ou générés en standalone.
-- Sert de mémoire créative : Cadence peut comparer un nouveau visuel
-- à l'historique, détecter les patterns performants, proposer des
-- variations cohérentes avec la direction artistique passée.

create table if not exists visual_items (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid references content_items(id) on delete set null,

  source_type text not null check (source_type in (
    'cadence_claude',       -- généré par Claude (SVG)
    'cadence_dalle',        -- généré par DALL-E
    'figma_export',         -- importé depuis Figma
    'linkedin_published',   -- récupéré depuis un post LinkedIn publié
    'moodboard_ref',        -- image de référence (moodboard)
    'manual_upload',        -- upload manuel utilisateur
    'unknown'
  )),

  pilier text,                            -- pilier éditorial associé
  format text check (format in (
    'feature', 'schema', 'capture', 'illustration', 'carousel',
    'cover', 'quote', 'data', 'meme', 'photo', 'other'
  ) or format is null),

  composition text check (composition in (
    'centered', 'verticale', 'horizontale', 'grille', 'asymetrique',
    'minimaliste', 'dense', 'editorial', 'data_first', 'photo_first', 'other'
  ) or composition is null),

  url text,
  svg text,
  thumbnail_url text,

  prompt text,
  caption text,
  vision_tags text[],

  impressions integer,
  likes integer,
  comments integer,
  shares integer,

  published_at timestamptz,
  created_at timestamptz default now(),
  indexed_at timestamptz default now(),
  meta jsonb default '{}'::jsonb
);

create index if not exists visual_items_content_idx on visual_items (content_item_id);
create index if not exists visual_items_source_type_idx on visual_items (source_type);
create index if not exists visual_items_pilier_idx on visual_items (pilier);
create index if not exists visual_items_format_idx on visual_items (format);
create index if not exists visual_items_composition_idx on visual_items (composition);
create index if not exists visual_items_published_at_idx on visual_items (published_at desc nulls last);
create index if not exists visual_items_impressions_idx on visual_items (impressions desc nulls last);

create unique index if not exists visual_items_url_unique on visual_items (source_type, url) where url is not null;

alter table visual_items enable row level security;

comment on table visual_items is
  'V12.1 — Mémoire visuelle canonique. Service role only. Lie chaque visuel à son post, son pilier, son format, sa composition.';
