// V53 — Mémoire éditoriale LinkedIn (V1, base fiable).
//
// « Cadence apprend Cyril. » Ce module lit le corpus RÉEL des publications
// (la couche canonique content_items, via listPostSummaries) et en tire une
// mémoire éditoriale exploitable : quels thèmes reviennent, lesquels n'ont
// jamais été abordés, lesquels dorment depuis longtemps.
//
// Principes (cf. la mission) :
//  - AUCUNE dépendance OpenAI : on lit les extraits + dates déjà stockés,
//    jamais les vecteurs. La mémoire survit même sans clé d'embeddings.
//  - AUCUN scraping, aucune API fragile : on lit ce que l'utilisateur a importé.
//  - AUCUN filtre `linkedin_*` : en prod le corps importé est étiqueté
//    `notion_*`. On lit donc TOUT ce qui a du texte et une date, peu importe
//    la provenance — sinon on ne verrait rien.
//  - Pas d'IA compliquée : détection de thèmes par mots-clés normalisés
//    (insensible aux accents), fréquence + récence. Première version simple.
//
// Sortie : des EditorialOpportunity au format IDENTIQUE aux opportunités
// natives/radar, pour se fondre dans Aujourd'hui sans trahir leur origine.

import { listPostSummaries } from './content-items';
import type { EditorialOpportunity } from './editorial-opportunities';

// ─────────────────────────────────────────────────────────────────────
// Thèmes suivis (univers finance / pilotage PME de Cyril)
//
// `synonyms` : écrits AVEC accents (français correct → passe le scanner
// d'accents). La détection normalise les deux côtés (minuscule + sans
// diacritiques) au runtime, donc « trésorerie » matche aussi « tresorerie ».
// `key`/ids : opaques (anglais / acronymes) pour ne jamais déclencher le
// scanner sur des chaînes techniques.
// ─────────────────────────────────────────────────────────────────────

type Theme = {
  key: string;
  label: string;        // nom lisible (accentué)
  synonyms: string[];
  gapEligible: boolean; // peut être proposé comme « angle jamais traité »
  title: string;        // angle prêt si le thème devient une opportunité
  hook: string;
};

const THEMES: Theme[] = [
  { key: 'treasury', label: 'trésorerie', gapEligible: false,
    synonyms: ['trésorerie', 'tréso', 'liquidités'],
    title: 'La trésorerie ne se lit pas sur le solde bancaire',
    hook: 'Votre compte affiche le passé. Votre trésorerie, ce sont les 90 prochains jours.' },
  { key: 'bfr', label: 'BFR', gapEligible: true,
    synonyms: ['bfr', 'besoin en fonds de roulement', 'fonds de roulement'],
    title: 'Le BFR, ce trou invisible qui assèche les PME rentables',
    hook: 'Rentable sur le papier, à sec en banque. Le coupable a un nom.' },
  { key: 'cashflow', label: 'cash-flow', gapEligible: true,
    synonyms: ['cash-flow', 'cash flow', 'flux de trésorerie'],
    title: 'Le cash-flow, la seule courbe à regarder chaque semaine',
    hook: 'Pas le chiffre d’affaires. Pas le résultat. Le flux de trésorerie.' },
  { key: 'forecast', label: 'prévisionnel', gapEligible: true,
    synonyms: ['prévisionnel', 'prévision', 'forecast', 'rolling forecast'],
    title: 'Le prévisionnel à 90 jours qui change la façon de décider',
    hook: 'Passer de « combien j’ai » à « combien j’aurai, et quand ça se tend ».' },
  { key: 'dso', label: 'recouvrement', gapEligible: true,
    synonyms: ['dso', 'recouvrement', 'délai de paiement', 'retard de paiement', 'impayé'],
    title: 'Votre DSO grimpe ? Votre trésorerie fond.',
    hook: 'Chaque jour de retard de paiement, c’est du cash qui dort ailleurs.' },
  { key: 'margin', label: 'marge', gapEligible: true,
    synonyms: ['marge', 'rentabilité', 'rentable'],
    title: 'On pilote une PME à la marge, pas au chiffre d’affaires',
    hook: 'Vendre plus en perdant sur chaque vente : l’erreur classique.' },
  { key: 'funding', label: 'financement', gapEligible: true,
    synonyms: ['financement', 'levée de fonds', 'emprunt', 'dette'],
    title: 'Lever, s’endetter ou s’autofinancer : le vrai arbitrage',
    hook: 'Le financement n’est pas une fin. C’est un levier qui se choisit.' },
  { key: 'steering', label: 'pilotage', gapEligible: true,
    synonyms: ['pilotage', 'tableau de bord', 'indicateurs'],
    title: 'Le tableau de bord d’un dirigeant tient sur 5 chiffres',
    hook: 'Pas cinquante indicateurs. Cinq. Lesquels comptent vraiment ?' },
  { key: 'cfo', label: 'DAF externalisé', gapEligible: true,
    synonyms: ['daf', 'directeur financier', 'directrice financière', 'fractional'],
    title: 'DAF externalisé ou outil de pilotage : que choisir à 2 M€ ?',
    hook: 'Recruter un DAF à 90 k€, ou piloter autrement. L’arbitrage réel.' },
  { key: 'fpa', label: 'FP&A', gapEligible: true,
    synonyms: ['fp&a', 'fpa', 'financial planning'],
    title: 'Le FP&A pour une PME, sans usine à gaz',
    hook: 'Le FP&A n’est pas qu’un mot de licorne. La version PME, en trois étapes.' },
  { key: 'heelio', label: 'Heelio', gapEligible: false,
    synonyms: ['heelio'],
    title: 'Pourquoi je construis Heelio',
    hook: 'Le pilotage de trésorerie ne devrait pas être réservé aux grands groupes.' },
  { key: 'decode', label: 'Decode', gapEligible: false,
    synonyms: ['decode'],
    title: 'Ce que Decode m’apprend sur le métier de dirigeant',
    hook: 'Un deuxième produit, une deuxième école de terrain.' },
];

// Normalisation : minuscule + suppression des diacritiques. Appliquée AU
// RUNTIME des deux côtés, donc les littéraux source restent accentués.
function norm(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export type ThemeStat = {
  key: string;
  label: string;
  count: number;
  lastDays: number | null; // jours depuis le post le plus récent sur ce thème
};

export type EditorialMemory = {
  analyzed: number;        // nombre de publications réellement lues (avec texte)
  themes: ThemeStat[];
  dominant: ThemeStat[];   // count desc, count > 0
};

// Lecture + analyse du corpus réel. Tout est best-effort : si content_items
// est vide ou indisponible, on renvoie une mémoire vide (jamais d'exception).
export async function readEditorialMemory(opts?: { limit?: number }): Promise<EditorialMemory> {
  try {
    const summaries = await listPostSummaries({ limit: opts?.limit ?? 500 });
    const now = Date.now();
    // Corpus = tout ce qui a un minimum de texte (titre + extrait). On ne
    // filtre PAS sur la provenance (cf. note d'en-tête : tout est notion_*).
    const corpus = summaries
      .map(s => {
        const text = `${s.title || ''} ${s.excerpt || ''}`;
        const t = s.scheduled_at ? new Date(s.scheduled_at).getTime() : NaN;
        return { hay: norm(text), days: Number.isFinite(t) ? Math.floor((now - t) / 86_400_000) : null, len: text.trim().length };
      })
      .filter(p => p.len > 40);

    const themes: ThemeStat[] = THEMES.map(th => {
      const needles = th.synonyms.map(norm);
      let count = 0;
      let lastDays: number | null = null;
      for (const p of corpus) {
        if (!needles.some(n => p.hay.includes(n))) continue;
        count++;
        if (p.days !== null && (lastDays === null || p.days < lastDays)) lastDays = p.days;
      }
      return { key: th.key, label: th.label, count, lastDays };
    });

    const dominant = [...themes].filter(t => t.count > 0).sort((a, b) => b.count - a.count);

    return { analyzed: corpus.length, themes, dominant };
  } catch {
    return { analyzed: 0, themes: [], dominant: [] };
  }
}

function themeByKey(key: string): Theme | undefined {
  return THEMES.find(t => t.key === key);
}

// Opportunités issues de la mémoire, pour Aujourd'hui. Rotation déterministe
// par jour pour varier sans Math.random. Renvoie [] si le corpus est trop
// maigre (on ne fabrique jamais un insight sans matière).
export async function editorialMemoryOpportunities(dayIndex: number): Promise<EditorialOpportunity[]> {
  const mem = await readEditorialMemory();
  if (mem.analyzed < 8) return [];

  const out: EditorialOpportunity[] = [];

  // Dominant « de contraste » : le thème le plus récurrent HORS produits
  // (Heelio / Decode). On veut « Vous parlez souvent de trésorerie » — un
  // concept éditorial — pas « de Heelio », pour que la mise en regard avec
  // un angle manquant sonne juste.
  const PRODUCTS = ['heelio', 'decode'];
  const dominant = mem.dominant.find(t => !PRODUCTS.includes(t.key)) || mem.dominant[0] || null;

  // 1. ANGLE MANQUANT — un thème pédagogique jamais (ou quasi jamais) abordé,
  //    mis en regard du thème dominant. « Vous parlez souvent de X, jamais de Y. »
  const gaps = mem.themes
    .filter(t => t.count === 0 && themeByKey(t.key)?.gapEligible)
    .map(t => themeByKey(t.key)!)
    .filter(Boolean);
  if (dominant && gaps.length > 0) {
    const gap = gaps[((dayIndex % gaps.length) + gaps.length) % gaps.length];
    out.push({
      id: 'mem-1',
      type: 'Angle manquant',
      title: gap.title,
      hook: gap.hook,
      why: `Vous revenez souvent sur ${dominant.label}, mais jamais sur ${gap.label}. Un angle neuf, et c’est dans votre univers.`,
      stars: 5,
    });
  }

  // 2. À REVISITER — un thème déjà traité mais qui dort depuis longtemps
  //    (> ~10 mois). « Vous avez traité X il y a N mois. »
  const stale = mem.themes
    .filter(t => t.count > 0 && t.lastDays !== null && t.lastDays > 300)
    .sort((a, b) => (b.lastDays || 0) - (a.lastDays || 0));
  if (stale.length > 0) {
    const st = stale[((dayIndex % stale.length) + stale.length) % stale.length];
    const th = themeByKey(st.key);
    if (th) {
      const months = Math.max(10, Math.round((st.lastDays || 0) / 30));
      out.push({
        id: 'mem-2',
        type: 'À revisiter',
        title: th.title,
        hook: th.hook,
        why: `Vous avez traité ${th.label} il y a ${months} mois. Vos lecteurs récents ne l’ont pas vu.`,
        stars: 4,
      });
    }
  }

  return out;
}
