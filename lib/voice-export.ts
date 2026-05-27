// V21.2 — Voice files exportables
//
// Génère deux blocs Markdown lisibles (about-me.md + voice.md) à partir
// de la mémoire stylistique et de la voix Cadence statique. L'utilisateur
// peut copier ces deux fichiers dans Notion, dans un repo, ou dans la
// section "voice" d'un autre assistant IA. Source de vérité = Cadence,
// destination = ailleurs (Notion / GitHub / autre).
//
// Inspiration : pattern voice-builder de charlie947/social-media-skills
// qui produit deux fichiers Markdown que toutes les autres skills lisent
// en préambule.
//
// Fonction pure, server-safe et client-safe (pas de side effect, pas de
// dépendance Supabase ou réseau).

import type { StyleMemory } from './style-memory';

const NARRATIVE_LABELS: Record<string, string> = {
  hook_promet_trop: 'hook qui promet trop',
  morale_finale_assenee: 'morale assénée',
  sans_friction_concrete: 'sans friction concrète',
  manque_bascule: 'sans bascule',
  scene_absente: 'sans scène',
  tout_demonstratif: 'trop démonstratif',
  lineaire_explicatif: 'linéaire explicatif',
  ralentit_trop: 'paragraphe qui ralentit',
};

export type VoiceFiles = {
  aboutMe: string;
  voice: string;
};

/** Construit deux blocs Markdown copiables à partir de la mémoire
 *  stylistique. Retourne un placeholder lisible si la mémoire est
 *  insuffisante (< 5 posts), pour ne jamais générer de fichier vide. */
export function buildVoiceFiles(mem: StyleMemory | null): VoiceFiles {
  if (!mem || mem.posts_analyzed < 5) {
    return {
      aboutMe: ABOUT_ME_PLACEHOLDER,
      voice: VOICE_PLACEHOLDER,
    };
  }

  const aboutMe = `# À propos

**Cyril Coulange** · fondateur de **Heelio** (SaaS trésorerie PME).

## Audience
Dirigeants de PME et TPE françaises. Secondaire : DAF (internes ou externes), experts-comptables, fondateurs early-stage qui pilotent leur cash eux-mêmes.

## Piliers
- **Lundi** · cas dirigeant anonymisé : situation, déclic, action, résultat chiffré.
- **Mardi** · pédagogie sans jargon : un concept finance ou trésorerie expliqué à hauteur d'épaule.
- **Mercredi** · produit Heelio : feature, release, bénéfice utilisateur d'abord.
- **Jeudi** · opinion mesurée : hot take défendu par 2-3 raisons concrètes.
- **Vendredi** · build in public : ce qui marche, ce qui rate, chiffres bruts.

## Point de vue
La trésorerie d'une PME ne se pilote pas avec un tableur Excel envoyé au DAF toutes les fins de mois. Le dirigeant doit voir son cash, comprendre ce qui rentre et ce qui sort, sans dépendre d'un intermédiaire qui parle un autre langage.

## Promesse de marque
"Expert simple avisé proximité." Le ton de Yann Leonardi : on partage de l'expertise finance à des dirigeants sans jamais poser ni jargonner.

## Hors limites
- Pas de tutoiement.
- Pas de noms de clients ni de chiffres internes identifiables (secteur générique seulement).
- Pas de provocation gratuite ni de claims exagérés.
- Pas de "comment j'ai fait 100k€ en 30 jours" — pas notre voix.
`;

  const topOpenings = mem.top_openings.length
    ? mem.top_openings.slice(0, 4).map(o => `- « ${o}… »`).join('\n')
    : '- (à venir : besoin de plus de posts publiés pour stabiliser le pattern)';

  const topClosings = mem.top_closings.length
    ? mem.top_closings.slice(0, 4).map(c => `- « ${c}… »`).join('\n')
    : '- (à venir : besoin de plus de posts publiés pour stabiliser le pattern)';

  const favoriteWords = mem.favorite_words.length
    ? mem.favorite_words.slice(0, 8).map(w => `\`${w.word}\``).join(' · ')
    : '(corpus trop petit pour identifier des mots-signature)';

  const narrativeUsed = Object.entries(mem.narrative_kinds)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k, c]) => `- ${NARRATIVE_LABELS[k] || k} — ${c} post${c > 1 ? 's' : ''}`)
    .join('\n');

  // Description rythmique à partir des moyennes
  const rythme: string[] = [];
  if (mem.avg_post_len < 600) rythme.push('Posts plutôt courts (< 600 caractères).');
  else if (mem.avg_post_len < 1100) rythme.push(`Posts de longueur moyenne (~${mem.avg_post_len} caractères).`);
  else rythme.push(`Posts longs (~${mem.avg_post_len} caractères).`);

  if (mem.avg_hook_len < 70) rythme.push('Hook serré (< 70 caractères).');
  else if (mem.avg_hook_len < 130) rythme.push(`Hook équilibré (~${mem.avg_hook_len} caractères).`);
  else rythme.push(`Hook long (~${mem.avg_hook_len} caractères).`);

  rythme.push(`En moyenne ${mem.avg_paragraph_count} paragraphes par post.`);
  if (mem.density_score > 0.55) rythme.push('Phrases denses.');
  else rythme.push('Phrases aérées.');

  // Vocabulaire métier
  const jargonLine = mem.jargon_level > 0.3
    ? 'Vocabulaire métier assumé : trésorerie, BFR, DSO, encaissements, arbitrages.'
    : mem.jargon_level > 0.1
      ? 'Vocabulaire métier ponctuel : quelques termes finance/treso, jamais en accumulation.'
      : 'Vocabulaire simple, accessible aux non-financiers.';

  const pedagogie = mem.pedagogical_level > 0.4
    ? 'Tonalité pédagogique : étapes explicites, exemples appuyés.'
    : mem.pedagogical_level > 0.15
      ? 'Léger angle pédagogique, sans surcharge.'
      : 'Pas de structure pédagogique explicite. Démonstration par la scène.';

  const voice = `# Voix

## Qui je sonne
${mem.voice_summary}

## Tonalité
- Expert sans jargon, simple, avisé, proximité, concret, fiable.
- Référence : Yann Leonardi. Pose et chaleur d'un dirigeant qui parle à un pair.
- Jamais : professoral, vendeur, "guru LinkedIn", motivationnel creux.

## Rythme
${rythme.map(r => `- ${r}`).join('\n')}
- ${jargonLine}
- ${pedagogie}

## Hook
Concret-imagé : objet du quotidien, métaphore familière, anecdote courte. Désamorce la technicité financière avant d'entrer dans le sujet.

## Mes openings récurrents (à varier consciemment)
${topOpenings}

## Mes fermetures récurrentes
${topClosings}

## Mes mots de chevet
${favoriteWords}

## Structures narratives que j'utilise déjà
${narrativeUsed || '- (mémoire narrative pas encore alimentée)'}

## Ce que ma voix ne fait jamais
- Pas de tiret long (—).
- Pas de "Ce n'est pas X, c'est Y" ni variantes.
- Pas de "Voici les N leçons".
- Pas de morale assénée ("J'ai compris que…").
- Pas de CTA générique ("Et vous ?", "Qu'en pensez-vous ?").
- Pas d'em-dash, pas d'emoji, pas de hashtags génériques (#leadership, #motivation).
- Pas de vocabulaire vision abstraite ("visionnaire", "tournant majeur", "excellence opérationnelle").
- Pas de phrase motivationnelle creuse ("osez vraiment", "dépassez vos limites").
- Pas d'intensifiers vides ("extrêmement", "considérablement").
- Pas de transitions IA empilées ("De plus", "En outre", "Par conséquent").

---

_Généré par Cadence à partir de ${mem.posts_analyzed} posts LinkedIn analysés (confiance ${Math.round(mem.confidence_score * 100)} %). Source de vérité : la signature personnelle de Cyril, recalculée automatiquement à chaque publication confirmée._
`;

  return { aboutMe, voice };
}

const ABOUT_ME_PLACEHOLDER = `# À propos

Pas encore assez de posts LinkedIn publiés ou importés (< 5) pour générer un profil personnel solide.

Importez votre archive LinkedIn dans /sources/linkedin ou publiez quelques posts depuis Cadence pour activer la génération automatique.
`;

const VOICE_PLACEHOLDER = `# Voix

Pas encore assez de signal stylistique pour décrire votre voix avec précision.

Pour activer la génération :
1. Importez votre archive LinkedIn ZIP (au moins 5 posts récents).
2. Allez sur /cerveau et cliquez "Recalculer".
3. Revenez ici pour copier les fichiers personnalisés.
`;
