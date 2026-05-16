import Anthropic from '@anthropic-ai/sdk';
import { brandDnaList, designSystemPromptBlock } from './db';
import { getCredential } from './credentials';

let _client: Anthropic | null = null;
async function client(): Promise<Anthropic> {
  const { value } = await getCredential('anthropic');
  if (!value) throw new Error('ANTHROPIC_API_KEY introuvable (ni en DB user_credentials ni en env var). Ajoutez-la dans Settings → Connecteurs ou Vercel.');
  if (!_client) _client = new Anthropic({ apiKey: value });
  return _client;
}

// === Brand DNA-aware system prompt ===

const STATIC_VOICE = `VOIX (NON NÉGOCIABLE)
- Vouvoiement systématique dans le post (jamais « tu », « toi », « ton »)
- Founder voice (Cyril, fondateur Heelio) — pas DAF freelance
- Phrases courtes. Paragraphes aérés. Vocabulaire simple. Zéro mot creux.
- Parler d'abord du problème utilisateur, puis du bénéfice.
- Exemples chiffrés simples, cas anonymisés, bénéfices concrets.
- Hook fort en 1ère phrase < 80 caractères.
- CTA sobre uniquement quand utile. Aucun « Et vous ? » de fin générique.
- Cible principale : dirigeants PME / TPE. Secondaire : DAF internes ou externes, experts-comptables.`;

const STATIC_BANNED = [
  'Aucun tiret long (— ou –). Utiliser virgule ou phrase courte.',
  'Aucune formule « ce n\'est pas X, c\'est Y » et variantes.',
  'Aucune formule « non, X ne suffit pas ».',
  'Aucune formule « la vérité, c\'est que ».',
  'Aucune formule « spoiler ».',
  'Aucun mot creux IA : seamless, robust, delve, unlock, unleash, deep dive, game changer, révolutionner, booster, libérer le potentiel, « dans un monde où… ».',
  'Pas de hashtags génériques (#leadership, #motivation). Hashtags ciblés uniquement (#DAF, #PME, #treso).',
  'Pas plus de 3 emojis dans tout le post.',
  'Pas de mots en MAJUSCULES (sauf acronymes ≤ 4 lettres : DAF, SaaS, PME, FEC, FAE, FNP).',
  'Pas de confidentialité client risquée : pas de nom, pas de chiffres internes identifiables, secteur générique.',
  'Pas de tutoiement. Pas de claims exagérés. Pas de conclusion générique.'
];

const STATIC_INSPIRATION_RULES =
`INSPIRATION â  COPIE
Les inspirations sont des notes abstraites de style. Elles servent à comprendre rythme, densité, pédagogie, structure, niveau de clarté.
Aucun post généré ne doit permettre de deviner quel profil a servi d'inspiration.
Jamais de reprise de formulation, gimmick personnel, structure trop reconnaissable, hook signature ou punchline identifiable.`;

async function loadDynamicDna(): Promise<{ rules: string[]; anti: string[]; piliers: string[]; audiences: string[]; features: string[]; hashtags: string[] }> {
  try {
    const all = await brandDnaList();
    const by = (kind: string) => all.filter(x => x.kind === kind && (x as any).active !== false).map(x => x.label);
    return { rules: by('rule'), anti: by('anti_pattern'), piliers: by('pilier'), audiences: by('audience'), features: by('format'), hashtags: by('hashtag') };
  } catch {
    return { rules: [], anti: [], piliers: [], audiences: [], features: [], hashtags: [] };
  }
}

async function buildSystemPrompt(pilier?: string): Promise<string> {
  const d = await loadDynamicDna();
  const allBanned = Array.from(new Set([...STATIC_BANNED, ...d.anti])).map(s => `- ${s}`).join('\n');
  const dynamicRules = d.rules.length ? `RÈGLES DE VOIX SUPPLÉMENTAIRES (depuis Brand DNA utilisateur)\n${d.rules.map(s => `- ${s}`).join('\n')}\n\n` : '';
  const featuresBlock = d.features.length ? `FEATURES PRIORITAIRES À MENTIONNER QUAND APPROPRIÉ (pilier Produit / Pédagogie)\n${d.features.map(s => `- ${s}`).join('\n')}\n\n` : '';
  const audiencesBlock = d.audiences.length ? `AUDIENCES\n${d.audiences.map(s => `- ${s}`).join('\n')}\n\n` : '';
  const hashtagsBlock = d.hashtags.length ? `HASHTAGS FAVORIS (ciblés, jamais génériques)\n${d.hashtags.join(' ')}\n\n` : '';
  const pilierLine = pilier ? `\nPILIER ÉDITORIAL DE CE POST : ${pilier}\n` : '';

  return `Tu es l'éditeur LinkedIn de Cyril Coulange, fondateur de Heelio (SaaS trésorerie pour PME).

${STATIC_VOICE}

${dynamicRules}INTERDICTIONS ABSOLUES
${allBanned}

LONGUEUR
- Cible 200-1300 caractères. Optimal 600-900.
- Sauts de ligne entre paragraphes.

${audiencesBlock}${featuresBlock}${hashtagsBlock}${STATIC_INSPIRATION_RULES}
${pilierLine}
Format de réponse : tu produis EXACTEMENT 3 propositions distinctes, séparées par "===PROP===" sur sa propre ligne. Aucun préambule, aucun commentaire avant ou après. Juste les 3 textes.`;
}

const PILIER_HINTS: Record<string, string> = {
  'Lundi · Cas dirigeant anonymisé':   'Raconte un cas dirigeant anonymisé : situation, déclic, action, résultat chiffré. Pas de nom, secteur générique.',
  'Lundi · Cas client':                'Raconte un cas dirigeant anonymisé : situation, déclic, action, résultat chiffré.',
  'Mardi · Pédagogie sans jargon':     'Explique un concept finance/treso/DAF sans jargon, avec un exemple concret.',
  'Mardi · Pédagogie':                 'Explique un concept finance/treso/DAF sans jargon, avec un exemple concret.',
  'Mercredi · Produit / démo / nouveauté / release note': 'Présente une feature Heelio ou une release. Bénéfice utilisateur d\'abord, mécanique ensuite.',
  'Mercredi · Produit':                'Présente une feature Heelio. Bénéfice utilisateur d\'abord.',
  'Jeudi · Opinion / hot take mesuré': 'Hot take mesuré. Position claire dès la 1re phrase. 2-3 raisons. Pas de provocation gratuite.',
  'Jeudi · Opinion':                   'Hot take mesuré. Position claire dès la 1re phrase. 2-3 raisons.',
  'Vendredi · Build in public':        'Partage le réel : ce qui marche, ce qui rate, les chiffres bruts. Authentique, sans posture.'
};

export async function generateThreeProposals(input: { pilier?: string; brief: string; inspirations?: string[] }): Promise<{ proposals: string[]; raw: string; model: string }> {
  const c = await client();
  const pilierHint = input.pilier && PILIER_HINTS[input.pilier]
    ? `\n\n${PILIER_HINTS[input.pilier]}`
    : '';
  const inspoBlock = (input.inspirations && input.inspirations.length)
    ? `\n\nNOTES D'INSPIRATION (style abstrait uniquement, jamais à recopier) :\n${input.inspirations.slice(0,5).map(i => `- ${i}`).join('\n')}`
    : '';

  const userPrompt = `BRIEF : ${input.brief}${pilierHint}${inspoBlock}

Produis 3 propositions distinctes, chacune respectant strictement les règles ci-dessus. Sépare-les par "===PROP===" sur sa propre ligne.`;

  const system = await buildSystemPrompt(input.pilier);
  const MODEL = 'claude-sonnet-4-6';
  const msg = await c.messages.create({ model: MODEL, max_tokens: 2400, system, messages: [{ role: 'user', content: userPrompt }] });
  const raw = msg.content.filter((x: any) => x.type === 'text').map((x: any) => x.text).join('\n');
  const proposals = raw.split(/^===PROP===\s*$/m).map(s => s.trim()).filter(Boolean).slice(0, 3);
  if (proposals.length === 0) throw new Error('Claude a répondu sans propositions exploitables.');
  return { proposals, raw, model: MODEL };
}

const VISUAL_SYSTEM_PROMPT_BASE = `Tu es designer SaaS B2B premium (style Lemlist / Linear / Notion).
Tu produis du SVG inline propre, viewBox="0 0 1200 630".

DESIGN SYSTEM CADENCE PAR DÉFAUT (peut être surchargé par les tokens utilisateur fournis dans le prompt) :
- couleurs : primaire #2563EB, foncée #1D4ED8, fond #F8FAFC, surface #FFFFFF, texte #0F172A, secondaire #64748B, succès #10B981, danger #EF4444
- police : system-ui sans-serif (équivalent Inter)
- coins arrondis : 16px cartes, 10px boutons
- style épuré, espace blanc, hiérarchie typo claire
- pas de dégradés tape-à-l\'oeil, pas d\'emojis sur les visuels produit
- texte lisible (min 18px corps, 32-48px titres)

RÈGLES OBLIGATOIRES :
- SVG autonome (aucune référence externe, aucun <image href> distant)
- Si des tokens DESIGN SYSTEM utilisateur sont fournis ci-dessous, les utiliser EN PRIORITÉ sur les valeurs par défaut
- Si une URL Figma est mentionnée, l\'utiliser comme référence stylistique (sans la fetch)
- Réponds avec UNIQUEMENT le bloc <svg ...>...</svg>, rien d\'autre.`;

export async function generateClaudeDesignSvg(prompt: string): Promise<{ svg: string; model: string }> {
  const c = await client();
  const dsBlock = await designSystemPromptBlock().catch(() => '');
  // V8.9 §7 — séparer le moodboard du reste pour le rendre saillant
  const moodboardHint = dsBlock.includes('[MOODBOARD]')
    ? '\nNOTE : Les URLs sous [MOODBOARD] sont des images de référence (palette/style/composition). Inspirez-vous-en pour la direction artistique sans les fetcher.\n'
    : '';
  const userBlock = dsBlock
    ? `DESIGN SYSTEM UTILISATEUR (PRIORITAIRE — surcharge les défauts)\n${dsBlock}${moodboardHint}\nDEMANDE\n${prompt}`
    : `DEMANDE\n${prompt}`;
  const MODEL = 'claude-sonnet-4-6';
  const msg = await c.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: VISUAL_SYSTEM_PROMPT_BASE,
    messages: [{ role: 'user', content: userBlock }]
  });
  const raw = msg.content.filter((x: any) => x.type === 'text').map((x: any) => x.text).join('\n');
  const m = raw.match(/<svg[\s\S]*?<\/svg>/);
  if (!m) throw new Error('Claude n\'a pas renvoyé de SVG valide.');
  return { svg: m[0], model: MODEL };
}
