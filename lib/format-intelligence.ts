// V49 — Intelligence de format éditorial.
//
// Référence structurelle : post Fygr « Les outils indispensables pour un
// DAF en 2026 ». Cadence regarde un brouillon et comprend SEULE quel
// format le servirait le mieux : checklist, framework, timeline, carte
// mentale, avant/après, comparaison, pyramide, « N indispensables »,
// capture produit, schéma, carrousel, mono-visuel.
//
// Pure JS, zéro dépendance, zéro IA. Renvoie UNE recommandation calme
// (la plus pertinente) ou null. L'éditeur affiche un seul murmure.

export type EditorialFormat =
  | 'numbered_list'      // « les N outils / erreurs / clés … »
  | 'checklist'          // liste d'items à cocher / à faire
  | 'framework'          // méthode / système / modèle nommé
  | 'timeline'           // chronologie, étapes datées
  | 'before_after'       // avant → après, transformation
  | 'comparison'         // X vs Y, deux entités
  | 'pyramid'            // niveaux hiérarchiques
  | 'mindmap'            // concept central + branches
  | 'product_capture'    // capture / démo produit
  | 'schema'             // process en étapes
  | 'carousel'           // long et structuré
  | 'mono_visual';       // court et percutant

export type FormatSuggestion = {
  format: EditorialFormat;
  label: string;      // libellé humain : « checklist visuelle »
  why: string;        // raison courte : « Vous listez 6 éléments. »
  cta: string;        // action : « En faire une checklist visuelle »
  confidence: number; // 0..1
};

function countMatches(text: string, re: RegExp): number {
  const m = text.match(re);
  return m ? m.length : 0;
}

function lines(text: string): string[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────
// Détecteur principal. Renvoie la meilleure recommandation ou null.
// ─────────────────────────────────────────────────────────────────────
export function detectEditorialFormat(text: string): FormatSuggestion | null {
  const t = (text || '').trim();
  if (t.length < 120) return null; // trop court pour suggérer un format riche
  const lower = t.toLowerCase();
  const ls = lines(t);
  const len = t.length;

  // Comptages structurels réutilisés
  const numberedItems = countMatches(t, /^\s*\d+[.)]\s+/gm);
  const bulletItems = countMatches(t, /^\s*[-•–▪✓➤*]\s+/gm);
  // \b ne matche pas devant une majuscule accentuée (É) en regex JS : on
  // cale sur la classe explicite [éèÉÈ] sans frontière de mot.
  const stepMarkers = countMatches(t, /[éèÉÈ]tapes?\s*\d*|\bstep\s*\d*/gi);

  // 1. « N éléments indispensables » — le pattern Fygr par excellence.
  //    Hook ou corps annonce un nombre d'items identitaires.
  const nIndispensables = /\b(\d+)\s+(outils?|[ée]l[ée]ments?|cl[ée]s?|erreurs?|raisons?|principes?|r[èe]gles?|conseils?|astuces?|le[çc]ons?|indispensables?|incontournables?|crit[èe]res?|signaux?|r[ée]flexes?|habitudes?)\b/i;
  const nMatch = lower.match(nIndispensables);
  if (nMatch && (numberedItems >= 3 || bulletItems >= 3 || /indispensables?|incontournables?/.test(lower))) {
    const n = parseInt(nMatch[1], 10);
    return {
      format: 'numbered_list',
      label: `liste « ${nMatch[1]} ${nMatch[2]} »`,
      why: `Vous structurez ${Number.isFinite(n) ? n : 'plusieurs'} ${nMatch[2]}.`,
      cta: 'En faire un carrousel scannable, une idée par slide',
      confidence: 0.9,
    };
  }

  // 2. Checklist — items à cocher / à faire, vocabulaire d'action.
  const checklistVocab = /\b([àa]\s+faire|checklist|liste de contr[ôo]le|v[ée]rifiez|assurez-vous|cochez|ne pas oublier)\b/i.test(lower);
  if ((bulletItems >= 4 || (bulletItems >= 3 && checklistVocab))) {
    return {
      format: 'checklist',
      label: 'checklist visuelle',
      why: `${bulletItems} points listés : une checklist se scanne mieux qu'un paragraphe.`,
      cta: 'En faire une checklist visuelle',
      confidence: 0.82,
    };
  }

  // 3. Avant / après — transformation explicite.
  const hasAvant = /\bavant\b/i.test(lower);
  const hasApres = /\bapr[èe]s\b/i.test(lower);
  if (hasAvant && hasApres) {
    return {
      format: 'before_after',
      label: 'avant / après',
      why: 'Vous opposez une situation avant et après.',
      cta: 'En faire un visuel avant / après',
      confidence: 0.8,
    };
  }

  // 4. Comparaison — X vs Y, deux options mises en regard.
  if (/\b(vs\.?|versus|compar[ée]|plut[ôo]t que|au lieu de|d['e]un c[ôo]t[ée].*de l['e]autre)\b/i.test(lower) && len < 1600) {
    return {
      format: 'comparison',
      label: 'comparaison',
      why: 'Vous comparez deux approches.',
      cta: 'En faire un visuel comparatif à deux colonnes',
      confidence: 0.72,
    };
  }

  // 5. Timeline — chronologie marquée (années, mois, étapes datées).
  const timeMarkers = countMatches(t, /\b(en\s+\d{4}|\d{4}\s*[:→-]|janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[ûu]t|septembre|octobre|novembre|d[ée]cembre|jour\s*\d+|mois\s*\d+|semaine\s*\d+|trimestre)\b/gi);
  if (timeMarkers >= 3) {
    return {
      format: 'timeline',
      label: 'timeline',
      why: 'Plusieurs repères temporels : une frise raconte mieux la progression.',
      cta: 'En faire une timeline',
      confidence: 0.75,
    };
  }

  // 6. Framework — méthode/système/modèle nommé, structuré.
  if (/\b(framework|m[ée]thode|syst[èe]me|mod[èe]le|matrice|cadre|process(?:us)?|formule)\b/i.test(lower) && (numberedItems >= 2 || stepMarkers >= 2)) {
    return {
      format: 'framework',
      label: 'framework',
      why: 'Vous décrivez une méthode structurée.',
      cta: 'En faire un carrousel framework, une étape par slide',
      confidence: 0.78,
    };
  }

  // 7. Schéma / process — étapes séquentielles sans dates.
  if (stepMarkers >= 3 || (numberedItems >= 3 && /\b(d['e]abord|ensuite|puis|enfin|finalement)\b/i.test(lower))) {
    return {
      format: 'schema',
      label: 'schéma en étapes',
      why: 'Une suite d\'étapes : un schéma clarifie le déroulé.',
      cta: 'En faire un schéma d\'étapes',
      confidence: 0.7,
    };
  }

  // 8. Capture produit — mention d'écran / démo / feature.
  if (/\b(dashboard|tableau de bord|capture|[ée]cran|interface|nouvelle fonctionnalit[ée]|on vient de sortir|d[ée]mo)\b/i.test(lower)) {
    return {
      format: 'product_capture',
      label: 'capture produit annotée',
      why: 'Vous parlez d\'une interface ou d\'une nouveauté produit.',
      cta: 'En faire une capture annotée',
      confidence: 0.6,
    };
  }

  // 9. Pyramide — niveaux / paliers / hiérarchie.
  if (/\b(niveau\s*\d|palier|pyramide|base.*sommet|fondations?|socle)\b/i.test(lower) && numberedItems >= 2) {
    return {
      format: 'pyramid',
      label: 'pyramide',
      why: 'Vous décrivez des niveaux hiérarchisés.',
      cta: 'En faire une pyramide',
      confidence: 0.62,
    };
  }

  // 10. Carrousel par défaut si long + structuré (≥ 600 chars, plusieurs blocs).
  if (len > 600 && ls.length >= 5) {
    return {
      format: 'carousel',
      label: 'carrousel',
      why: 'Texte long et structuré : un carrousel garde l\'attention slide après slide.',
      cta: 'En faire un carrousel',
      confidence: 0.55,
    };
  }

  // 11. Mono-visuel si court et percutant avec un chiffre.
  if (len < 400 && /\b\d{2,}\s*(%|€|k€|jours?|fois|x)\b/i.test(t)) {
    return {
      format: 'mono_visual',
      label: 'mono-visuel',
      why: 'Court avec un chiffre fort : un visuel unique frappe plus.',
      cta: 'En faire un mono-visuel',
      confidence: 0.5,
    };
  }

  return null;
}

// V49 — Mappe un format éditorial vers le template du studio visuel
// (VisualGenerator) quand pertinent, pour pré-sélectionner le bon rendu.
export function formatToVisualTemplate(format: EditorialFormat): string | null {
  switch (format) {
    case 'numbered_list':
    case 'checklist':
    case 'framework':
    case 'schema':
    case 'timeline':
    case 'pyramid':
      return 'schema';
    case 'product_capture':
      return 'capture';
    case 'comparison':
    case 'before_after':
      return 'feature';
    case 'mono_visual':
      return 'opinion';
    default:
      return null;
  }
}
