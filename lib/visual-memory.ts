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

// === V23.1 — Visual scoring premium (SVG analysis) ===
//
// Analyse un SVG généré pour détecter les signaux "non premium" qu'un
// directeur artistique éditorial éviterait :
// - "trop Canva" : emojis dans le texte, gradients agressifs
// - "trop chargé" : > 60 éléments graphiques, > 80 nœuds path/rect
// - "trop coloré" : 4+ familles de couleurs distinctes
// - "trop IA" : SVG corrompu (oaicite, turn0…), placeholders Lorem
// - "trop pâle" : aucune accent color
//
// Renvoie un score 0-1 + raisons éditoriales lisibles. Pure function,
// pas d'IA, pas d'appel réseau.

export type VisualSignal = {
  kind:
    | 'too_canva'        // emojis, gradients agressifs
    | 'too_busy'         // trop d'éléments
    | 'too_colorful'     // trop de familles couleurs
    | 'too_ai'           // hallucinations / placeholders
    | 'too_pale'         // aucune couleur d'accent
    | 'lacks_hierarchy'  // pas d'élément central dominant
    | 'good';
  message: string;
  severity?: 'note' | 'soft' | 'firm';
};

export type VisualScore = {
  score: number;          // 0..1 (1 = premium)
  signals: VisualSignal[];
  meta: {
    elementCount: number;
    pathCount: number;
    rectCount: number;
    distinctColors: number;
    hasGradient: boolean;
    emojiInText: number;
    textBlocks: number;
  };
};

const BRIGHT_HEX_RE = /#(?:ff[0-9a-f]{4}|[0-9a-f]{2}ff[0-9a-f]{2}|[0-9a-f]{4}ff)/gi;
const GRADIENT_RE = /<(?:linearGradient|radialGradient)\b/gi;
const HEX_COLOR_RE = /#[0-9a-fA-F]{3,8}\b/g;
const PATH_RE = /<path\b/gi;
const RECT_RE = /<rect\b/gi;
const CIRCLE_RE = /<circle\b/gi;
const TEXT_RE = /<text\b[^>]*>([\s\S]*?)<\/text>/gi;
const AI_ARTIFACT_RE = /(oaicite|turn0search|grok_card|contentReference|attributableIndex|lorem ipsum|placeholder)/i;

export function scoreSvgPremium(svg: string): VisualScore {
  const meta = {
    elementCount: 0,
    pathCount: 0,
    rectCount: 0,
    distinctColors: 0,
    hasGradient: false,
    emojiInText: 0,
    textBlocks: 0,
  };
  const signals: VisualSignal[] = [];

  if (!svg || !svg.includes('<svg')) {
    return { score: 0, signals: [{ kind: 'too_ai', message: 'SVG vide ou mal formé.', severity: 'firm' }], meta };
  }

  // Comptages
  meta.pathCount = (svg.match(PATH_RE) || []).length;
  meta.rectCount = (svg.match(RECT_RE) || []).length;
  const circleCount = (svg.match(CIRCLE_RE) || []).length;
  meta.elementCount = meta.pathCount + meta.rectCount + circleCount;
  meta.hasGradient = GRADIENT_RE.test(svg);

  // Couleurs distinctes (normalisées à 6 chars upper)
  const colors = new Set<string>();
  let m: RegExpExecArray | null;
  HEX_COLOR_RE.lastIndex = 0;
  while ((m = HEX_COLOR_RE.exec(svg)) !== null) {
    const c = m[0].toUpperCase();
    // Familles approximées par les 4 premiers chars (ignore variations subtiles)
    colors.add(c.slice(0, 4));
  }
  meta.distinctColors = colors.size;

  // Text blocks + emojis
  const textMatches = Array.from(svg.matchAll(TEXT_RE));
  meta.textBlocks = textMatches.length;
  for (const tm of textMatches) {
    const inner = tm[1] || '';
    meta.emojiInText += (inner.match(/\p{Extended_Pictographic}/gu) || []).length;
  }

  // ─── Signaux ─────────────────────────────────────────────────────
  // 1. Hallucinations IA — drapeau rouge
  if (AI_ARTIFACT_RE.test(svg)) {
    signals.push({
      kind: 'too_ai',
      message: 'Le SVG contient un artefact technique IA (placeholder ou tag interne). À régénérer.',
      severity: 'firm',
    });
  }

  // 2. Emojis dans le texte = "trop Canva"
  if (meta.emojiInText > 0) {
    signals.push({
      kind: 'too_canva',
      message: `${meta.emojiInText} emoji${meta.emojiInText > 1 ? 's' : ''} dans le texte. Cadence préfère mots ou chiffres.`,
      severity: 'firm',
    });
  }

  // 3. Gradient + 4+ familles de couleur = "trop coloré"
  if (meta.distinctColors >= 5) {
    signals.push({
      kind: 'too_colorful',
      message: `${meta.distinctColors} familles de couleurs distinctes. Une seule famille d'accent suffit (bleu OU vert OU ambre).`,
      severity: 'soft',
    });
  }

  // 4. Trop d'éléments graphiques
  if (meta.elementCount > 80) {
    signals.push({
      kind: 'too_busy',
      message: `${meta.elementCount} éléments graphiques (path/rect/circle). Un visuel premium tient en moins de 60.`,
      severity: 'soft',
    });
  }

  // 5. Gradient agressif (≥ 2 ou couleurs très vives)
  const brightCount = (svg.match(BRIGHT_HEX_RE) || []).length;
  if (meta.hasGradient && brightCount >= 2) {
    signals.push({
      kind: 'too_canva',
      message: 'Gradient + couleurs très saturées. Cadence évite les fonds flashy.',
      severity: 'soft',
    });
  }

  // 6. Pas d'accent : moins de 2 couleurs au total (ou que du gris)
  if (meta.distinctColors <= 1) {
    signals.push({
      kind: 'too_pale',
      message: 'Aucun accent de couleur. Un visuel premium a une couleur signature.',
      severity: 'note',
    });
  }

  // 7. Pas de hiérarchie : pas de texte du tout dans un visuel
  if (meta.textBlocks === 0) {
    signals.push({
      kind: 'lacks_hierarchy',
      message: 'Aucun bloc de texte. Un visuel éditorial a au moins un titre court.',
      severity: 'note',
    });
  }

  // ─── Score final ─────────────────────────────────────────────────
  // Démarrage à 1, on retire 0.18 par firm, 0.10 par soft, 0.04 par note.
  let score = 1;
  for (const s of signals) {
    if (s.severity === 'firm') score -= 0.18;
    else if (s.severity === 'soft') score -= 0.10;
    else score -= 0.04;
  }
  score = Math.max(0, +score.toFixed(2));

  // Bonus : signal "good" si score >= 0.85
  if (signals.length === 0 || score >= 0.85) {
    signals.push({ kind: 'good', message: 'Visuel sobre et lisible.', severity: 'note' });
  }

  return { score, signals, meta };
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
