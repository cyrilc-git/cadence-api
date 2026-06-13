-- V54 — Texte integral des posts dans content_items.
-- Appliquee le 2026-06-10 sur le projet eevxjdxoasbafqvawbsr via Supabase MCP
-- (migration : add_content_column_to_content_items).
--
-- Pourquoi : content_items ne stockait qu'un `excerpt` (<= 600 car.). Le texte
-- integral vivait seulement dans Notion. Du coup :
--   - la memoire stylistique (style_memory) etait VIDE : fetchLinkedInCorpus
--     lisait deja la colonne `content` (inexistante) -> requete en erreur -> 0.
--   - la couverture LinkedIn etait partielle (~29%), bornee aux extraits.
--
-- Avec cette colonne + le backfill (scripts/backfill-linkedin-export.mjs qui
-- ecrit les posts en linkedin_import_zip AVEC content), style_memory se peuple
-- toute seule (le code attendait deja `content` + source_type linkedin_*).
--
-- Idempotent.

alter table public.content_items add column if not exists content text;

comment on column public.content_items.content is
  'V54 — texte integral du post (LinkedIn export / DMA portability). NULL pour les lignes anterieures qui n''ont qu''un extrait dans excerpt.';
