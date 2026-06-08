// V52 Lot 2 — Opportunités éditoriales natives.
//
// Cadence est un directeur éditorial : il propose de VRAIS sujets, pas seulement
// du recyclage. Ces angles sont ancrés sur le domaine de Cyril (Heelio, pilotage
// financier des PME) et fonctionnent SANS LinkedIn, CRM ni API externe. Aucun
// score chiffré, aucune métrique, aucun « 0 impressions » : seulement un sujet,
// un hook, et un « pourquoi maintenant » concret.
//
// La rotation est déterministe par jour : le même jour montre les mêmes angles
// (pas de Math.random, stable au sein d'une journée), mais ça tourne d'un jour à
// l'autre pour ne jamais radoter.
//
// Note : les identifiants sont volontairement numériques (na-1, na-2, ...) et non
// des slugs français, pour ne pas déclencher le scan d'accents sur des chaînes
// techniques. Le bouton « Rédiger » s'appuie sur le titre, pas sur l'identifiant.

export type EditorialOpportunity = {
  id: string;
  type: string;   // catégorie/signal affiché en chip (Pédagogie, Opinion, Cas terrain, Comparaison)
  title: string;  // l'angle, concret
  hook: string;   // première ligne potentielle
  why: string;    // « pourquoi maintenant »
  stars: number;  // priorité éditoriale (qualitatif, jamais rendu en chiffre)
};

// Angles fondateurs du domaine. Concrets, anti-slop, dans la voix dirigeant.
const ANGLES: EditorialOpportunity[] = [
  {
    id: 'na-1',
    type: 'Pédagogie',
    title: 'Le solde bancaire est un rétroviseur, pas un tableau de bord',
    hook: 'Votre compte affiche 80 000 €. Ça ne dit rien de votre trésorerie de la semaine prochaine.',
    why: 'Le sujet le plus mal compris des dirigeants. Il pose votre expertise dès la première ligne.',
    stars: 5,
  },
  {
    id: 'na-2',
    type: 'Pédagogie',
    title: 'Pourquoi votre chiffre d’affaires monte alors que votre trésorerie baisse',
    hook: 'Vous vendez plus que jamais. Et il manque du cash. Voici ce qui se passe vraiment.',
    why: 'Contre-intuitif : ce type de sujet se partage et déclenche les commentaires.',
    stars: 5,
  },
  {
    id: 'na-3',
    type: 'Pédagogie',
    title: 'Le BFR, ce trou invisible qui assèche les PME rentables',
    hook: 'Rentable sur le papier, à sec en banque. Le coupable a un nom : le BFR.',
    why: 'Notion clé, presque jamais expliquée simplement. Terrain idéal pour vous.',
    stars: 4,
  },
  {
    id: 'na-4',
    type: 'Opinion',
    title: 'Excel ne pilote pas une trésorerie, il la documente',
    hook: 'La plupart des dirigeants pilotent leur cash dans Excel. Ils voient le problème trop tard.',
    why: 'Prise de position nette : elle clarifie votre conviction et ouvre le débat.',
    stars: 5,
  },
  {
    id: 'na-5',
    type: 'Cas terrain',
    title: 'Un dirigeant m’a dit : « je regarde mon compte tous les matins »',
    hook: '« Donc je suis ma trésorerie. » Deux semaines plus tard, il était à découvert.',
    why: 'Cas concret et anonymisé : très relatable, parfait pour incarner votre méthode.',
    stars: 5,
  },
  {
    id: 'na-6',
    type: 'Pédagogie',
    title: 'Le prévisionnel à 90 jours qui change la façon de décider',
    hook: 'Passer de « combien j’ai » à « combien j’aurai, et quand ça se resserre ».',
    why: 'Actionnable : vous montrez la méthode, pas juste le problème.',
    stars: 4,
  },
  {
    id: 'na-7',
    type: 'Opinion',
    title: 'Le pilotage financier ne devrait pas être réservé aux grosses structures',
    hook: 'Une PME de 2 M€ mérite le même pilotage qu’un groupe. Pas le même budget.',
    why: 'C’est la mission Heelio : ce sujet fédère votre audience autour de votre raison d’être.',
    stars: 5,
  },
  {
    id: 'na-8',
    type: 'Cas terrain',
    title: 'Les 3 erreurs de gestion que je vois chez presque tous les dirigeants',
    hook: 'Trois erreurs, toujours les mêmes, qui coûtent des mois de trésorerie.',
    why: 'Format liste : fort potentiel d’enregistrement et de partage.',
    stars: 4,
  },
  {
    id: 'na-9',
    type: 'Comparaison',
    title: 'DAF externalisé ou outil de pilotage : que choisir à 2 M€ ?',
    hook: 'Recruter un DAF à 90 k€, ou piloter autrement. Le vrai arbitrage.',
    why: 'Aide à la décision : attire les dirigeants en pleine réflexion sur le sujet.',
    stars: 4,
  },
  {
    id: 'na-10',
    type: 'Pédagogie',
    title: 'Le FP&A pour une PME, sans usine à gaz',
    hook: 'Le FP&A n’est pas qu’un mot de licorne. Voici la version PME, en trois étapes.',
    why: 'Démocratise un concept perçu comme inaccessible. Très aligné Heelio.',
    stars: 4,
  },
  {
    id: 'na-11',
    type: 'Opinion',
    title: 'L’expert-comptable regarde le passé. Le dirigeant a besoin du futur.',
    hook: 'Votre comptable clôture l’année. Qui pilote vos 90 prochains jours ?',
    why: 'Clarifie la complémentarité sans opposer : rassure et positionne.',
    stars: 4,
  },
  {
    id: 'na-12',
    type: 'Pédagogie',
    title: 'Le tableau de bord d’un dirigeant tient sur 5 chiffres',
    hook: 'Pas cinquante indicateurs. Cinq. Lesquels comptent vraiment ?',
    why: 'Promesse simple, format checklist : facile à lire, facile à garder.',
    stars: 5,
  },
];

// Rotation déterministe par jour. dayIndex = nombre de jours depuis l'epoch
// (calculé côté serveur). Stable sur la journée, différent le lendemain.
export function nativeOpportunities(dayIndex: number): EditorialOpportunity[] {
  const n = ANGLES.length;
  if (n === 0) return [];
  const offset = ((Math.trunc(dayIndex) % n) + n) % n;
  return [...ANGLES.slice(offset), ...ANGLES.slice(0, offset)];
}
