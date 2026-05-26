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

export type SlideKind = 'hook' | 'reveal' | 'proof' | 'step' | 'conclusion' | 'cta';

export type Slide = {
  index: number;
  kind: SlideKind;
  title?: string;
  body: string;
  accent?: string;        // référence couleur logique : 'brand' | 'amber' | 'emerald' | 'ink' (mappée en PDF)
  metric?: string;        // chiffre central si la slide en met un en avant
};

export type CarouselPlan = {
  format: 'pedagogical' | 'framework' | 'breakdown' | 'case-study' | 'timeline' | 'comparison';
  hookLine: string;
  slides: Slide[];
  totalSlides: number;
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
const SLIDE_MIN_CHARS = 60;      // sous ce seuil on fusionne avec la suivante

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

  return {
    format,
    hookLine: fl,
    slides,
    totalSlides: slides.length,
  };
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
