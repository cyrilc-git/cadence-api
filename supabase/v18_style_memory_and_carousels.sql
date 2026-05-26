-- V18 — Mémoire stylistique personnelle + Carrousels éditoriaux PDF
-- À appliquer manuellement via Supabase Dashboard (SQL editor) OU via
-- supabase CLI. Une fois appliquée, le code lib/style-memory.ts et
-- lib/carousel.ts peuvent commencer à peupler ces tables.
--
-- Idempotent : tout est CREATE IF NOT EXISTS / DROP POLICY IF EXISTS.

-- ============================================================================
-- V18.1 — Mémoire stylistique personnelle
-- ============================================================================
-- Une seule row "global" pour l'utilisateur (single-user app), recalculée
-- périodiquement à partir des posts LinkedIn publiés. Toutes les métriques
-- en JSONB pour garder la flexibilité.

CREATE TABLE IF NOT EXISTS public.style_memory (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Métriques quantitatives
  avg_hook_len            numeric,
  avg_sentence_len        numeric,
  avg_paragraph_len       numeric,
  avg_paragraph_count     numeric,
  avg_post_len            numeric,
  jargon_level            numeric,
  pedagogical_level       numeric,
  density_score           numeric,
  -- Patterns détectés (JSONB pour la flexibilité)
  top_hooks               jsonb DEFAULT '[]'::jsonb,
  top_openings            jsonb DEFAULT '[]'::jsonb,
  top_closings            jsonb DEFAULT '[]'::jsonb,
  narrative_kinds         jsonb DEFAULT '{}'::jsonb,
  favorite_words          jsonb DEFAULT '[]'::jsonb,
  metaphors               jsonb DEFAULT '[]'::jsonb,
  repeated_phrases        jsonb DEFAULT '[]'::jsonb,
  -- Méta
  posts_analyzed          integer DEFAULT 0,
  confidence_score        numeric,                       -- 0-1, augmente avec le volume analysé
  voice_summary           text,                          -- résumé éditorial prose 200-400 chars
  computed_at             timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION style_memory_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_style_memory_updated_at ON public.style_memory;
CREATE TRIGGER trg_style_memory_updated_at
BEFORE UPDATE ON public.style_memory
FOR EACH ROW EXECUTE FUNCTION style_memory_set_updated_at();

ALTER TABLE public.style_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full ON public.style_memory;
CREATE POLICY service_role_full ON public.style_memory FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- V18.6 — Carrousels éditoriaux PDF
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.carousel_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id       uuid REFERENCES public.content_items(id) ON DELETE SET NULL,
  title                 text NOT NULL DEFAULT '',
  format                text NOT NULL DEFAULT 'pedagogical',
  -- format : pedagogical | framework | breakdown | case-study | timeline | comparison
  pilier                text,
  -- Structure narrative découpée
  slides                jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- slides : [{ kind: 'hook'|'reveal'|'proof'|'step'|'conclusion'|'cta', title, body, accent }]
  narrative_structure   text,
  visual_theme          text DEFAULT 'minimal',
  -- Export
  export_pdf_url        text,
  export_pdf_pages      integer,
  cover_url             text,
  -- Performance LinkedIn (rempli quand publié)
  impressions           integer,
  likes                 integer,
  comments              integer,
  -- Méta
  status                text NOT NULL DEFAULT 'draft',  -- draft | exported | published
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_carousel_items_content ON public.carousel_items(content_item_id);
CREATE INDEX IF NOT EXISTS idx_carousel_items_status ON public.carousel_items(status);

CREATE OR REPLACE FUNCTION carousel_items_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_carousel_items_updated_at ON public.carousel_items;
CREATE TRIGGER trg_carousel_items_updated_at
BEFORE UPDATE ON public.carousel_items
FOR EACH ROW EXECUTE FUNCTION carousel_items_set_updated_at();

ALTER TABLE public.carousel_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_full ON public.carousel_items;
CREATE POLICY service_role_full ON public.carousel_items FOR ALL TO service_role USING (true) WITH CHECK (true);
