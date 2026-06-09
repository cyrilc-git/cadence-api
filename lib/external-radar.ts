// V52 — Radar externe (MVP).
//
// Cadence détecte des sujets HORS de l'univers Heelio pour enrichir les
// opportunités d'Aujourd'hui : tendances FP&A, Fractional CFO, experts-comptables,
// SaaS finance, pilotage PME. Ce sont des angles ADAPTÉS à la voix de Cyril, jamais
// du contenu copié, et générés sans scraping ni API fragile (registre statique).
//
// Même type et même format que les opportunités internes : l'utilisateur ne sait
// pas d'où vient le sujet, il voit seulement « voilà ce que je vous recommande ».
// Ids opaques (ext-*, ins-*) pour ne pas déclencher le scan d'accents.

import type { EditorialOpportunity } from './editorial-opportunities';

// Tendances marché (ce qui monte dans l'écosystème, vu de Heelio).
const MARKET: EditorialOpportunity[] = [
  {
    id: 'ext-1',
    type: 'Tendance marché',
    title: 'Le FP&A débarque dans les PME, et ça change la donne',
    hook: 'Ce que les grands groupes font depuis vingt ans devient accessible à 2 M€.',
    why: 'Tendance de fond : prenez le sujet avant qu’il sature les fils d’actualité.',
    stars: 5,
  },
  {
    id: 'ext-2',
    type: 'Opportunité marché',
    title: 'Le DAF à temps partagé explose. Pourquoi maintenant ?',
    hook: 'Un DAF à plein temps n’est plus la seule option pour une PME qui grandit.',
    why: 'Modèle en forte croissance qui parle directement à votre cible.',
    stars: 5,
  },
  {
    id: 'ext-3',
    type: 'Tendance marché',
    title: 'L’expert-comptable de demain ne fera plus de la saisie',
    hook: 'La saisie s’automatise. Le conseil, lui, prend toute la place.',
    why: 'La profession se réinvente : sujet brûlant, fort potentiel de débat.',
    stars: 4,
  },
  {
    id: 'ext-4',
    type: 'Opinion marché',
    title: 'Brancher un outil ne pilote pas une trésorerie',
    hook: 'Le marché vend des tableaux de bord. C’est la méthode qui fait la différence.',
    why: 'Prise de recul utile dans un marché saturé d’outils.',
    stars: 4,
  },
  {
    id: 'ext-5',
    type: 'Tendance marché',
    title: 'Les dirigeants de PME ne veulent plus subir leur trésorerie',
    hook: 'Subir ou piloter. De plus en plus choisissent de piloter.',
    why: 'Changement d’état d’esprit visible chez vos prospects.',
    stars: 5,
  },
  {
    id: 'ext-6',
    type: 'Tendance marché',
    title: 'Le prévisionnel glissant remplace le budget annuel',
    hook: 'Le budget figé sur douze mois a fait son temps.',
    why: 'Débat très actuel dans les directions financières.',
    stars: 4,
  },
];

// Inspirations sectorielles (angles venus d'ailleurs, transposés à Heelio).
const INSPIRATION: EditorialOpportunity[] = [
  {
    id: 'ins-1',
    type: 'Inspiration',
    title: 'Ce qu’un fractional CFO américain ferait de votre trésorerie',
    hook: 'Aux États-Unis, le fractional CFO est la norme en PME. En France, ça arrive.',
    why: 'Angle sectoriel peu traité ici : vous avez une longueur d’avance.',
    stars: 5,
  },
  {
    id: 'ins-2',
    type: 'Inspiration',
    title: 'La finance d’entreprise se « consumérise »',
    hook: 'Les dirigeants veulent piloter leur boîte comme ils consultent leur banque mobile.',
    why: 'Tendance produit qui légitime votre approche simple et directe.',
    stars: 4,
  },
  {
    id: 'ins-3',
    type: 'Inspiration',
    title: 'Le pilotage en temps réel devient un standard, pas un luxe',
    hook: 'Attendre le bilan pour décider ? Plus personne n’accepte ça.',
    why: 'Attente montante du marché PME, à incarner avec vos exemples.',
    stars: 4,
  },
  {
    id: 'ins-4',
    type: 'Inspiration',
    title: 'Pourquoi les cabinets passent de la compta au pilotage',
    hook: 'Le bilan ne suffit plus. Les clients veulent du temps réel et du conseil.',
    why: 'Évolution visible du marché comptable, idéale à raconter.',
    stars: 4,
  },
  {
    id: 'ins-5',
    type: 'Inspiration',
    title: 'Piloter sa PME comme on consulte son compte au quotidien',
    hook: 'Le réflexe « je regarde tous les jours », bien outillé, devient une force.',
    why: 'Pont entre l’habitude des dirigeants et une vraie méthode.',
    stars: 5,
  },
];

function rotate(arr: EditorialOpportunity[], dayIndex: number): EditorialOpportunity[] {
  const n = arr.length;
  if (n === 0) return [];
  const offset = ((Math.trunc(dayIndex) % n) + n) % n;
  return [...arr.slice(offset), ...arr.slice(0, offset)];
}

export function marketOpportunities(dayIndex: number): EditorialOpportunity[] {
  return rotate(MARKET, dayIndex);
}

export function inspirationOpportunities(dayIndex: number): EditorialOpportunity[] {
  return rotate(INSPIRATION, dayIndex);
}
