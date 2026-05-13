import Anthropic from '@anthropic-ai/sdk';
import { brandDnaList, designSystemPromptBlock } from './db';
import { getCredential } from './credentials';

let _client: Anthropic | null = null;
async function client(): Promise<Anthropic> {
  const { value } = await getCredential('anthropic');
  if (!value) throw new Error('ANTHROPIC_API_KEY introuvable (ni en DB user_credentials ni en env var). Ajoutez-la dans Settings â Connecteurs ou Vercel.');
  if (!_client) _client = new Anthropic({ apiKey: value });
  return _client;
}

// === Brand DNA-aware system prompt ===

const STATIC_VOICE = `VOIX (NON NÃGOCIABLE)
- Vouvoiement systÃ©matique dans le post (jamais Â« tu Â», Â« toi Â», Â« ton Â»)
- Founder voice (Cyril, fondateur Heelio) â pas DAF freelance
- Phrases courtes. Paragraphes aÃ©rÃ©s. Vocabulaire simple. ZÃ©ro mot creux.
- Parler d'abord du problÃ¨me utilisateur, puis du bÃ©nÃ©fice.
- Exemples chiffrÃ©s simples, cas anonymisÃ©s, bÃ©nÃ©fices concrets.
- Hook fort en 1Ã¨re phrase < 80 caractÃ¨res.
- CTA sobre uniquement quand utile. Aucun Â« Et vous ? Â» de fin gÃ©nÃ©rique.
- Cible principale : dirigeants PME / TPE. Secondaire : DAF internes ou externes, experts-comptables.`;

const STATIC_BANNED = [
  'Aucun tiret long (â ou â). Utiliser virgule ou phrase courte.',
  'Aucune formule Â« ce n\'est pas X, c\'est Y Â» et variantes.',
  'Aucune formule Â« non, X ne suffit pas Â».',
  'Aucune formule Â« la vÃ©ritÃ©, c\'est que Â».',
  'Aucune formule Â« spoiler Â».',
  'Aucun mot creux IA : seamless, robust, delve, unlock, unleash, deep dive, game changer, rÃ©volutionner, booster, libÃ©rer le potentiel, Â« dans un monde oÃ¹â¦ Â».',
  'Pas de hashtags gÃ©nÃ©riques (#leadership, #motivation). Hashtags ciblÃ©s uniquement (#DAF, #PME, #treso).',
  'Pas plus de 3 emojis dans tout le post.',
  'Pas de mots en MAJUSCULES (sauf acronymes â¤ 4 lettres : DAF, SaaS, PME, FEC, FAE, FNP).',
  'Pas de confidentialitÃ© client risquÃ©e : pas de nom, pas de chiffres internes identifiables, secteur gÃ©nÃ©rique.',
  'Pas de tutoiement. Pas de claims exagÃ©rÃ©s. Pas de conclusion gÃ©nÃ©rique.'
];

const STATIC_INSPIRATION_RULES =
`INSPIRATION â  COPIE
Les inspirations sont des notes abstraites de style. Elles servent Ã  comprendre rythme, densitÃ©, pÃ©dagogie, structure, niveau de clartÃ©.
Aucun post gÃ©nÃ©rÃ© ne doit permettre de deviner quel profil a servi d'inspiration.
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
  const dynamicRules = d.rules.length ? `RÃGLES DE VOIX SUPPLÃMENTAIRES (depuis Brand DNA utilisateur)\n${d.rules.map(s => `- ${s}`).join('\n')}\n\n` : '';
  const featuresBlock = d.features.length ? `FEATURES PRIORITAIRES Ã MENTIONNER QUAND APPROPRIÃ (pilier Produit / PÃ©dagogie)\n${d.features.map(s => `- ${s}`).join('\n')}\n\n` : '';
  const audiencesBlock = d.audiences.length ? `AUDIENCES\n${d.audiences.map(s => `- ${s}`).join('\n')}\n\n` : '';
  const hashtagsBlock = d.hashtags.length ? `HASHTAGS FAVORIS (ciblÃ©s, jamais gÃ©nÃ©riques)\n${d.hashtags.join(' ')}\n\n` : '';
  const pilierLine = pilier ? `\nPILIER ÃDITORIAL DE CE POST : ${pilier}\n` : '';

  return `Tu es l'Ã©diteur LinkedIn de Cyril Coulange, fondateur de Heelio (SaaS trÃ©sorerie pour PME).

${STATIC_VOICE}

${dynamicRules}INTERDICTIONS ABSOLUES
${allBanned}

LONGUEUR
- Cible 200-1300 caractÃ¨res. Optimal 600-900.
- Sauts de ligne entre paragraphes.

${audiencesBlock}${featuresBlock}${hashtagsBlock}${STATIC_INSPIRATION_RULES}
${pilierLine}
Format de rÃ©ponse : tu produis EXACTEMENT 3 propositions distinctes, sÃ©parÃ©es par "===PROP===" sur sa propre ligne. Aucun prÃ©ambule, aucun commentaire avant ou aprÃ¨s. Juste les 3 textes.`;
}

const PILIER_HINTS: Record<string, string> = {
  'Lundi Â· Cas dirigeant anonymisÃ©':   'Raconte un cas dirigeant anonymisÃ© : situation, dÃ©clic, action, rÃ©sultat chiffrÃ©. Pas de nom, secteur gÃ©nÃ©rique.',
  'Lundi Â· Cas client':                'Raconte un cas dirigeant anonymisÃ© : situation, dÃ©clic, action, rÃ©sultat chiffrÃ©.',
  'Mardi Â· PÃ©dagogie sans jargon':     'Explique un concept finance/treso/DAF sans jargon, avec un exemple concret.',
  'Mardi Â· PÃ©dagogie':                 'Explique un concept finance/treso/DAF sans jargon, avec un exemple concret.',
  'Mercredi Â· Produit / dÃ©mo / nouveautÃ© / release note': 'PrÃ©sente une feature Heelio ou une release. BÃ©nÃ©fice utilisateur d\'abord, mÃ©canique ensuite.',
  'Mercredi Â· Produit':                'PrÃ©sente une feature Heelio. BÃ©nÃ©fice utilisateur d\'abord.',
  'Jeudi Â· Opinion / hot take mesurÃ©': 'Hot take mesurÃ©. Position claire dÃ¨s la 1re phrase. 2-3 raisons. Pas de provocation gratuite.',
  'Jeudi Â· Opinion':                   'Hot take mesurÃ©. Position claire dÃ¨s la 1re phrase. 2-3 raisons.',
  'Vendredi Â· Build in public':        'Partage le rÃ©el : ce qui marche, ce qui rate, les chiffres bruts. Authentique, sans posture.'
};

export async function generateThreeProposals(input: { pilier?: string; brief: string; inspirations?: string[] }): Promise<{ proposals: string[]; raw: string; model: string }> {
  const c = await client();
  const pilierHint = input.pilier && PILIER_HINTS[input.pilier]
    ? `\n\n${PILIER_HINTS[input.pilier]}`
    : '';
  const inspoBlock = (input.inspirations && input.inspirations.length)
    ? `\n\nNOTES D'INSPIRATION (style abstrait uniquement, jamais Ã  recopier) :\n${input.inspirations.slice(0,5).map(i => `- ${i}`).join('\n')}`
    : '';

  const userPrompt = `BRIEF : ${input.brief}${pilierHint}${inspoBlock}

Produis 3 propositions distinctes, chacune respectant strictement les rÃ¨gles ci-dessus. SÃ©pare-les par "===PROP===" sur sa propre ligne.`;

  const system = await buildSystemPrompt(input.pilier);
  const MODEL = 'claude-sonnet-4-6';
  const msg = await c.messages.create({ model: MODEL, max_tokens: 2400, system, messages: [{ role: 'user', content: userPrompt }] });
  const raw = msg.content.filter((x: any) => x.type === 'text').map((x: any) => x.text).join('\n');
  const proposals = raw.split(/^===PROP===\s*$/m).map(s => s.trim()).filter(Boolean).slice(0, 3);
  if (proposals.length === 0) throw new Error('Claude a rÃ©pondu sans propositions exploitables.');
  return { proposals, raw, model: MODEL };
}

const VISUAL_SYSTEM_PROMPT = `Tu es designer SaaS B2B. Tu produis du SVG inline propre, dimensions 1200x630.
Design system Heelio : couleur primaire #6366F1, foncÃ©e #4F46E5, fond #F8FAFC, surface #FFFFFF, texte #0F172A, secondaire #64748B, succÃ¨s #10B981, danger #EF4444.
Police system-ui sans-serif. Coins arrondis 16px sur cartes, 10px sur boutons. Style Ã©purÃ©, espace blanc, hiÃ©rarchie typo claire. Pas de dÃ©gradÃ©s tape-Ã -l'Åil. Pas d'emojis sur les visuels produit.
SVG autonome (pas de rÃ©fÃ©rence externe). Texte lisible (min 18px corps, 32-48px titres). viewBox="0 0 1200 630".
RÃ©ponds avec UNIQUEMENT le bloc <svg ...>...</svg>, rien d'autre.`;

export async function generateClaudeDesignSvg(prompt: string): Promise<{ svg: string; model: string }> {
  const c = await client();
  const dsBlock = await designSystemPromptBlock().catch(() => '');
  const fullPrompt = dsBlock ? `DESIGN SYSTEM CADENCE\n${dsBlock}\n\nDEMANDE\n${prompt}` : prompt;
  const MODEL = 'claude-sonnet-4-6';
  const msg = await c.messages.create({ model: MODEL, max_tokens: 4000, system: VISUAL_SYSTEM_PROMPT, messages: [{ role: 'user', content: fullPrompt }] });
  const raw = msg.content.filter((x: any) => x.type === 'text').map((x: any) => x.text).join('\n');
  const m = raw.match(/<svg[\s\S]*?<\/svg>/);
  if (!m) throw new Error('Claude n\'a pas renvoyÃ© de SVG valide.');
  return { svg: m[0], model: MODEL };
}
