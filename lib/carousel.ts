// V18.6 — Carrousels éditoriaux : découpage post → slides
//
// Cadence prend un post LinkedIn (texte plat) et le transforme en plan
// de carrousel structuré. Pas de templates Canva. Pas d'IA visible.
// Logique d'éditeur : détecter ce que le texte ESSAIE déjà de dire,
// trouver le rythme naturel, équilibrer la densité par slide.
//
// API publique :
// - planSlides(text, opts?) → CarouselPlan
// - buildCoverSlide(plan) → Slide (génération de la slide de garde)
//
// Tout est pure JS, zéro dep externe. Le rendu PDF est dans
// lib/carousel-pdf.tsx (V18.7).

// V30.1 — Slide kinds étendus. Chaque kind correspond à un layout PDF
// dédié dans carousel-pdf.tsx, avec sa propre hiérarchie typographique.
// - hook        : ouverture, body large, accent fort
// - reveal      : retournement / scène, body medium
// - proof       : chiffre / fait, metric centré
// - step        : étape numérotée d'un framework, eyebrow + title
// - conclusion  : phrase de fermeture, body large, ink
// - cta         : appel à l'action sobre (rare)
// V30.2 — Nouveaux kinds :
// - quote       : citation extraite, italique, large
// - kpi         : carte KPI dédiée (gros chiffre + libellé court)
// - comparison  : avant/après ou X vs Y sur 2 colonnes
// - divider     : séparateur de section (eyebrow + filet, pas de body)
// - list        : liste à puces (3-5 items max)
export type SlideKind =
  | 'hook' | 'reveal' | 'proof' | 'step' | 'conclusion' | 'cta'
  | 'quote' | 'kpi' | 'comparison' | 'divider' | 'list';

export type Slide = {
  index: number;
  kind: SlideKind;
  title?: string;
  body: string;
  accent?: string;        // référence couleur logique : 'brand' | 'amber' | 'emerald' | 'ink' (mappée en PDF)
  metric?: string;        // chiffre central si la slide en met un en avant
  // V30.1 — Champs structurés pour layouts dédiés
  eyebrow?: string;       // libellé court de section, en haut
  bullets?: string[];     // pour kind='list'
  before?: string;        // pour kind='comparison'
  after?: string;         // pour kind='comparison'
  attribution?: string;   // pour kind='quote'
  density?: 'low' | 'medium' | 'high';  // V30.1 calculé par analyzeSlideDensity
};

export type CarouselPlan = {
  format: 'pedagogical' | 'framework' | 'breakdown' | 'case-study' | 'timeline' | 'comparison';
  hookLine: string;
  slides: Slide[];
  totalSlides: number;
  // V30.1 — Score global qualité du carrousel
  qualityScore?: number;          // 0-1, basé sur densité + rythme
  qualitySignals?: CarouselSignal[];
};

export type CarouselSignal = {
  kind: 'overload' | 'too_short' | 'monotone' | 'no_hook' | 'no_conclusion' | 'too_long' | 'good';
  message: string;
  slideIndex?: number;
  severity: 'note' | 'soft' | 'firm';
};

// ─────────────────────────────────────────────────────────────────────
// Helpers : structurer le texte
// ─────────────────────────────────────────────────────────────────────

function paragraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
}

function firstLine(text: string): string {
  const ls = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  return ls[0] || '';
}

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
}

// ─────────────────────────────────────────────────────────────────────
// Détection de format
// ─────────────────────────────────────────────────────────────────────

function detectFormat(text: string): CarouselPlan['format'] {
  const t = text.toLowerCase();
  // 1. Numérotation forte : étapes, leçons, principes
  const numberedItems = (text.match(/^\s*\d+[.)]\s+/gm) || []).length;
  const stepMarkers = (text.match(/\b(étape|step|leçon|raison|astuce|principe)\s*\d*/gi) || []).length;
  if (numberedItems >= 3 || stepMarkers >= 3) return 'pedagogical';
  // 2. Comparaison : avant/après, X vs Y
  if (/\b(avant|après|au lieu de|vs\.?|versus|comparé à)\b/i.test(t) &&
      (t.includes('avant') && t.includes('après'))) return 'comparison';
  // 3. Timeline : marqueurs temporels nombreux
  const timeMarkers = (text.match(/\b(en \d{4}|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|premier mois|deuxième mois|trois mois plus tard|six mois plus tard)\b/gi) || []).length;
  if (timeMarkers >= 3) return 'timeline';
  // 4. Cas client : PME / dirigeant / banquier + chiffres
  if (/\b(pme|client|dirigeant|banquier|fondateur)\b/i.test(t) &&
      /\b\d{1,3}(?:[\s.,]\d{3})*\s*(?:%|€|k€|jours?|mois|fois)\b/i.test(text)) return 'case-study';
  // 5. Framework : 3-5 concepts liés avec définition
  if (/\bframework\b|\bm[ée]thode\b|\bsyst[èe]me\b|\bmod[èe]le\b/i.test(t) &&
      numberedItems >= 2) return 'framework';
  // 6. Breakdown par défaut si plusieurs paragraphes
  return 'breakdown';
}

// ─────────────────────────────────────────────────────────────────────
// Découpage en slides
// ─────────────────────────────────────────────────────────────────────

const SLIDE_MAX_CHARS = 280;     // une slide LinkedIn lisible reste sous ~280 chars
const SLIDE_OVERLOAD_CHARS = 320; // au-delà = overload (signal)
const SLIDE_MIN_CHARS = 60;      // sous ce seuil on fusionne avec la suivante

// V30.1 — Densité d'une slide : "low" (slide qui respire, 1-2 phrases),
// "medium" (3-4 phrases, cible idéale), "high" (≥ 5 phrases ou ≥ 250 chars)
export function analyzeSlideDensity(slide: Slide): 'low' | 'medium' | 'high' {
  const body = (slide.body || '').trim();
  if (!body) return 'low';
  const ss = sentences(body);
  if (slide.kind === 'kpi' || slide.kind === 'divider' || slide.kind === 'quote') return 'low';
  if (slide.kind === 'list' && (slide.bullets?.length || 0) <= 3) return 'low';
  if (body.length < 100 || ss.length <= 2) return 'low';
  if (body.length >= 250 || ss.length >= 5) return 'high';
  return 'medium';
}

// V30.1 — Quality signals d'un plan complet : overload, monotone, hook absent,
// conclusion absente, trop long, trop court. Renvoyé dans CarouselPlan.
export function analyzeCarouselQuality(plan: CarouselPlan): { score: number; signals: CarouselSignal[] } {
  const signals: CarouselSignal[] = [];

  // 1. Slides overload
  for (const s of plan.slides) {
    if (s.body && s.body.length > SLIDE_OVERLOAD_CHARS) {
      signals.push({
        kind: 'overload',
        message: `Slide ${s.index} dépasse ${SLIDE_OVERLOAD_CHARS} caractères. Une slide premium tient en 280 max.`,
        slideIndex: s.index,
        severity: 'firm',
      });
    }
  }

  // 2. Hook présent ?
  if (!plan.slides.some(s => s.kind === 'hook')) {
    signals.push({
      kind: 'no_hook',
      message: 'Pas de slide hook explicite. Une slide d\'ouverture forte aide à accrocher.',
      severity: 'soft',
    });
  }

  // 3. Conclusion présente ?
  if (plan.totalSlides >= 5 && !plan.slides.some(s => s.kind === 'conclusion' || s.kind === 'cta')) {
    signals.push({
      kind: 'no_conclusion',
      message: 'Pas de slide de fermeture. Sans clôture, le carrousel s\'arrête sec.',
      severity: 'soft',
    });
  }

  // 4. Trop court (< 3 slides utiles)
  if (plan.totalSlides < 3) {
    signals.push({
      kind: 'too_short',
      message: `Carrousel court (${plan.totalSlides} slides). 5-9 slides est le sweet spot LinkedIn.`,
      severity: 'note',
    });
  }

  // 5. Trop long (> 11 slides)
  if (plan.totalSlides > 11) {
    signals.push({
      kind: 'too_long',
      message: `${plan.totalSlides} slides : LinkedIn coupe l'attention au-delà de 10. Compactez deux blocs.`,
      severity: 'soft',
    });
  }

  // 6. Monotone : toutes les slides de même densité
  const densities = plan.slides.map(s => analyzeSlideDensity(s));
  const distinctDensities = new Set(densities);
  if (plan.totalSlides >= 5 && distinctDensities.size === 1) {
    signals.push({
      kind: 'monotone',
      message: 'Toutes vos slides ont la même densité. Une slide courte entre deux denses casse le rythme.',
      severity: 'note',
    });
  }

  // Score : démarrage à 1, retire 0.2 par firm, 0.1 par soft, 0.04 par note
  let score = 1;
  for (const s of signals) {
    if (s.severity === 'firm') score -= 0.2;
    else if (s.severity === 'soft') score -= 0.1;
    else score -= 0.04;
  }
  score = Math.max(0, +score.toFixed(2));

  if (signals.length === 0 || score >= 0.85) {
    signals.unshift({ kind: 'good', message: `Carrousel équilibré sur ${plan.totalSlides} slides.`, severity: 'note' });
  }

  return { score, signals };
}

function splitParagraphIntoSlides(paragraph: string, kind: SlideKind, startIndex: number): Slide[] {
  const slides: Slide[] = [];
  if (paragraph.length <= SLIDE_MAX_CHARS) {
    slides.push({ index: startIndex, kind, body: paragraph });
    return slides;
  }
  // Découpe par phrases jusqu'à ne pas dépasser SLIDE_MAX_CHARS
  const ss = sentences(paragraph);
  let buf = '';
  let i = startIndex;
  for (const s of ss) {
    if (buf.length + s.length + 1 > SLIDE_MAX_CHARS && buf.length > 0) {
      slides.push({ index: i++, kind, body: buf.trim() });
      buf = s;
    } else {
      buf = buf ? `${buf} ${s}` : s;
    }
  }
  if (buf.trim()) slides.push({ index: i, kind, body: buf.trim() });
  return slides;
}

/** Détecte un chiffre marquant dans une slide (montant, %, délai). */
function extractMetric(text: string): string | undefined {
  const m = text.match(/\b\d{1,3}(?:[\s.,]\d{3})*(?:[,.]\d+)?\s*(?:%|€|k€|M€|kEUR|MEUR|jours?|semaines?|mois|ans?|fois)\b/i);
  return m ? m[0] : undefined;
}

/** Détecte un titre court (≤ 60 chars, première phrase ou ligne courte). */
function extractTitle(body: string): string | undefined {
  const ss = sentences(body);
  if (ss.length === 0) return undefined;
  const first = ss[0];
  if (first.length > 4 && first.length <= 60) return first;
  // Sinon, on prend les 5-7 premiers mots
  const words = body.split(/\s+/).slice(0, 7);
  const candidate = words.join(' ').replace(/[.,;:]$/, '');
  if (candidate.length >= 4 && candidate.length <= 60) return candidate + '…';
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────
// Plan principal
// ─────────────────────────────────────────────────────────────────────

export function planSlides(text: string, opts?: { withCta?: boolean }): CarouselPlan {
  const trimmed = text.trim();
  if (trimmed.length < 80) {
    return {
      format: 'breakdown',
      hookLine: trimmed,
      slides: [{ index: 1, kind: 'hook', body: trimmed }],
      totalSlides: 1,
    };
  }

  const format = detectFormat(trimmed);
  const fl = firstLine(trimmed);
  const ps = paragraphs(trimmed);
  // Hook = première ligne. On retire ce paragraphe-là de la suite
  // pour ne pas dupliquer le contenu.
  const remainingParagraphs = ps.slice(1);

  const slides: Slide[] = [];
  let idx = 1;

  // Slide 1 : HOOK (la 1ère ligne, ou les 1ères phrases si très courtes)
  const hookBody = fl.length <= SLIDE_MAX_CHARS ? fl : fl.slice(0, SLIDE_MAX_CHARS - 1) + '…';
  slides.push({
    index: idx++,
    kind: 'hook',
    body: hookBody,
    accent: 'brand',
  });

  // Slides intermédiaires : selon format
  if (remainingParagraphs.length === 0) {
    // Texte mono-paragraphe : on re-découpe la suite du hook
    const rest = trimmed.slice(fl.length).trim();
    if (rest.length > 0) {
      const subSlides = splitParagraphIntoSlides(rest, 'reveal', idx);
      slides.push(...subSlides);
      idx += subSlides.length;
    }
  } else {
    // Multi-paragraphes : on alloue un kind selon position
    for (let pi = 0; pi < remainingParagraphs.length; pi++) {
      const p = remainingParagraphs[pi];
      const isLast = pi === remainingParagraphs.length - 1;
      let kind: SlideKind;
      if (isLast) {
        // Le dernier paragraphe est en général la conclusion
        kind = 'conclusion';
      } else if (pi === 0) {
        kind = 'reveal';
      } else if (/\b\d{1,3}(?:[\s.,]\d{3})*\s*(?:%|€|k€|jours?|mois)\b/i.test(p)) {
        kind = 'proof';
      } else if (format === 'pedagogical' || format === 'framework') {
        kind = 'step';
      } else {
        kind = 'reveal';
      }
      const subSlides = splitParagraphIntoSlides(p, kind, idx);
      // Ajoute title et metric quand pertinent
      for (const s of subSlides) {
        s.title = extractTitle(s.body);
        s.metric = extractMetric(s.body);
        // accent par kind
        s.accent =
          s.kind === 'hook' ? 'brand' :
          s.kind === 'proof' ? 'emerald' :
          s.kind === 'conclusion' ? 'ink' :
          s.kind === 'step' ? 'amber' :
          'ink';
      }
      slides.push(...subSlides);
      idx += subSlides.length;
    }
  }

  // CTA final si demandé explicitement (par défaut on n'en ajoute pas,
  // on respecte le ton "leçon implicite" — pas de "Et vous ?" forcé).
  if (opts?.withCta) {
    slides.push({
      index: idx++,
      kind: 'cta',
      body: 'Si ce post vous a parlé, partagez-le à un dirigeant qui en a besoin.',
      accent: 'ink',
    });
  }

  // Sécurité : on plafonne à 12 slides max (au-delà c'est plus un PDF que
  // LinkedIn ne lira pas)
  if (slides.length > 12) {
    slides.splice(12);
  }

  // V30.1 + V30.2 — Détection slides spéciales et upgrade :
  // - proof avec chiffre dominant → kpi (gros chiffre centré)
  // - citation entre guillemets → quote
  // - bullets ≥ 3 dans le body → list
  // - format=comparison ET "avant" et "après" présents → comparison split
  for (const s of slides) {
    upgradeSlideKind(s);
  }

  // V30.1 — Calcul de la densité par slide
  for (const s of slides) {
    s.density = analyzeSlideDensity(s);
  }

  const plan: CarouselPlan = {
    format,
    hookLine: fl,
    slides,
    totalSlides: slides.length,
  };

  // V30.1 — Quality score sur l'ensemble
  const q = analyzeCarouselQuality(plan);
  plan.qualityScore = q.score;
  plan.qualitySignals = q.signals;

  return plan;
}

// V30.2 — Upgrade un slide en kind spécialisé selon ce qu'il contient.
// Modifie le slide en place. Idempotent.
function upgradeSlideKind(s: Slide): void {
  if (s.kind === 'hook' || s.kind === 'cta' || s.kind === 'divider') return;
  const body = (s.body || '').trim();
  if (!body) return;

  // 1. Quote : la slide est ENTRE guillemets (« » ou "") et < 200 chars
  const quoteMatch = body.match(/^[«"](.+?)[»"]\.?$/);
  if (quoteMatch && body.length < 240) {
    s.kind = 'quote';
    s.body = quoteMatch[1].trim();
    return;
  }

  // 2. KPI : la slide a un chiffre marquant + très peu de texte autour
  //    (< 80 chars hors chiffre, ou body court avec metric extrait)
  const metric = extractMetric(body);
  if (metric && body.length < 120 && s.kind === 'proof') {
    s.kind = 'kpi';
    s.metric = metric;
    // Title = libellé court du KPI (le reste du body sans le chiffre)
    const cleaned = body.replace(metric, '').replace(/[\s,.;:]+/g, ' ').trim();
    if (cleaned.length > 4 && cleaned.length <= 80) s.title = cleaned;
    s.body = ''; // pour kpi, on n'affiche pas de body, juste metric + title
    return;
  }

  // 3. List : 3+ lignes commençant par puce (-, •, *) ou chiffre suivi de . ou )
  const lines = body.split(/\n/).map(l => l.trim()).filter(Boolean);
  const bulletLines = lines.filter(l => /^([-•*]\s+|\d+[.)]\s+)/.test(l));
  if (bulletLines.length >= 3 && bulletLines.length === lines.length) {
    s.kind = 'list';
    s.bullets = bulletLines.map(l => l.replace(/^([-•*]\s+|\d+[.)]\s+)/, '').trim()).slice(0, 6);
    s.body = '';
    return;
  }

  // 4. Comparison : la slide contient "avant" ET "après" séparés
  const avantMatch = body.match(/(?:^|\n)\s*avant\s*[:.]?\s*(.+?)(?=\n|\s+apr[èe]s\s*[:.]|$)/is);
  const apresMatch = body.match(/apr[èe]s\s*[:.]?\s*(.+?)$/is);
  if (avantMatch && apresMatch && (s.kind === 'reveal' || s.kind === 'proof')) {
    s.kind = 'comparison';
    s.before = avantMatch[1].trim().slice(0, 160);
    s.after = apresMatch[1].trim().slice(0, 160);
    s.body = '';
    return;
  }
}

/** Slide de garde (cover) — affichée comme première image dans LinkedIn,
 *  donc on lui donne un look fort : grande typo, accent visible. */
export function buildCoverSlide(plan: CarouselPlan): Slide {
  const hookSlide = plan.slides.find(s => s.kind === 'hook');
  return {
    index: 0,
    kind: 'hook',
    title: hookSlide?.body || plan.hookLine,
    body: '',
    accent: 'brand',
  };
}

/** Méta lisible humaine pour un format de carrousel. */
export function formatLabel(format: CarouselPlan['format']): string {
  return {
    pedagogical: 'Pédagogique',
    framework: 'Framework',
    breakdown: 'Décortiquage',
    'case-study': 'Cas client',
    timeline: 'Timeline',
    comparison: 'Comparaison',
  }[format];
}
