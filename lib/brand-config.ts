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
  { id: 'seamless',     label: 'Mots creux IA (seamless, robust, delve…)', pattern: /\b(seamless|robust|delve|leverage|unlock|unleash|deep dive|game[- ]?changer|dans un monde où)\b/gi, severity: 'high' },
  { id: 'emoji_burst',  label: 'Plus de 3 emojis dans le post', test: (t: string) => (t.match(/\p{Extended_Pictographic}/gu) || []).length > 3, severity: 'medium' },
  { id: 'all_caps',     label: 'Mot en MAJUSCULES (>1 mot consécutif)', pattern: /\b[A-Z]{4,}\s+[A-Z]{4,}/g, severity: 'medium' },
  { id: 'tutoiement',   label: 'Tutoiement détecté', pattern: /\b(tu|toi|ton|ta|tes)\b/gi, severity: 'high' }
];

export type AntiPatternHit = { id: string; label: string; severity: string; matches: string[] };

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
