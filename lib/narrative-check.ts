// V16.4 — Analyzer narratif pour Cadence.
// Objectif : détecter ce que les anti-patterns lexicaux ne voient PAS.
// On regarde la structure du texte (tension, friction, scène, bascule)
// pour pouvoir signaler en éditeur "il manque une friction concrète" ou
// "tout le post va dans le même sens" — calmement, jamais bloquant.
//
// Aucune dépendance externe, fonctionne en isolation, idempotent.

export type NarrativeSignal = {
  kind:
    | 'tension_absente'
    | 'lineaire_explicatif'
    | 'sans_friction_concrete'
    | 'manque_bascule'
    | 'morale_finale_assenee'
    | 'hook_promet_trop'
    | 'tout_demonstratif'
    | 'ralentit_trop'
    | 'scene_absente'
    | 'leçon_explicite'
    | 'none';
  message: string;
  severity: 'note' | 'soft' | 'firm';
};

// ─────────────────────────────────────────────────────────────────────
// Helpers : structurer le texte
// ─────────────────────────────────────────────────────────────────────

function paragraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
}

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 0);
}

function firstLine(text: string): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  return lines[0] || '';
}

function lastLines(text: string, n = 2): string[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  return lines.slice(Math.max(0, lines.length - n));
}

// ─────────────────────────────────────────────────────────────────────
// Détecteurs spécialisés
// ─────────────────────────────────────────────────────────────────────

/** Mots de contraste / bascule : "mais", "pourtant", "sauf", "en réalité",
 *  "finalement", "et c'est là", "puis", "alors". Leur ABSENCE complète
 *  signale un texte qui ne se contredit jamais lui-même = sans tension. */
const CONTRAST_MARKERS = [
  /\bmais\b/i, /\bpourtant\b/i, /\bsauf\b/i, /\ben r[ée]alit[ée]\b/i,
  /\bfinalement\b/i, /\bcependant\b/i, /\btoutefois\b/i, /\borigineal\b/i,
  /\bparadoxalement\b/i, /\bn[ée]anmoins\b/i, /\b[àa] l['e]inverse\b/i,
  /\benfin\b/i, /\bjusqu['e]à ce que\b/i, /\bjusqu['e]à ce moment\b/i,
];
function hasContrast(text: string): boolean {
  return CONTRAST_MARKERS.some(re => re.test(text));
}

/** Marqueurs de scène concrète : présence d'un personnage qui agit, d'un
 *  lieu, d'un instant. Ex : "Un banquier m'a dit", "Lors d'une réunion",
 *  "Un client m'écrit", "Hier", "Ce matin". */
const SCENE_MARKERS = [
  /\b(un|une|le|la|mon|ma|notre|son|sa)\s+(client|banquier|d(?:irig|af)|fondateur|associ[ée]|cfo|ceo|comptable|investisseur|prospect|fournisseur)\b/i,
  /\b(hier|ce matin|ce soir|la semaine derni[èe]re|le mois dernier|en r[ée]union|au t[ée]l[ée]phone|au caf[ée]|sur le terrain)\b/i,
  /\b(m['e]?a (?:dit|demand[ée]|appel[ée]|[ée]crit|envoy[ée])|nous avons (?:d[ée]cid[ée]|sign[ée]|refus[ée]|h[ée]sit[ée]))\b/i,
  /\b(?:il|elle)\s+(?:m['e]?a|nous a|me|nous)\s+(?:dit|demand[ée]|expliqu[ée])\b/i,
];
function hasScene(text: string): boolean {
  return SCENE_MARKERS.some(re => re.test(text));
}

/** Marqueurs de friction concrète : un montant (€/k€/M€/%), un délai
 *  en jours/semaines/mois, un verbe d'arbitrage (refuser, signer, payer,
 *  rater, doubler, perdre), un détail opérationnel.
 *  L'absence totale = pas de "terrain". */
function hasConcreteFriction(text: string): boolean {
  // Au moins un chiffre significatif (≥ 2 chars) avec unité OU contexte
  const amounts = /\b\d{1,3}(?:[\s.,]\d{3})*(?:[,.]\d+)?\s*(?:%|€|k€|M€|kEUR|MEUR|jours?|semaines?|mois|ans?|fois)\b/i.test(text);
  if (amounts) return true;
  // Verbes d'arbitrage / action concrète
  const verbs = /\b(refuse|refus[ée]e?s?|sign[ée]e?s?|paie|pay[ée]e?s?|h[ée]site|h[ée]sit[ée]e?s?|rate|rat[ée]e?s?|double|doubl[ée]e?s?|perd|perdu|perdus?|gagne|gagn[ée]e?s?|accept[ée]?s?|n[ée]gocie|n[ée]goci[ée]e?s?|c[èe]de|c[ée]d[ée]e?s?|reporte|report[ée]e?s?|annule|annul[ée]e?s?|d[ée]bloque|d[ée]bloqu[ée]e?s?|coupe|coup[ée]e?s?|coupent|coupant|coupent)\b/i.test(text);
  return verbs;
}

/** Densité d'explication : phrases qui commencent par "comment", "pourquoi",
 *  "voici", "c'est-à-dire", "en effet", "donc", "ainsi". 4+ = trop démonstratif. */
const EXPLAIN_STARTERS = /(?:^|\n)\s*(comment|pourquoi|voici|c['e]st-à-dire|en effet|donc|ainsi|premi[èe]rement|deuxi[èe]mement|troisi[èe]mement|en outre|de plus|par ailleurs)\b/gi;
function explainStarters(text: string): number {
  const m = text.match(EXPLAIN_STARTERS);
  return m ? m.length : 0;
}

/** Détecte une leçon finale assénée (au-delà de l'anti-pattern lexical).
 *  Le dernier paragraphe contient : impératif présent ("retenez", "souvenez-vous",
 *  "n'oubliez pas") OU un "donc", "alors", "voilà pourquoi" final. */
function hasExplicitMoral(text: string): boolean {
  // On regarde les 3 dernières lignes pour ne pas rater une morale qui
  // précède une question rhétorique finale ("Et vous ?").
  const last = lastLines(text, 3).join(' ');
  if (!last) return false;
  return /\b(retenez|souvenez-vous|n['e]?oubliez pas|voilà pourquoi|c['e]?est pour cette raison|en r[ée]sum[ée]|moralit[ée]|le[çc]on\s*[:.])\b/i.test(last)
    || /\b(j['e]ai compris que|j['e]ai r[ée]alis[ée] que|ma plus grande le[çc]on|ce que j['e]ai retenu|en conclusion\s*[:,]|pour conclure\s*[:,])\b/i.test(last);
}

/** Détecte si le hook (1ère phrase) promet plus que le texte ne donne.
 *  Heuristique simple : hook contient un nombre, un superlatif, un mystère
 *  ("voici ce que..."), mais le reste du texte ne livre ni nombre ni détail. */
function hookOverpromise(text: string): boolean {
  const fl = firstLine(text);
  if (fl.length < 20) return false;
  const promises =
    /\b(\d+\s*(?:fa[çc]ons?|raisons?|le[çc]ons?|cl[ée]s?|secrets?|erreurs?)|le\s+(?:seul|vrai|meilleur)|voici\s+ce\s+qui|ce\s+qui\s+m['e]?a\s+(?:fait|appris|chang[ée]))/i.test(fl);
  if (!promises) return false;
  // Le reste promet-il son contenu ?
  const rest = text.slice(fl.length);
  const numbers = (rest.match(/\b\d{2,}\b/g) || []).length;
  const hasDetail = numbers >= 1 || hasConcreteFriction(rest);
  return !hasDetail;
}

// ─────────────────────────────────────────────────────────────────────
// Analyzer principal
// ─────────────────────────────────────────────────────────────────────

/** Renvoie 0 ou 1 signal narratif (le plus pertinent). Volontairement
 *  parcimonieux : un éditeur calme parle peu. */
export function analyzeNarrative(text: string): NarrativeSignal {
  if (!text || text.trim().length < 80) {
    return { kind: 'none', message: '', severity: 'note' };
  }

  const t = text.trim();
  const ps = paragraphs(t);
  const ss = sentences(t);
  const len = t.length;

  // Trop court pour analyser sérieusement
  if (ss.length < 3 || ps.length < 2) {
    return { kind: 'none', message: '', severity: 'note' };
  }

  // 1. Hook promet plus que le texte (prioritaire — défaut visible)
  if (hookOverpromise(t)) {
    return {
      kind: 'hook_promet_trop',
      message: 'Le hook annonce plus que ne donne le texte. Ajoutez un chiffre ou un détail opérationnel qui tienne la promesse.',
      severity: 'firm',
    };
  }

  // 2. Morale finale assénée
  if (hasExplicitMoral(t)) {
    return {
      kind: 'morale_finale_assenee',
      message: 'La leçon est assénée en fin de post. Coupez la dernière phrase, laissez le lecteur déduire.',
      severity: 'firm',
    };
  }

  // 3. Pas de friction concrète du tout
  if (!hasConcreteFriction(t)) {
    return {
      kind: 'sans_friction_concrete',
      message: 'Aucun chiffre, aucun arbitrage concret. Citez un montant, un délai, ou une décision difficile.',
      severity: 'firm',
    };
  }

  // 4. Aucun contraste / bascule sur tout le texte
  if (!hasContrast(t) && len > 300) {
    return {
      kind: 'manque_bascule',
      message: 'Le texte va toujours dans le même sens. Une friction (mais, pourtant, en réalité) ferait respirer le propos.',
      severity: 'soft',
    };
  }

  // 5. Aucune scène concrète (que des concepts)
  if (!hasScene(t) && len > 400) {
    return {
      kind: 'scene_absente',
      message: 'Aucune scène concrète : qui parle, qui décide, qui paie ? Une scène ancrerait la démonstration.',
      severity: 'soft',
    };
  }

  // 6. Trop démonstratif (4+ phrases explicatives)
  const explains = explainStarters(t);
  if (explains >= 4) {
    return {
      kind: 'tout_demonstratif',
      message: `${explains} phrases explicatives. Le texte explique plutôt qu'il ne montre. Remplacez une explication par une scène.`,
      severity: 'soft',
    };
  }

  // 7. Linéaire explicatif : longue chaîne sans contraste ET sans scène
  if (len > 500 && !hasContrast(t) && !hasScene(t)) {
    return {
      kind: 'lineaire_explicatif',
      message: 'Texte purement explicatif, sans tension ni scène. Risque : lecteur décroche après le hook.',
      severity: 'firm',
    };
  }

  // 8. Paragraphe central trop long (ralentit la lecture)
  const longest = Math.max(...ps.map(p => p.length));
  if (longest > 500 && len > 700) {
    return {
      kind: 'ralentit_trop',
      message: `Un paragraphe de ${longest} caractères ralentit la lecture. Cassez-le en deux blocs.`,
      severity: 'soft',
    };
  }

  return { kind: 'none', message: '', severity: 'note' };
}

/** Détecte une éventuelle leçon explicite, plus fine que l'anti-pattern
 *  lexical (qui matche des formules exactes). Ici on regarde le DERNIER
 *  paragraphe et on cherche un schéma "constat → leçon impérative". */
export function hasExplicitLessonShape(text: string): boolean {
  const ps = paragraphs(text);
  if (ps.length < 2) return false;
  const lastP = ps[ps.length - 1];
  if (lastP.length > 200) return false; // si le dernier para est long, c'est probablement une histoire
  // Le dernier paragraphe contient un impératif court OU une généralisation absolue
  if (/\b(retenez|souvenez-vous|n['e]?oubliez pas|gardez|comprenez|sachez|notez)\b/i.test(lastP)) return true;
  if (/\b(toujours|jamais|partout|tous?\s+les?)\b/i.test(lastP) && lastP.length < 120) return true;
  return false;
}
