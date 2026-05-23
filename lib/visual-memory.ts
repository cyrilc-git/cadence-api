// V12.1 §2 — Mémoire visuelle.
// Lecture, écriture et analyse de la table visual_items. Cette couche permet
// à Cadence de mémoriser chaque visuel et de détecter ce qui fonctionne
// graphiquement (composition × performance, format × pilier, densité).

import { supabase } from './supabase';

export type VisualSourceType =
  | 'cadence_claude'
  | 'cadence_dalle'
  | 'figma_export'
  | 'linkedin_published'
  | 'moodboard_ref'
  | 'manual_upload'
  | 'unknown';

export type VisualFormat =
  | 'feature' | 'schema' | 'capture' | 'illustration' | 'carousel'
  | 'cover' | 'quote' | 'data' | 'meme' | 'photo' | 'other';

export type VisualComposition =
  | 'centered' | 'verticale' | 'horizontale' | 'grille' | 'asymetrique'
  | 'minimaliste' | 'dense' | 'editorial' | 'data_first' | 'photo_first' | 'other';

export type VisualItem = {
  id: string;
  content_item_id?: string | null;
  source_type: VisualSourceType;
  pilier?: string | null;
  format?: VisualFormat | null;
  composition?: VisualComposition | null;
  url?: string | null;
  svg?: string | null;
  thumbnail_url?: string | null;
  prompt?: string | null;
  caption?: string | null;
  vision_tags?: string[] | null;
  impressions?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  published_at?: string | null;
  created_at?: string | null;
  meta?: any;
};

// === Lecture ===

export async function listVisualItems(opts?: { limit?: number; pilier?: string; format?: VisualFormat; sourceType?: VisualSourceType }): Promise<VisualItem[]> {
  let q = supabase.from('visual_items').select('*').order('published_at', { ascending: false, nullsFirst: false }).limit(opts?.limit ?? 50);
  if (opts?.pilier) q = q.eq('pilier', opts.pilier);
  if (opts?.format) q = q.eq('format', opts.format);
  if (opts?.sourceType) q = q.eq('source_type', opts.sourceType);
  const { data, error } = await q;
  if (error) return [];
  return (data || []) as VisualItem[];
}

export async function topVisualsByImpressions(opts?: { limit?: number }): Promise<VisualItem[]> {
  const { data } = await supabase
    .from('visual_items')
    .select('*')
    .not('impressions', 'is', null)
    .gt('impressions', 0)
    .order('impressions', { ascending: false })
    .limit(opts?.limit ?? 5);
  return (data || []) as VisualItem[];
}

// === Écriture (idempotent) ===

export type RecordVisualInput = Partial<VisualItem> & {
  source_type: VisualSourceType;
};

export async function recordVisualItem(input: RecordVisualInput): Promise<VisualItem | null> {
  const row = {
    content_item_id: input.content_item_id || null,
    source_type: input.source_type,
    pilier: input.pilier || null,
    format: input.format || null,
    composition: input.composition || null,
    url: input.url || null,
    svg: input.svg || null,
    thumbnail_url: input.thumbnail_url || null,
    prompt: input.prompt || null,
    caption: input.caption || null,
    vision_tags: input.vision_tags || null,
    impressions: input.impressions ?? null,
    likes: input.likes ?? null,
    comments: input.comments ?? null,
    shares: input.shares ?? null,
    published_at: input.published_at || null,
    meta: input.meta || {},
    indexed_at: new Date().toISOString(),
  };

  // Si URL fournie : upsert par (source_type, url)
  if (input.url) {
    const { data, error } = await supabase
      .from('visual_items')
      .upsert(row, { onConflict: 'source_type,url' })
      .select()
      .single();
    if (error) return null;
    return data as VisualItem;
  }

  // Sinon : insert simple
  const { data, error } = await supabase.from('visual_items').insert(row).select().single();
  if (error) return null;
  return data as VisualItem;
}

// === Analyse patterns ===

export type VisualPattern = {
  kind: 'composition_performance' | 'format_performance' | 'density_trend' | 'low_data';
  message: string;
  severity?: 'low' | 'medium' | 'high';
  data?: any;
};

// V12.1 — Analyse simple : composition la plus performante (par impressions moyennes)
// vs la moins performante. Retourne aussi le format pilier dominant.
export async function analyzeVisualMemory(): Promise<VisualPattern[]> {
  const patterns: VisualPattern[] = [];
  const { data } = await supabase
    .from('visual_items')
    .select('composition, format, pilier, impressions')
    .not('impressions', 'is', null)
    .gt('impressions', 0)
    .limit(200);

  const rows = (data || []) as Array<{ composition?: string; format?: string; pilier?: string; impressions: number }>;
  if (rows.length < 6) {
    patterns.push({
      kind: 'low_data',
      message: `Seulement ${rows.length} visuel${rows.length > 1 ? 's' : ''} avec performance connue. La mémoire visuelle s'enrichira au fil des publications.`,
    });
    return patterns;
  }

  // 1. Composition × performance
  const compMap: Record<string, { sum: number; n: number }> = {};
  for (const r of rows) {
    if (!r.composition) continue;
    if (!compMap[r.composition]) compMap[r.composition] = { sum: 0, n: 0 };
    compMap[r.composition].sum += r.impressions;
    compMap[r.composition].n += 1;
  }
  const compAvg = Object.entries(compMap)
    .filter(([, v]) => v.n >= 3)
    .map(([k, v]) => ({ composition: k, avg: v.sum / v.n, count: v.n }))
    .sort((a, b) => b.avg - a.avg);
  if (compAvg.length >= 2) {
    const best = compAvg[0], worst = compAvg[compAvg.length - 1];
    if (best.avg > worst.avg * 1.3) {
      patterns.push({
        kind: 'composition_performance',
        severity: 'medium',
        message: `Vos meilleurs visuels utilisent une composition "${humanComposition(best.composition)}" (${Math.round(best.avg).toLocaleString('fr-FR')} impressions moyennes). À l'opposé, la composition "${humanComposition(worst.composition)}" performe ${Math.round(best.avg / Math.max(worst.avg, 1))}× moins.`,
        data: { best: best.composition, worst: worst.composition },
      });
    }
  }

  // 2. Format × pilier (le plus performant)
  const fmtMap: Record<string, { sum: number; n: number; pilier?: string }> = {};
  for (const r of rows) {
    if (!r.format) continue;
    const key = r.format;
    if (!fmtMap[key]) fmtMap[key] = { sum: 0, n: 0 };
    fmtMap[key].sum += r.impressions;
    fmtMap[key].n += 1;
    if (r.pilier) fmtMap[key].pilier = r.pilier;
  }
  const fmtAvg = Object.entries(fmtMap)
    .filter(([, v]) => v.n >= 3)
    .map(([k, v]) => ({ format: k, avg: v.sum / v.n, count: v.n, pilier: v.pilier }))
    .sort((a, b) => b.avg - a.avg);
  if (fmtAvg.length >= 1 && fmtAvg[0].avg > 0) {
    const top = fmtAvg[0];
    patterns.push({
      kind: 'format_performance',
      severity: 'low',
      message: `Vos visuels au format "${humanFormat(top.format)}" performent en moyenne ${Math.round(top.avg).toLocaleString('fr-FR')} impressions${top.pilier ? ` (souvent rattachés au pilier ${top.pilier})` : ''}.`,
      data: { format: top.format },
    });
  }

  return patterns;
}

// === Helpers d'affichage humain ===

export function humanComposition(c: string | null | undefined): string {
  switch (c) {
    case 'centered':      return 'centrée';
    case 'verticale':     return 'verticale';
    case 'horizontale':   return 'horizontale';
    case 'grille':        return 'en grille';
    case 'asymetrique':   return 'asymétrique';
    case 'minimaliste':   return 'minimaliste';
    case 'dense':         return 'dense';
    case 'editorial':     return 'éditoriale';
    case 'data_first':    return 'avec un chiffre principal';
    case 'photo_first':   return 'avec une photo dominante';
    default:              return c || 'inconnue';
  }
}

export function humanFormat(f: string | null | undefined): string {
  switch (f) {
    case 'feature':       return 'nouveauté produit';
    case 'schema':        return 'schéma pédagogique';
    case 'capture':       return 'capture annotée';
    case 'illustration':  return 'illustration';
    case 'carousel':      return 'carrousel';
    case 'cover':         return 'couverture';
    case 'quote':         return 'citation';
    case 'data':          return 'data visuelle';
    case 'meme':          return 'meme';
    case 'photo':         return 'photo';
    default:              return f || 'autre';
  }
}
