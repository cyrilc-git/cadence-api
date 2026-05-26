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
- Tonalité pivot : expert · simple · avisé · proximité. Comme un dirigeant
  qui partage son expertise finance à un pair, à hauteur d'épaule.
- Hook concret-imagé : objet du quotidien, métaphore familière, anecdote
  courte. Désamorce la technicité financière avant d'entrer dans le sujet.
  Ex : « Il suffit d'ajouter un oeuf. » pour parler marketing,
       « Un dashboard pas glamour. » pour parler transparence financière.
- Démonstration sans jargon, sans posture. Phrases courtes, paragraphes
  aérés, vocabulaire simple, zéro mot creux.
- Leçon implicite, jamais assénée. Le lecteur dirigeant tire la conclusion.
- Parler d'abord du problème utilisateur, puis du bénéfice.
- Exemples chiffrés simples, cas anonymisés, bénéfices concrets.
- Hook fort en 1ère phrase < 80 caractères, idéalement < 60.
- CTA sobre uniquement quand utile. Aucun « Et vous ? » de fin générique.
- Cible principale : dirigeants PME / TPE. Secondaire : DAF internes ou externes, experts-comptables.

NARRATION (V16 — un post sans tension n'a aucune chance d'être lu)
- Un post LinkedIn n'est pas un conseil. C'est une tension qui se résout.
- Choisissez une structure invisible parmi celles-ci selon le sujet :
  · illusion → réalité (on croyait X, en fait Y)
  · détail concret → vérité métier (un dashboard pas glamour révèle…)
  · croyance → coût caché (sembler économiser X coûte en réalité Y)
  · scène → analyse (une réunion, puis ce qu'elle dit du marché)
  · erreur → compréhension (j'ai mal lu X, voici ce que j'ai appris)
  · micro tension → résolution calme (le banquier hésite, puis…)
  · question implicite → réponse indirecte (on ne pose pas la question, la phrase y répond)
- Ne PAS annoncer la structure. Elle doit être invisible : le lecteur la
  ressent sans la nommer.
- Toujours une friction concrète quelque part : un coût, un délai, un
  arbitrage, un compromis, une discussion inconfortable, un détail
  opérationnel surprenant. PAS de vision abstraite seule.
- Pas de morale finale assénée. Pas de "voici les 3 leçons". Pas de
  "j'ai compris que…". La leçon se déduit, ne s'énonce pas.
- Préférer le verbe d'action concret (cite, paie, refuse, accepte, signe,
  rate, doute) au verbe abstrait (impacter, transformer, révolutionner).

TERRAIN (V16 — du réel, pas de la vision)
- Cite : un montant, un délai en jours/semaines, un arbitrage, une
  discussion (sans noms), une décision difficile, un détail opérationnel.
- Évite : « visionnaire », « stratégique », « clé de la réussite »,
  « tournant majeur », « impacter durablement », « optimiser la valeur ».
- Si le post n'a pas un seul chiffre ou un seul détail concret, il manque
  de terrain.`;

const STATIC_BANNED = [
  'Aucun tiret long (— ou –). Utiliser virgule ou phrase courte.',
  'Aucune formule « ce n\'est pas X, c\'est Y » et variantes.',
  'Aucune formule « non, X ne suffit pas ».',
  'Aucune formule « la vérité, c\'est que ».',
  'Aucune formule « spoiler ».',
  'Aucune formule signature : « Résultat : », « Et c\'est là que… », « La vérité c\'est que… », « Voici pourquoi : », « Le vrai problème c\'est… ».',
  'Aucune phrase qui démarre par « Pas parce que… » (cliché IA "not because X but because Y").',
  'Aucun mot creux IA : impactant, insight, seamless, robust, delve, unlock, unleash, deep dive, game changer, révolutionner, booster, libérer le potentiel, « dans un monde où… », disruption, révolutionnaire.',
  'Pas de hashtags génériques (#leadership, #motivation). Hashtags ciblés uniquement (#DAF, #PME, #treso).',
  'Aucun emoji. Préférer mots ou chiffres.',
  'Pas de mots en MAJUSCULES (sauf acronymes ≤ 4 lettres : DAF, SaaS, PME, FEC, FAE, FNP).',
  'Pas de phrases ultra courtes en rafale (staccato IA) : éviter 3+ phrases consécutives de ≤ 5 mots.',
  'Pas de confidentialité client risquée : pas de nom, pas de chiffres internes identifiables, secteur générique.',
  'Pas de tutoiement. Pas de claims exagérés. Pas de conclusion générique.'
];

const STATIC_INSPIRATION_RULES =
`INSPIRATION ≠ COPIE
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

// V12.7 — Direction artistique Heelio durcie, alignement avec les visuels
// que Cyril produit à la main pour ses posts LinkedIn.
const VISUAL_SYSTEM_PROMPT_BASE = `Tu es directeur artistique éditorial pour un compte LinkedIn fintech B2B (Heelio / Cadence).
Ton style : Linear x Notion x Stripe Atlas. Sobre, premium, lisible, beaucoup d'air.
Tu produis du SVG inline propre, viewBox cohérent avec le format demandé.

DIRECTION ARTISTIQUE HEELIO (à respecter quasi-systématiquement) :
- Fond clair par défaut : #FAFAF9 (warm) ou #F8FAFC (cool). Évite le pur #FFFFFF.
- Bleu primaire : #2563EB. Bleu foncé pour accents : #1D4ED8.
- Texte : titres en #0F172A, secondaire en #64748B, métadonnées en #94A3B8.
- Une seule famille d'accent par visuel (bleu OU vert OU ambre, jamais 3+).
- Pas de gradient. Pas d'ombre flashy. Pas d'illustration cartoonesque.
- Hiérarchie typographique nette : 1 élément central dominant, le reste sous-texte.
- Beaucoup d'espace : padding interne généreux, marges respirantes.

TYPOGRAPHIE :
- Sans-serif éditorial : font-family="Inter, system-ui, sans-serif"
- Hooks et phrases d'opinion : possible serif Georgia/Charter pour la chaleur
- Tailles : titres 36-72px selon format, corps 14-18px, méta 11-12px
- Numbers tabular : font-variant-numeric="tabular-nums" sur les chiffres
- Letter-spacing 1-2px sur les UPPERCASE étiquettes (Inter sm)

COMPOSITION :
- 1 idée centrale par visuel. Jamais 3 messages d'égale importance.
- Pour Carte KPI : chiffre énorme au centre/haut, libellé sous-texte, fond clair.
- Pour Schéma pédagogique : 3 blocs alignés, flèches fines #94A3B8, numéros en cercles bleus.
- Pour Capture annotée : zone capture grisée + 3 annotations max en cercles bleus numérotés.
- Pour Visuel opinion minimal : une phrase serif centrée, filet bleu 2px sous-titre, beaucoup de vide.

FORMATS DEMANDÉS :
- LinkedIn paysage : viewBox="0 0 1200 630"
- LinkedIn carré (carrousel/opinion) : viewBox="0 0 1080 1080"
- Story / portrait : viewBox="0 0 1080 1350"
- Si rien n'est précisé : prendre 1200x630.

RÈGLES OBLIGATOIRES :
- SVG autonome (aucune référence externe, aucun <image href> distant)
- Si des tokens DESIGN SYSTEM utilisateur sont fournis ci-dessous, les utiliser EN PRIORITÉ
- Si une URL Figma est mentionnée, l'utiliser comme référence stylistique (sans la fetch)
- Pas d'emojis. Pas de mots creux. Pas de jargon marketing.
- Réponds avec UNIQUEMENT le bloc <svg ...>...</svg>, rien d'autre.`;

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


// V9.0 §7 — Moodboard tagging via Claude Vision
const MOODBOARD_TAGS = ['sobre', 'éditorial', 'dark', 'agressif', 'data-heavy', 'minimal', 'fintech', 'pédagogique', 'maximaliste', 'photo', 'illustration', 'typo-driven', 'palette-froide', 'palette-chaude'];

// V12.8 — Classification automatique d'un visuel généré dans les types
// lib/visual-memory (VisualFormat + VisualComposition). Réutilise Claude
// Vision mais avec un prompt strict sur nos enums.
export async function classifyVisualImage(imageUrl: string): Promise<{
  composition: 'centered' | 'verticale' | 'horizontale' | 'grille' | 'asymetrique' | 'minimaliste' | 'dense' | 'editorial' | 'data_first' | 'photo_first' | 'other' | null;
  format: 'feature' | 'schema' | 'capture' | 'illustration' | 'carousel' | 'cover' | 'quote' | 'data' | 'meme' | 'photo' | 'other' | null;
  density: 'minimal' | 'équilibrée' | 'dense' | null;
  tags: string[];
}> {
  const c = await client();
  try {
    const msg = await c.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'url', url: imageUrl } as any },
          {
            type: 'text',
            text: `Analysez cette image (visuel LinkedIn B2B). Répondez en JSON strict sans préambule :
{
  "composition": "centered"|"verticale"|"horizontale"|"grille"|"asymetrique"|"minimaliste"|"dense"|"editorial"|"data_first"|"photo_first"|"other",
  "format": "feature"|"schema"|"capture"|"illustration"|"carousel"|"cover"|"quote"|"data"|"meme"|"photo"|"other",
  "density": "minimal"|"équilibrée"|"dense",
  "tags": ["sobre", "éditorial", ...]
}
Règles :
- composition = structure visuelle dominante (centered = élément central, data_first = chiffre principal en grand, editorial = style magazine, minimaliste = un seul élément)
- format = type éditorial (feature = mockup produit, schema = schéma pédagogique avec étapes/flèches, data = carte KPI/sparkline, quote = phrase citée, illustration = dessin/scène)
- 2 à 4 tags maximum.`,
          },
        ],
      }],
    });
    const raw = msg.content.filter((x: any) => x.type === 'text').map((x: any) => x.text).join('\n').trim();
    const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      composition: parsed.composition || null,
      format: parsed.format || null,
      density: parsed.density || null,
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 6) : [],
    };
  } catch {
    return { composition: null, format: null, density: null, tags: [] };
  }
}

export async function tagMoodboardImage(imageUrl: string): Promise<{ tags: string[]; palette?: string; density?: string }> {
  const c = await client();
  const msg = await c.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'url', url: imageUrl } as any },
        {
          type: 'text',
          text: `Analysez cette image de moodboard pour une direction artistique LinkedIn B2B.
Réponse JSON strict (aucun préambule) :
{ "tags": ["sobre"|"éditorial"|"dark"|"agressif"|"data-heavy"|"minimal"|"fintech"|"pédagogique"|"maximaliste"|"photo"|"illustration"|"typo-driven"|"palette-froide"|"palette-chaude"], "palette": "courte description couleurs", "density": "minimal"|"équilibrée"|"dense" }
Sélectionnez 2-4 tags maximum les plus pertinents.`
        }
      ]
    }]
  });
  const raw = msg.content.filter((x: any) => x.type === 'text').map((x: any) => x.text).join('\n').trim();
  // Strip code fences si présents
  const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/```\s*$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    const tags = Array.isArray(parsed.tags) ? parsed.tags.filter((t: any) => typeof t === 'string' && MOODBOARD_TAGS.includes(t)) : [];
    return { tags, palette: parsed.palette, density: parsed.density };
  } catch {
    return { tags: [] };
  }
}
