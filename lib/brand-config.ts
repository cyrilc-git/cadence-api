// Brand DNA et garde-fous éditoriaux Cadence/Heelio
// Tout est server-side. Affichable côté UI sans secrets.

export const PILIERS = [
  { key: 'Lundi · Cas client',         day: 'Lundi',    color: 'blue',   anonymisation: true },
  { key: 'Mardi · Pédagogie',          day: 'Mardi',    color: 'green',  anonymisation: false },
  { key: 'Mercredi · Produit',         day: 'Mercredi', color: 'purple', anonymisation: false },
  { key: 'Jeudi · Opinion',            day: 'Jeudi',    color: 'orange', anonymisation: false },
  { key: 'Vendredi · Build in public', day: 'Vendredi', color: 'pink',   anonymisation: false }
] as const;

export const VOIX = {
  vouvoiement: true,
  founder_voice: true, // Pas DAF, Cyril fondateur Heelio
  tonalité: ['pragmatique', 'expert sans jargon', 'énergique', 'fiable', 'concret'],
  longueur_cible: { min: 200, max: 1300 } // caractères
};

export const ANTI_PATTERNS = [
  { id: 'em_dash',      label: 'Tiret long (— ou –)', pattern: /[—–]/g, severity: 'critical' },
  { id: 'not_x_y',      label: '"Ce n\'est pas X, c\'est Y" et variantes', pattern: /\b(c['e]?st|n['e]?st)\s+pas\s+\w+[\s,]+c['e]?st\s+\w+/gi, severity: 'critical' },
  // V9.1.1 — mots creux étendus : impactant, insight, game-changer (déjà présent), etc.
  { id: 'mots_creux',   label: 'Mots creux IA (impactant, insight, game-changer, seamless…)', pattern: /\b(impactant|impactante|insight|insights|game[- ]?changer|seamless|robust|delve|leverage|unlock|unleash|deep[- ]dive|dans un monde où|révolutionnaire|disrupter|disruption)\b/gi, severity: 'high' },
  // V9.1.1 — formules signature : "Résultat :", "Et c'est là que…", "La vérité c'est que…"
  { id: 'resultat_formule', label: 'Formule signature ("Résultat :", "Et c\'est là…", "La vérité c\'est…")', pattern: /(?:^|\n|\.\s+)\s*(?:R[ée]sultat\s*:|Et\s+c['e]?st\s+l[àa]\s+que|La\s+v[ée]rit[ée]\s+c['e]?st\s+que|Voici\s+pourquoi\s*:|Le\s+vrai\s+probl[èe]me\s*c['e]?st)/gi, severity: 'high' },
  // V9.1.1 — "Pas parce que..." en début de phrase (cliché IA "not because... but because...")
  { id: 'pas_parce_que', label: '"Pas parce que…" en début de phrase (cliché IA)', pattern: /(?:^|\n|\.\s+|\?\s+|!\s+)\s*Pas\s+parce\s+qu[e']/gi, severity: 'high' },
  // V9.1.1 — emoji burst plus strict (>1 emoji = soupçon, >3 = clair)
  { id: 'emoji',        label: 'Emoji détecté (préférer mots / chiffres)', test: (t: string) => (t.match(/\p{Extended_Pictographic}/gu) || []).length >= 1, severity: 'medium' },
  // V9.1.1 — staccato : 3+ phrases courtes (<6 mots) consécutives
  { id: 'staccato',     label: 'Phrases ultra-courtes en rafale (staccato IA)', test: (t: string) => {
      const sentences = t.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
      let streak = 0, maxStreak = 0;
      for (const s of sentences) {
        const words = s.trim().split(/\s+/).length;
        if (words > 0 && words <= 5) { streak++; if (streak > maxStreak) maxStreak = streak; }
        else streak = 0;
      }
      return maxStreak >= 3;
    }, severity: 'medium' },
  { id: 'all_caps',     label: 'Mot en MAJUSCULES (>1 mot consécutif)', pattern: /\b[A-Z]{4,}\s+[A-Z]{4,}/g, severity: 'medium' },
  { id: 'tutoiement',   label: 'Tutoiement détecté', pattern: /\b(tu|toi|ton|ta|tes)\b/gi, severity: 'high' }
];

export type AntiPatternHit = { id: string; label: string; severity: string; matches: string[] };

// V14.8 — Nettoie le texte d'un anti-pattern visible avant affichage
// (ex: suggestions du Radar qui contiennent encore des em-dashes datant
// d'avant le ban). Remplace — et – par " · " (mid-dot signature Cadence).
// Doit rester idempotent : appelable plusieurs fois sans dégrader.
export function sanitizeForBrandVoice(text: string): string {
  if (!text) return text;
  return text
    .replace(/\s*[—–]\s*/g, ' · ')          // tiret long entouré d'espaces -> " · "
    .replace(/[“”]/g, '"')        // smart double quotes -> "
    .replace(/\s{2,}/g, ' ')                // espaces multiples
    .trim();
}

export function checkAntiPatterns(text: string): AntiPatternHit[] {
  const hits: AntiPatternHit[] = [];
  for (const ap of ANTI_PATTERNS) {
    let matches: string[] = [];
    if ('pattern' in ap && ap.pattern) {
      matches = Array.from(text.matchAll(ap.pattern as RegExp), m => m[0]).slice(0, 5);
    } else if ('test' in ap && (ap as any).test) {
      if ((ap as any).test(text)) matches = ['(détecté)'];
    }
    if (matches.length) hits.push({ id: ap.id, label: ap.label, severity: ap.severity, matches });
  }
  return hits;
}

// Heelio brand visual tokens (used for /api/generate-visual claude-design mode + UI accents)
export const HEELIO_DESIGN = {
  colors: {
    primary: '#6366F1',
    primaryDark: '#4F46E5',
    bg: '#F8FAFC',
    surface: '#FFFFFF',
    ink: '#0F172A',
    muted: '#64748B',
    success: '#10B981',
    danger: '#EF4444'
  },
  fonts: {
    sans: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
  },
  radius: { card: 16, button: 10, pill: 999 },
  spacing: { card: 24 }
};
