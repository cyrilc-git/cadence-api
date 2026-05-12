import Anthropic from '@anthropic-ai/sdk';
import { PILIERS, VOIX, ANTI_PATTERNS } from './brand-config';

let _client: Anthropic | null = null;
function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquante côté serveur. Ajoutez-la dans Vercel → cadence-api → Settings → Environment Variables, puis redéployez.');
  if (!_client) _client = new Anthropic({ apiKey });
  return _client;
}

const SYSTEM_PROMPT = `Tu es l'éditeur LinkedIn de Cyril Coulange, fondateur de Heelio (SaaS trésorerie pour PME).

VOIX (NON NÉGOCIABLE) :
- Vouvoiement systématique dans le post (jamais "tu", "toi", "ton")
- Founder voice (Cyril parle en tant que fondateur, pas en tant que DAF freelance)
- Pragmatique, expert sans jargon, énergique, fiable, concret
- Phrases courtes. Verbes d'action. Zéro mot creux.

INTERDICTIONS ABSOLUES :
- AUCUN tiret long (— ou –). Utiliser virgule, point-virgule, ou phrase courte.
- AUCUNE formule "ce n'est pas X, c'est Y" et ses variantes.
- AUCUN mot creux IA : seamless, robust, delve, unlock, unleash, deep dive, game-changer, "dans un monde où…".
- Pas plus de 3 emojis dans tout le post.
- Pas de mots en MAJUSCULES (sauf acronymes ≤ 4 lettres : DAF, SaaS, PME).
- Pas de hashtags génériques (#leadership, #motivation). Hashtags ciblés uniquement (#DAF, #PME, #treso).

LONGUEUR :
- Cible 200-1300 caractères. Optimal 600-900.
- Première phrase = hook fort, < 80 caractères, donne envie de cliquer "voir plus".
- Sauts de ligne entre paragraphes (LinkedIn aime).

CONFIDENTIALITÉ CLIENTS :
- Si pilier = "Cas client", anonymiser : pas de nom, secteur générique ("PME services", "industrie agroalimentaire"), pas de chiffres trop précis.
- Citation client autorisée uniquement si l'auteur a explicitement validé.

INSPIRATION ≠ COPIE :
- Tu peux t'inspirer du style de comptes existants mais ne JAMAIS reprendre une phrase, une structure exacte, ou une formule reconnaissable.

Format de réponse : tu produis EXACTEMENT 3 propositions distinctes, séparées par "===PROP===" sur sa propre ligne. Aucun préambule, aucun commentaire avant ou après. Juste les 3 textes.`;

const PILIER_HINTS: Record<string, string> = {
  'Lundi · Cas client':         'Raconte un cas dirigeant anonymisé : situation, déclic, action, résultat chiffré. Ton concret, pas didactique.',
  'Mardi · Pédagogie':          'Explique un concept finance/treso/DAF sans jargon, avec un exemple concret. Format "voici comment je vois X".',
  'Mercredi · Produit':         'Présente une feature Heelio ou une release. Bénéfice utilisateur d\'abord, mécanique ensuite. Si screenshot mentionné, le décrire.',
  'Jeudi · Opinion':            'Hot take assumé. Position claire dès la 1re phrase. Argumente avec 2-3 raisons. Termine par une question ouverte.',
  'Vendredi · Build in public': 'Partage le réel : ce qui marche, ce qui rate, les chiffres bruts. Authentique, sans posture.'
};

export async function generateThreeProposals(input: {
  pilier?: string;
  brief: string;
  inspirations?: string[];
}): Promise<{ proposals: string[]; raw: string; model: string }> {
  const pilierHint = input.pilier && PILIER_HINTS[input.pilier]
    ? `\n\nPILIER : ${input.pilier}\n${PILIER_HINTS[input.pilier]}`
    : '';
  const inspoBlock = (input.inspirations && input.inspirations.length)
    ? `\n\nNOTES D'INSPIRATION (style uniquement, jamais à recopier) :\n${input.inspirations.slice(0,5).map(i => `- ${i}`).join('\n')}`
    : '';

  const userPrompt = `BRIEF : ${input.brief}${pilierHint}${inspoBlock}

Produis 3 propositions distinctes, chacune respectant les règles ci-dessus. Sépare-les par "===PROP===" sur sa propre ligne.`;

  const MODEL = 'claude-sonnet-4-6';
  const msg = await client().messages.create({
    model: MODEL,
    max_tokens: 2400,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }]
  });

  const raw = msg.content
    .filter((c: any) => c.type === 'text')
    .map((c: any) => c.text)
    .join('\n');

  const proposals = raw.split(/^===PROP===\s*$/m)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (proposals.length === 0) {
    throw new Error('Claude a répondu sans propositions exploitables. Réessayez.');
  }

  return { proposals, raw, model: MODEL };
}

const VISUAL_SYSTEM_PROMPT = `Tu es designer SaaS B2B. Tu produis du SVG inline propre, dimensions 1200x630 (format LinkedIn share).

Design system Heelio :
- Couleur primaire #6366F1, foncée #4F46E5
- Fond #F8FAFC, surface #FFFFFF
- Texte principal #0F172A, secondaire #64748B
- Succès #10B981, danger #EF4444
- Police system-ui sans-serif
- Coins arrondis 16px sur cartes, 10px sur boutons
- Style épuré, beaucoup d'espace blanc, hiérarchie typo claire
- Pas de dégradés tape-à-l'œil. Subtils ok.
- Pas d'emojis sur les visuels produit.
- Logo Cadence/Heelio : carré 40px arrondi 10px, gradient #6366F1 → #4F46E5, lettre "C" blanche centrée (optionnel, en coin bas)

CONTRAINTES :
- Le SVG doit être autonome (pas de référence externe, pas d'images bitmap)
- Texte lisible, taille min 18px pour le corps, 32-48px pour les titres
- viewBox="0 0 1200 630"

Réponds avec UNIQUEMENT le bloc <svg ...>...</svg>, rien d'autre. Pas de markdown, pas de commentaire, pas de fences markdown autour.`;

export async function generateClaudeDesignSvg(prompt: string): Promise<{ svg: string; model: string }> {
  const MODEL = 'claude-sonnet-4-6';
  const msg = await client().messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: VISUAL_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }]
  });
  const raw = msg.content
    .filter((c: any) => c.type === 'text')
    .map((c: any) => c.text)
    .join('\n');
  const m = raw.match(/<svg[\s\S]*?<\/svg>/);
  if (!m) throw new Error('Claude n\'a pas renvoyé de SVG valide. Réessayez avec un prompt plus précis.');
  return { svg: m[0], model: MODEL };
}
