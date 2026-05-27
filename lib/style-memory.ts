// V18.1 — Mémoire stylistique personnelle
//
// Cadence regarde MES vrais posts LinkedIn et en extrait ma signature
// éditoriale : longueur moyenne du hook, structures dominantes, mots
// favoris, niveau de pédagogie, niveau de jargon, etc.
//
// Ce n'est PAS un clone ni un imitateur. C'est une description de patterns
// que Cadence utilise pour proposer à l'utilisateur :
// - écrire dans ma voix (par défaut)
// - sortir volontairement de mon style (exploration)
//
// Architecture :
// - analyzePostStyle(text) : extraction de signaux STYLISTIQUES sur 1 post
// - aggregateStyleMemory(posts) : agrège un corpus en une StyleMemory
// - persistStyleMemory(mem) : upsert dans la table style_memory
// - readStyleMemory() : lecture rapide (cache 5 min côté serveur)

import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export type PostStyle = {
  hookLen: number;
  hookSnippet: string;
  openingFirstWords: string;          // 4-6 premiers mots normalisés
  closingFirstWords: string;          // 4-6 mots du dernier para
  sentenceLen: number;
  paragraphLen: number;
  paragraphCount: number;
  postLen: number;
  // Niveaux 0-1
  jargonLevel: number;                // proportion de mots techniques / business
  pedagogicalLevel: number;           // proportion de marqueurs pédagogiques
  densityScore: number;               // mots utiles / mots totaux
  // Stats lexicales
  topWords: string[];                 // 5 mots non-stopword les plus utilisés
  // Présence
  hasNumbers: boolean;
  hasMetaphor: boolean;
  emojiCount: number;
};

export type StyleMemory = {
  avg_hook_len: number;
  avg_sentence_len: number;
  avg_paragraph_len: number;
  avg_paragraph_count: number;
  avg_post_len: number;
  jargon_level: number;
  pedagogical_level: number;
  density_score: number;
  top_hooks: string[];                // 5 hooks réels (snippets) à observer
  top_openings: string[];             // 5 "openings" répétés
  top_closings: string[];             // 5 fermetures répétées
  narrative_kinds: Record<string, number>;
  favorite_words: { word: string; count: number }[];
  metaphors: string[];
  repeated_phrases: string[];
  posts_analyzed: number;
  confidence_score: number;
  voice_summary: string;
  computed_at: string;
};

// ─────────────────────────────────────────────────────────────────────
// Stop words FR/EN minimaux
// ─────────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'le','la','les','un','une','des','de','du','à','au','aux','et','ou','mais','donc','car','ni',
  'que','qui','quoi','où','dont','si','en','dans','sur','sous','par','pour','avec','sans','vers',
  'je','tu','il','elle','on','nous','vous','ils','elles','me','te','se','lui','leur',
  'mon','ma','mes','ton','ta','tes','son','sa','ses','notre','nos','votre','vos',
  'ce','cet','cette','ces','ceci','cela','ça',
  'est','sont','était','étaient','sera','seront','être','suis','es','soit','soient',
  'ai','as','a','avons','avez','ont','avoir','eu','aura','auront','aurai',
  'plus','moins','très','aussi','même','toujours','jamais','déjà','encore','aucun','tout','tous','toute','toutes',
  'mais','aussi','alors','puis','enfin','ensuite','après','avant','pendant','depuis','jusqu',
  'fait','faire','fais','faisait','fera','feront',
  'dit','dire','dis','disait','dirai','diront',
  'plus','peut','peu','très','bien','mal','si','non','oui',
  'mon','ses','y','d','l','s','t','n','m','c','j','qu',
  'the','a','an','and','or','of','to','in','for','on','at','with','from','by','is','are','was','were',
  'this','that','these','those','it','its','his','her','their','our','your','my','as','be','been','being',
]);

// Marqueurs pédagogiques (étapes, comment, pourquoi…)
const PEDAGOGICAL_MARKERS = [
  /\bétape\s*\d*\b/gi, /\bstep\s*\d*\b/gi,
  /\bleçon\b/gi, /\b(comment|pourquoi)\b/gi,
  /\b(premièrement|deuxièmement|troisièmement)\b/gi,
  /\b(d['e]?abord|ensuite|enfin|finalement)\b/gi,
  /\bvoici\b/gi, /\bexemple\b/gi,
  /^\s*\d+[.)]\s+/gm,
];

// Jargon SaaS / finance / management
const JARGON_WORDS = [
  'cac','ltv','ltv\\/cac','mrr','arr','churn','onboarding','funnel','pipeline','growth','scale','runway','burn',
  'dso','dpo','dio','bfr','ebitda','wcr','treasury','cash flow','fcf','opex','capex','p&l',
  'kpi','okr','roi','sla','sso','rbac','crm','erp','saas','b2b','b2c','smb','pme','tpe','eti','daf','cfo','ceo','cto',
  'stakeholder','alignement','synergie','optimisation','transformation','digitalisation','agilité','itération',
];

const METAPHOR_HINTS = [
  /\bcomme\s+(?:un|une|le|la|les)\b/gi,
  /\b(?:imaginez|imaginons|c['e]?est un peu comme)\b/gi,
  /\b(?:ressemble\s+à|fait\s+penser\s+à|même chose que)\b/gi,
];

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.normalize('NFC').trim();
}

function tokens(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);
}

function paragraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
}

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
}

function firstLine(text: string): string {
  const ls = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  return ls[0] || '';
}

function firstWords(text: string, n = 5): string {
  return text.split(/\s+/).slice(0, n).join(' ');
}

// ─────────────────────────────────────────────────────────────────────
// Analyse 1 post
// ─────────────────────────────────────────────────────────────────────

export function analyzePostStyle(text: string): PostStyle {
  const t = normalize(text);
  const ps = paragraphs(t);
  const ss = sentences(t);
  const fl = firstLine(t);
  const lastP = ps[ps.length - 1] || '';

  const allTokens = tokens(t);
  const totalWords = allTokens.length;

  // Pédagogie : compte les hits des marqueurs / longueur du texte
  let pedHits = 0;
  for (const re of PEDAGOGICAL_MARKERS) {
    const m = t.match(re);
    if (m) pedHits += m.length;
  }
  const pedagogicalLevel = Math.min(1, pedHits / Math.max(1, ss.length / 3));

  // Jargon : compte les mots techniques / total
  let jargonHits = 0;
  for (const jw of JARGON_WORDS) {
    const re = new RegExp('\\b' + jw + '\\b', 'gi');
    const m = t.match(re);
    if (m) jargonHits += m.length;
  }
  const jargonLevel = Math.min(1, jargonHits / Math.max(1, totalWords / 50));

  // Densité : (mots non-stopword) / (mots total). Plus haut = plus dense.
  const useful = allTokens.filter(w => !STOPWORDS.has(w));
  const densityScore = useful.length / Math.max(1, totalWords);

  // Métaphore
  const hasMetaphor = METAPHOR_HINTS.some(re => re.test(t));

  // Chiffres significatifs
  const hasNumbers = /\b\d{2,}\b|\b\d+\s*[%€$]/.test(t);

  // Emojis
  const emojiCount = (t.match(/\p{Extended_Pictographic}/gu) || []).length;

  // Top words : non-stopword, longueur ≥ 4, fréquence dans le post
  const wordCounts: Record<string, number> = {};
  for (const w of useful) {
    if (w.length < 4) continue;
    wordCounts[w] = (wordCounts[w] || 0) + 1;
  }
  const topWords = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);

  return {
    hookLen: fl.length,
    hookSnippet: fl.slice(0, 100),
    openingFirstWords: firstWords(fl, 5),
    closingFirstWords: firstWords(lastP, 5),
    sentenceLen: ss.length > 0 ? Math.round(t.length / ss.length) : 0,
    paragraphLen: ps.length > 0 ? Math.round(t.length / ps.length) : 0,
    paragraphCount: ps.length,
    postLen: t.length,
    jargonLevel,
    pedagogicalLevel,
    densityScore,
    topWords,
    hasNumbers,
    hasMetaphor,
    emojiCount,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Agrégation d'un corpus de posts
// ─────────────────────────────────────────────────────────────────────

function modeOfStrings(arr: string[], topN = 5): string[] {
  const counts: Record<string, number> = {};
  for (const s of arr) {
    const k = s.toLowerCase();
    counts[k] = (counts[k] || 0) + 1;
  }
  return Object.entries(counts)
    .filter(([, c]) => c >= 2) // ne garde que si répété au moins 2 fois
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([s]) => s);
}

export function aggregateStyleMemory(
  posts: { text: string; narrativeKind?: string | null }[]
): StyleMemory {
  if (posts.length === 0) {
    return emptyStyleMemory();
  }

  const styles = posts.map(p => ({ s: analyzePostStyle(p.text), narrativeKind: p.narrativeKind || 'none' }));

  const avg = (k: keyof PostStyle) => {
    const vals = styles.map(({ s }) => Number(s[k] as any)).filter(v => Number.isFinite(v));
    return vals.length === 0 ? 0 : vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const top_hooks = modeOfStrings(styles.map(({ s }) => s.hookSnippet), 5);
  const top_openings = modeOfStrings(styles.map(({ s }) => s.openingFirstWords), 5);
  const top_closings = modeOfStrings(styles.map(({ s }) => s.closingFirstWords), 5);

  // Narrative kinds count
  const narrative_kinds: Record<string, number> = {};
  for (const { narrativeKind } of styles) {
    if (!narrativeKind || narrativeKind === 'none') continue;
    narrative_kinds[narrativeKind] = (narrative_kinds[narrativeKind] || 0) + 1;
  }

  // Favorite words : agrège top words de chaque post, garde ceux qui reviennent
  const wordTotals: Record<string, number> = {};
  for (const { s } of styles) {
    for (const w of s.topWords) {
      wordTotals[w] = (wordTotals[w] || 0) + 1;
    }
  }
  const favorite_words = Object.entries(wordTotals)
    .filter(([, c]) => c >= Math.max(2, Math.floor(posts.length / 4)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([word, count]) => ({ word, count }));

  // Métaphores : on garde la liste des posts où une métaphore est détectée
  const metaphors: string[] = styles
    .filter(({ s }) => s.hasMetaphor)
    .map(({ s }) => s.hookSnippet)
    .slice(0, 5);

  // Phrases répétées : si plusieurs posts commencent par les MÊMES 4-5 mots,
  // c'est une signature à signaler.
  const repeated_phrases = modeOfStrings(
    styles.flatMap(({ s }) => [s.openingFirstWords, s.closingFirstWords]),
    6
  );

  // Confidence : 0 → 1, plafonne autour de 30 posts
  const confidence_score = Math.min(1, posts.length / 30);

  // Voice summary prose (200-400 chars)
  const voice_summary = buildVoiceSummary({
    avg_hook_len: avg('hookLen'),
    avg_paragraph_count: avg('paragraphCount'),
    avg_post_len: avg('postLen'),
    pedagogical_level: avg('pedagogicalLevel'),
    jargon_level: avg('jargonLevel'),
    density_score: avg('densityScore'),
    top_openings,
    top_closings,
    posts_analyzed: posts.length,
  });

  return {
    avg_hook_len: Math.round(avg('hookLen')),
    avg_sentence_len: Math.round(avg('sentenceLen')),
    avg_paragraph_len: Math.round(avg('paragraphLen')),
    avg_paragraph_count: +avg('paragraphCount').toFixed(1),
    avg_post_len: Math.round(avg('postLen')),
    jargon_level: +avg('jargonLevel').toFixed(2),
    pedagogical_level: +avg('pedagogicalLevel').toFixed(2),
    density_score: +avg('densityScore').toFixed(2),
    top_hooks,
    top_openings,
    top_closings,
    narrative_kinds,
    favorite_words,
    metaphors,
    repeated_phrases,
    posts_analyzed: posts.length,
    confidence_score: +confidence_score.toFixed(2),
    voice_summary,
    computed_at: new Date().toISOString(),
  };
}

function emptyStyleMemory(): StyleMemory {
  return {
    avg_hook_len: 0, avg_sentence_len: 0, avg_paragraph_len: 0,
    avg_paragraph_count: 0, avg_post_len: 0,
    jargon_level: 0, pedagogical_level: 0, density_score: 0,
    top_hooks: [], top_openings: [], top_closings: [],
    narrative_kinds: {}, favorite_words: [], metaphors: [], repeated_phrases: [],
    posts_analyzed: 0, confidence_score: 0,
    voice_summary: 'Cadence n\'a pas encore de signal stylistique. Publiez ou importez quelques posts LinkedIn pour activer la mémoire de voix.',
    computed_at: new Date().toISOString(),
  };
}

function buildVoiceSummary(s: {
  avg_hook_len: number; avg_paragraph_count: number; avg_post_len: number;
  pedagogical_level: number; jargon_level: number; density_score: number;
  top_openings: string[]; top_closings: string[]; posts_analyzed: number;
}): string {
  const bits: string[] = [];
  // Longueur
  if (s.avg_post_len < 600) bits.push('posts plutôt courts');
  else if (s.avg_post_len < 1100) bits.push('posts de longueur moyenne');
  else bits.push('posts longs');
  // Hook
  if (s.avg_hook_len < 70) bits.push('hooks serrés');
  else if (s.avg_hook_len < 130) bits.push('hooks équilibrés');
  else bits.push('hooks longs');
  // Pédagogie vs autre
  if (s.pedagogical_level > 0.4) bits.push('tonalité pédagogique marquée');
  else if (s.pedagogical_level > 0.15) bits.push('un peu pédagogique');
  // Jargon
  if (s.jargon_level > 0.3) bits.push('vocabulaire métier dense');
  else if (s.jargon_level > 0.1) bits.push('quelques termes métier');
  else bits.push('vocabulaire simple');
  // Densité
  if (s.density_score > 0.55) bits.push('phrases denses');
  else bits.push('phrases aérées');
  // Aération
  if (s.avg_paragraph_count > 5) bits.push('paragraphes nombreux');
  else bits.push('quelques paragraphes');

  const openingsLine = s.top_openings.length > 0
    ? ` Vous commencez souvent par « ${s.top_openings[0]}… ».`
    : '';
  const closingsLine = s.top_closings.length > 0
    ? ` Vous terminez souvent par « ${s.top_closings[0]}… ».`
    : '';

  return `Sur ${s.posts_analyzed} post${s.posts_analyzed > 1 ? 's' : ''} analysé${s.posts_analyzed > 1 ? 's' : ''} : ${bits.join(', ')}.${openingsLine}${closingsLine}`;
}

// ─────────────────────────────────────────────────────────────────────
// Persistance Supabase
// ─────────────────────────────────────────────────────────────────────

export async function persistStyleMemory(mem: StyleMemory): Promise<{ ok: boolean; error?: string }> {
  try {
    // Une seule row globale : on cherche la première, on update, sinon insert.
    const { data: existing } = await supabase
      .from('style_memory')
      .select('id')
      .order('updated_at', { ascending: false })
      .limit(1);
    const row = {
      avg_hook_len: mem.avg_hook_len,
      avg_sentence_len: mem.avg_sentence_len,
      avg_paragraph_len: mem.avg_paragraph_len,
      avg_paragraph_count: mem.avg_paragraph_count,
      avg_post_len: mem.avg_post_len,
      jargon_level: mem.jargon_level,
      pedagogical_level: mem.pedagogical_level,
      density_score: mem.density_score,
      top_hooks: mem.top_hooks,
      top_openings: mem.top_openings,
      top_closings: mem.top_closings,
      narrative_kinds: mem.narrative_kinds,
      favorite_words: mem.favorite_words,
      metaphors: mem.metaphors,
      repeated_phrases: mem.repeated_phrases,
      posts_analyzed: mem.posts_analyzed,
      confidence_score: mem.confidence_score,
      voice_summary: mem.voice_summary,
      computed_at: mem.computed_at,
    };
    if (existing && existing.length > 0) {
      const { error } = await supabase.from('style_memory').update(row).eq('id', existing[0].id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase.from('style_memory').insert(row);
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function readStyleMemory(): Promise<StyleMemory | null> {
  try {
    const { data, error } = await supabase
      .from('style_memory')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return {
      avg_hook_len: Number(data.avg_hook_len) || 0,
      avg_sentence_len: Number(data.avg_sentence_len) || 0,
      avg_paragraph_len: Number(data.avg_paragraph_len) || 0,
      avg_paragraph_count: Number(data.avg_paragraph_count) || 0,
      avg_post_len: Number(data.avg_post_len) || 0,
      jargon_level: Number(data.jargon_level) || 0,
      pedagogical_level: Number(data.pedagogical_level) || 0,
      density_score: Number(data.density_score) || 0,
      top_hooks: data.top_hooks || [],
      top_openings: data.top_openings || [],
      top_closings: data.top_closings || [],
      narrative_kinds: data.narrative_kinds || {},
      favorite_words: data.favorite_words || [],
      metaphors: data.metaphors || [],
      repeated_phrases: data.repeated_phrases || [],
      posts_analyzed: Number(data.posts_analyzed) || 0,
      confidence_score: Number(data.confidence_score) || 0,
      voice_summary: data.voice_summary || '',
      computed_at: data.computed_at || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// V21.1 — Score de similarité stylistique
//
// Compare un brouillon à la signature StyleMemory et renvoie un score
// 0-1 + un libellé éditorial : "très vous" / "un peu vous" / "éloigné
// de votre voix". Permet à Cadence de murmurer ("ce post sonne moins
// que d'habitude") sans bloquer ni juger.
//
// Heuristique multi-critère pondérée, pas de cosine ML. On regarde :
//  - longueur du post vs moyenne habituelle
//  - longueur du hook vs moyenne
//  - niveau pédagogique
//  - niveau de jargon
//  - densité
//  - présence d'un opening très récurrent
// ─────────────────────────────────────────────────────────────────────

export type StyleSimilarity = {
  score: number;                                 // 0..1
  label: 'tres_vous' | 'un_peu_vous' | 'eloigne' | 'inconnu';
  message: string;
  reasons: string[];                             // 1-3 raisons lisibles
  confidence: number;                            // confiance globale 0..1
};

/** Renvoie 1 - écart normalisé entre a et b, sur une échelle [0,scale].
 *  Score 1 quand a === b, 0 quand l'écart dépasse `scale`. */
function proximity(a: number, b: number, scale: number): number {
  if (scale <= 0) return 1;
  const diff = Math.abs(a - b) / scale;
  return Math.max(0, 1 - diff);
}

export function scoreStyleSimilarity(draft: string, mem: StyleMemory | null): StyleSimilarity {
  if (!mem || mem.posts_analyzed < 5 || mem.confidence_score < 0.2) {
    return {
      score: 0, label: 'inconnu', message: '', reasons: [],
      confidence: mem ? mem.confidence_score : 0,
    };
  }
  if (!draft || draft.trim().length < 120) {
    return {
      score: 0, label: 'inconnu', message: '', reasons: [],
      confidence: mem.confidence_score,
    };
  }

  const s = analyzePostStyle(draft);
  const reasons: string[] = [];

  // Pondération : on privilégie ce qui est le plus signature (jargon,
  // hook, longueur). La densité et la pédagogie pèsent moins.
  const lengthScore     = proximity(s.postLen, mem.avg_post_len, Math.max(300, mem.avg_post_len * 0.7));
  const hookScore       = proximity(s.hookLen, mem.avg_hook_len, Math.max(40, mem.avg_hook_len * 0.6));
  const pedagScore      = proximity(s.pedagogicalLevel, mem.pedagogical_level, 0.5);
  const jargonScore     = proximity(s.jargonLevel, mem.jargon_level, 0.3);
  const densityScore    = proximity(s.densityScore, mem.density_score, 0.2);

  // Opening match : si l'ouverture commence exactement comme un top
  // opening, gros bonus. Sinon score neutre.
  let openingScore = 0.5;
  if (mem.top_openings.length > 0) {
    const opening = s.openingFirstWords.toLowerCase();
    const matched = mem.top_openings.some(o => {
      const oN = o.toLowerCase();
      return oN === opening || (opening.length > 5 && opening.startsWith(oN.slice(0, 10)));
    });
    openingScore = matched ? 1 : 0.4;
  }

  // Pondérations (somme = 1)
  const score =
    lengthScore  * 0.20 +
    hookScore    * 0.20 +
    pedagScore   * 0.12 +
    jargonScore  * 0.18 +
    densityScore * 0.10 +
    openingScore * 0.20;

  // Raisons : ce qui s'éloigne le plus
  if (lengthScore < 0.5) {
    if (s.postLen < mem.avg_post_len * 0.6) reasons.push('post plus court que votre habitude');
    else if (s.postLen > mem.avg_post_len * 1.5) reasons.push('post plus long que votre habitude');
  }
  if (hookScore < 0.5) {
    if (s.hookLen < mem.avg_hook_len * 0.6) reasons.push('hook plus serré que d\'habitude');
    else if (s.hookLen > mem.avg_hook_len * 1.5) reasons.push('hook plus long que d\'habitude');
  }
  if (jargonScore < 0.4) {
    if (s.jargonLevel > mem.jargon_level + 0.15) reasons.push('vocabulaire métier plus dense que d\'habitude');
    else if (s.jargonLevel < mem.jargon_level - 0.15 && mem.jargon_level > 0.15) reasons.push('moins de jargon métier que d\'habitude');
  }
  if (pedagScore < 0.4) {
    if (s.pedagogicalLevel > mem.pedagogical_level + 0.2) reasons.push('plus pédagogique que d\'habitude');
    else if (s.pedagogicalLevel < mem.pedagogical_level - 0.2 && mem.pedagogical_level > 0.2) reasons.push('moins pédagogique que d\'habitude');
  }

  // Libellé éditorial
  let label: StyleSimilarity['label'];
  let message = '';
  if (score >= 0.72) {
    label = 'tres_vous';
    message = 'Ce post sonne très vous.';
  } else if (score >= 0.5) {
    label = 'un_peu_vous';
    message = 'Ce post ressemble à votre voix, avec quelques inflexions.';
  } else {
    label = 'eloigne';
    message = 'Ce post s\'éloigne de votre voix habituelle.';
    if (reasons.length === 0) reasons.push('plusieurs signaux stylistiques sortent de votre moyenne');
  }

  return {
    score: +score.toFixed(2),
    label,
    message,
    reasons: reasons.slice(0, 3),
    confidence: mem.confidence_score,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Pipeline : recompute depuis les posts LinkedIn confirmés
// ─────────────────────────────────────────────────────────────────────

export async function recomputeStyleMemory(): Promise<{ ok: boolean; analyzed: number; error?: string }> {
  try {
    // On prend les posts confirmés LinkedIn (URL vérifiée OU import ZIP),
    // jusqu'à 50 récents. Suffisant pour une bonne signature.
    const { data, error } = await supabase
      .from('content_items')
      .select('content, narrative_kind:meta')
      .or('source_type.eq.linkedin_published,source_type.eq.linkedin_import_zip')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(50);
    if (error) return { ok: false, analyzed: 0, error: error.message };
    const posts = (data || [])
      .filter(r => r.content && r.content.trim().length > 100)
      .map(r => ({
        text: r.content as string,
        narrativeKind: (r.narrative_kind as any)?.narrative_kind || null,
      }));
    if (posts.length === 0) {
      return { ok: true, analyzed: 0 };
    }
    const mem = aggregateStyleMemory(posts);
    const res = await persistStyleMemory(mem);
    if (!res.ok) return { ok: false, analyzed: posts.length, error: res.error };
    return { ok: true, analyzed: posts.length };
  } catch (e: any) {
    return { ok: false, analyzed: 0, error: e.message };
  }
}
