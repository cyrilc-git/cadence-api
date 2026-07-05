import Anthropic from '@anthropic-ai/sdk';
import { brandDnaList, designSystemPromptBlock, designSystemMoodboardUrls, designSystemDefaultFormat } from './db';
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
- ORTHOGRAPHE FRANÇAISE COMPLÈTE : accents (é è ê à â î ô û ç) systématiques.
  Jamais d'ASCII forcé. Jamais « tresorerie » au lieu de « trésorerie »,
  jamais « generer » au lieu de « générer », jamais « pedagogie » au lieu
  de « pédagogie », jamais « ecriture » au lieu de « écriture », jamais
  « editorial » au lieu de « éditorial », jamais « memoire » au lieu de
  « mémoire », jamais « controle » au lieu de « contrôle ». Un texte
  français sans ses accents est cassé pour l'utilisateur.
- Apostrophes typographiques (') uniquement quand naturel, droite (') ok.
- Guillemets français « » avec espaces fines (jamais "" ou '').
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
  'Pas de tutoiement. Pas de claims exagérés. Pas de conclusion générique.',
  // V16.2 — "Trop LinkedIn" : morales évidentes, punchlines fabriquées
  'Aucune formule « Voici les N leçons / raisons / choses » et toutes ses variantes.',
  'Aucune morale assénée : « J\'ai compris que… », « Ma plus grande leçon… », « Ce que j\'ai retenu : », « En conclusion : », « Pour conclure : ». La leçon doit être implicite, le lecteur la déduit.',
  'Aucun CTA générique fin de post : « Et vous ? », « Qu\'en pensez-vous ? », « Vos retours ? », « Dites-moi en commentaires ».',
  'Aucune bascule dramatique surjouée : « Et c\'est là que tout a changé », « Tout a changé le jour où », « Et puis un jour ».',
  'Aucun vocabulaire vision abstraite : « visionnaire », « tournant majeur », « optimiser la valeur », « impacter durablement », « clé de la réussite », « créer de la valeur », « excellence opérationnelle ».',
  'Aucune phrase motivationnelle : « n\'ayez plus peur », « osez enfin », « croyez en vos rêves », « sortez de votre zone de confort », « libérez votre potentiel », « dépassez vos limites ».',
  'Aucune fausse vulnérabilité performative (« j\'ai failli tout perdre », « j\'ai pleuré ce jour-là », « j\'ai dû me regarder en face ») sauf si elle est vraie, factuelle et utile au propos.',
  // V25.1 — Anti-slop FR (adapté du corpus Rossmann 24 règles)
  'Aucun intensifier creux : "extrêmement", "considérablement", "incroyablement", "significativement", "dramatiquement", "véritablement", "absolument", "littéralement". Remplacer par un chiffre ou couper.',
  'Aucune transition AI empilée : "De plus", "En outre", "Par conséquent", "Cela étant dit", "Néanmoins", "Il convient de noter que", "À sa base", "En essence". Préférer "et", "mais", "donc".',
  'Aucun hedging fuyant : "pourrait éventuellement", "peut potentiellement", "est susceptible de", "il se pourrait que", "il semble que". Soit l\'affirmation tient, soit on coupe.',
  'Aucune tournure académique IA : "mettre en lumière", "ouvrir la voie à", "primordial", "préalablement à", "à la lumière de", "au regard de", "dans le cadre de", "le fait que".',
  'Aucun symbolisme creux : "ouvrir de nouvelles perspectives", "laisser une empreinte durable", "un témoignage de", "un tournant majeur", "profondément ancré", "un signal fort", "un rappel saisissant".',
  'Aucune question rhétorique vide : "Et si je vous disais que…", "Devinez quoi ?", "Vous savez quoi ?", "Imaginez un instant".',
  'Aucune narration du processus : "je n\'ai pas trouvé", "impossible de vérifier", "d\'après mes recherches". Couper le fait au lieu de raconter qu\'on cherche.',
  'Aucun artefact de markup IA recopié : "oaicite", "turn0search…", "grok_card", "contentReference", "attributableIndex". Présence = sortie corrompue.',
  'Pas plus de 3 marqueurs de prudence ("peut-être", "probablement", "sans doute", "vraisemblablement") dans un même paragraphe.'
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

// V18.4 — Modes de voix pour la génération
// 'ma_voix'    : respecte la mémoire stylistique actuelle (par défaut)
// 'pedagogue'  : tonalité plus enseignante, structure plus explicite
// 'direct'     : phrases plus courtes, hooks plus secs, zéro fioriture
// 'narratif'   : scène ouverte, dialogue rapporté, tension douce
// 'terrain'    : montants/délais/arbitrages plus concrets, vocabulaire opérationnel
// 'opinion'    : hot take mesuré, position claire en 1ère phrase
// 'hors_style' : exploration volontaire HORS de la signature actuelle
export type VoiceMode = 'ma_voix' | 'pedagogue' | 'direct' | 'narratif' | 'terrain' | 'opinion' | 'hors_style';

const VOICE_MODE_HINTS: Record<VoiceMode, string> = {
  ma_voix: 'MODULATION VOIX : respectez fidèlement la signature stylistique de l\'utilisateur (mémoire de voix V18). Longueur, densité, openings, vocabulaire métier dans la moyenne habituelle.',
  pedagogue: 'MODULATION VOIX : tonalité plus enseignante. Structure plus explicite (1. 2. 3. ou « D\'abord… Ensuite… Enfin… »). Un exemple concret par idée. Évitez les implicites.',
  direct: 'MODULATION VOIX : phrases plus courtes, hooks plus secs (≤ 50 chars idéal). Aucune fioriture. Verbes d\'action, suppression des intros.',
  narratif: 'MODULATION VOIX : ouvrir sur une scène. Personnage qui parle, lieu, instant. Tension douce qui se résout. Verbes d\'action concrets. Dialogue rapporté possible.',
  terrain: 'MODULATION VOIX : poussez le concret opérationnel. Au moins 2 chiffres précis (montant en €/k€, délai en jours/semaines, ratio en %). Une discussion ou un arbitrage chiffré.',
  opinion: 'MODULATION VOIX : hot take mesuré. Position claire en 1ère phrase, défendue par 1-2 exemples, sans gratuité. Pas de provocation creuse.',
  hors_style: 'MODULATION VOIX : SORTEZ volontairement de la signature stylistique habituelle de l\'utilisateur. Si ses posts sont d\'habitude pédagogiques courts, ici écrivez long et opinion. Si d\'habitude narratifs, ici écrivez démonstratif. Explorez une voix qu\'il n\'utilise pas, en restant cohérent avec les règles voix (vouvoiement, terrain concret, leçon implicite).',
};

// V20.10 — Markup hallucinations zero-tolerance
// Les modèles IA recopient parfois des artefacts d'outils internes
// ("oaicite", "turn0search3", "grok_card", "contentReference",
// "attributableIndex"). Présence = sortie corrompue, le texte n'a pas
// été relu. On les détecte et on relance une fois, sinon on rejette.
const MARKUP_HALLUCINATION_RE = /\b(oaicite\d*|turn0search\d+|grok_card|contentReference|attributableIndex)\b/i;
export function containsMarkupHallucination(text: string): boolean {
  return MARKUP_HALLUCINATION_RE.test(text);
}

export async function generateThreeProposals(input: { pilier?: string; brief: string; inspirations?: string[]; voiceMode?: VoiceMode; styleSummary?: string | null }): Promise<{ proposals: string[]; raw: string; model: string }> {
  const c = await client();
  const pilierHint = input.pilier && PILIER_HINTS[input.pilier]
    ? `\n\n${PILIER_HINTS[input.pilier]}`
    : '';
  const inspoBlock = (input.inspirations && input.inspirations.length)
    ? `\n\nNOTES D'INSPIRATION (style abstrait uniquement, jamais à recopier).
Chaque note est précédée de ses leviers entre crochets : applique UNIQUEMENT ces leviers-là de cette référence.
[Ton/voix] = registre, niveau de langue, proximité · [Structure/rythme] = ossature, longueur, cadence · [Angles/sujets] = inspire-toi des thèmes abordés, jamais des formulations.
${input.inspirations.slice(0,6).map(i => `- ${i}`).join('\n')}`
    : '';
  // V18.4 — Modulation de voix : injection de la consigne + style_summary
  // pour donner à Claude une référence concrète de "ma voix" si dispo.
  const mode = input.voiceMode || 'ma_voix';
  const voiceBlock = `\n\n${VOICE_MODE_HINTS[mode]}`;
  const styleBlock = input.styleSummary
    ? `\n\nSIGNATURE STYLISTIQUE OBSERVÉE (mémoire de voix V18) :\n${input.styleSummary}`
    : '';

  const userPrompt = `BRIEF : ${input.brief}${pilierHint}${voiceBlock}${styleBlock}${inspoBlock}

Produis 3 propositions distinctes, chacune respectant strictement les règles ci-dessus. Sépare-les par "===PROP===" sur sa propre ligne.`;

  const system = await buildSystemPrompt(input.pilier);
  const MODEL = 'claude-sonnet-4-6';

  // V20.10 — Boucle de garde : 1 tentative normale + 1 retry si markup
  // hallucination détecté. Au-delà, on lève une erreur explicite.
  let raw = '';
  let proposals: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const msg = await c.messages.create({ model: MODEL, max_tokens: 2400, system, messages: [{ role: 'user', content: userPrompt }] });
    raw = msg.content.filter((x: any) => x.type === 'text').map((x: any) => x.text).join('\n');
    if (containsMarkupHallucination(raw)) {
      // On log côté serveur sans exposer le texte exact (juste la
      // présence d'un artefact). Le retry tente une seconde fois avec
      // exactement le même prompt — souvent suffit.
      console.warn(`[generate-post] markup hallucination détecté (tentative ${attempt + 1}/2). Retry.`);
      continue;
    }
    proposals = raw.split(/^===PROP===\s*$/m).map(s => s.trim()).filter(Boolean).slice(0, 3);
    if (proposals.length > 0) break;
  }
  if (containsMarkupHallucination(raw)) {
    throw new Error('La génération a renvoyé un artefact technique IA persistant. Réessayez dans un instant.');
  }
  if (proposals.length === 0) throw new Error('Claude a répondu sans propositions exploitables.');
  return { proposals, raw, model: MODEL };
}

// V25.3 — Hook generator structuré (6 angles)
//
// Inspiré du pattern charlie947/hook-generator : 6 angles distincts
// (number-led, contrarian, transformation, authority, admission,
// future-shock) avec 2 lignes ≤ 50 caractères. Adapté FR vouvoiement,
// avec respect des anti-patterns Cadence (pas d'em-dash, pas de "voici
// les N leçons", pas de "et c'est là que").

export type HookAngle = 'number_led' | 'contrarian' | 'transformation' | 'authority' | 'admission' | 'future_shock';

export type GeneratedHook = {
  angle: HookAngle;
  line1: string;
  line2: string;
};

const HOOK_ANGLE_LABELS: Record<HookAngle, { label: string; brief: string }> = {
  number_led:     { label: 'Chiffre',         brief: 'Ouvrir sur un chiffre précis (montant, délai, ratio).' },
  contrarian:     { label: 'Contre-courant',  brief: 'Énoncer une croyance commune, puis la retourner.' },
  transformation: { label: 'Bascule',         brief: 'Avant / après personnel ou client, avec un chiffre.' },
  authority:      { label: 'Référence',       brief: 'Mentionner une figure, un livre, une marque connue.' },
  admission:      { label: 'Aveu',            brief: 'Reconnaître une erreur ou une perte concrète.' },
  future_shock:   { label: 'Présent vs futur',brief: 'Annoncer un basculement imminent du marché.' },
};

export async function generateHooks(input: { topic: string; pilier?: string; voiceMode?: VoiceMode; styleSummary?: string | null }): Promise<{ hooks: GeneratedHook[]; raw: string }> {
  const c = await client();
  const system = `Tu es l'éditeur LinkedIn de Cyril Coulange, fondateur de Heelio (SaaS trésorerie PME).

${STATIC_VOICE}

INTERDICTIONS ABSOLUES (extrait court pour la génération de hooks)
- Aucun tiret long (— ou –).
- Aucun "Ce n'est pas X, c'est Y" et variantes.
- Aucune formule "Voici les N leçons / raisons / choses".
- Aucun "Et c'est là que…", "La vérité c'est que…", "Spoiler :".
- Aucun mot creux (impactant, insight, game-changer, seamless, robust).
- Aucun emoji, aucun hashtag.
- Pas de question rhétorique creuse ("Et si je vous disais que…").
- Vouvoiement systématique.

FORMAT DE SORTIE STRICT
Pour chaque hook, tu produis EXACTEMENT 2 lignes :
- Ligne 1 (ouverture) : ≤ 50 caractères. Affirmatif (pas de question).
- Ligne 2 (relance ou contraste) : ≤ 50 caractères.

Tu produis 6 hooks distincts, séparés par "===HOOK===" sur sa propre ligne.
Chaque hook est PRÉCÉDÉ par son angle entre crochets, par exemple :
[number_led]
Ligne 1
Ligne 2
===HOOK===
[contrarian]
Ligne 1
Ligne 2

Aucun préambule, aucun commentaire, juste les 6 hooks.`;

  const styleBlock = input.styleSummary
    ? `\n\nSIGNATURE STYLISTIQUE OBSERVÉE :\n${input.styleSummary}`
    : '';

  const userPrompt = `SUJET : ${input.topic}
${input.pilier ? `\nPILIER : ${input.pilier}` : ''}${styleBlock}

Produisez 6 hooks DISTINCTS, un par angle, dans cet ordre :
[number_led]   ${HOOK_ANGLE_LABELS.number_led.brief}
[contrarian]   ${HOOK_ANGLE_LABELS.contrarian.brief}
[transformation] ${HOOK_ANGLE_LABELS.transformation.brief}
[authority]    ${HOOK_ANGLE_LABELS.authority.brief}
[admission]    ${HOOK_ANGLE_LABELS.admission.brief}
[future_shock] ${HOOK_ANGLE_LABELS.future_shock.brief}

Chacun en 2 lignes ≤ 50 caractères, séparés par "===HOOK===".`;

  const MODEL = 'claude-sonnet-4-6';
  const msg = await c.messages.create({ model: MODEL, max_tokens: 800, system, messages: [{ role: 'user', content: userPrompt }] });
  const raw = msg.content.filter((x: any) => x.type === 'text').map((x: any) => x.text).join('\n');

  // V20.10 — Garde anti-hallucination markup
  if (containsMarkupHallucination(raw)) {
    throw new Error('Génération corrompue (artefact technique). Réessayez.');
  }

  // Parse : split par ===HOOK===, puis pour chaque bloc extrait [angle]\nL1\nL2
  const blocks = raw.split(/^===HOOK===\s*$/m).map(b => b.trim()).filter(Boolean);
  const hooks: GeneratedHook[] = [];
  const angleRe = /^\[(number_led|contrarian|transformation|authority|admission|future_shock)\]\s*\n(.+?)\n(.+?)$/m;
  for (const b of blocks) {
    const m = b.match(angleRe);
    if (!m) continue;
    const angle = m[1] as HookAngle;
    const line1 = m[2].trim().replace(/[—–]/g, ',').slice(0, 80);
    const line2 = m[3].trim().replace(/[—–]/g, ',').slice(0, 80);
    if (line1 && line2) hooks.push({ angle, line1, line2 });
  }
  if (hooks.length === 0) throw new Error('Claude n\'a pas renvoyé de hooks parsables.');
  return { hooks, raw };
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

// V58.6 — Bloc image pour Claude : URL (brand kit) ou data URL base64 (image
// déposée à la génération). Retourne null si la source n'est pas reconnue.
function visualImageBlock(src: string): any | null {
  const m = String(src).match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (m) return { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } };
  if (/^https?:\/\//i.test(src)) return { type: 'image', source: { type: 'url', url: src } };
  return null;
}

export async function generateClaudeDesignSvg(prompt: string, opts?: { format?: string; exampleImages?: string[] }): Promise<{ svg: string; model: string }> {
  const c = await client();
  const dsBlock = await designSystemPromptBlock().catch(() => '');
  // V58.5 — Brand kit : couleurs/style (dsBlock, texte) + images de référence en
  // VISION réelle + format. Surcharge par génération (opts) prioritaire sur le kit.
  const brandImages = await designSystemMoodboardUrls().catch(() => []);
  const exampleImages = Array.from(new Set([...(opts?.exampleImages || []), ...brandImages])).filter(Boolean).slice(0, 4);
  const fmt = opts?.format && ['landscape', 'square', 'portrait'].includes(opts.format)
    ? opts.format
    : (await designSystemDefaultFormat().catch(() => null));
  const viewBox = fmt === 'square' ? '0 0 1080 1080' : fmt === 'portrait' ? '0 0 1080 1350' : fmt === 'landscape' ? '0 0 1200 630' : null;
  const formatHint = viewBox ? `\n\nFORMAT IMPOSÉ : viewBox="${viewBox}", respecte strictement ce ratio.` : '';
  const examplesHint = exampleImages.length
    ? `\n\nIMAGES DE RÉFÉRENCE (ci-jointes) : inspire-toi de leur palette, composition et style. Ne les recopie pas, ne les intègre pas ; produis un SVG original dans cet esprit.`
    : '';
  const textBlock = (dsBlock
    ? `DESIGN SYSTEM UTILISATEUR (PRIORITAIRE — surcharge les défauts)\n${dsBlock}\n\n`
    : '') + `DEMANDE\n${prompt}${formatHint}${examplesHint}`;

  const content: any[] = [];
  for (const src of exampleImages) { const b = visualImageBlock(src); if (b) content.push(b); }
  content.push({ type: 'text', text: textBlock });

  const MODEL = 'claude-sonnet-4-6';
  let raw: string;
  try {
    const msg = await c.messages.create({ model: MODEL, max_tokens: 4000, system: VISUAL_SYSTEM_PROMPT_BASE, messages: [{ role: 'user', content }] });
    raw = msg.content.filter((x: any) => x.type === 'text').map((x: any) => x.text).join('\n');
  } catch {
    // Repli sans images (ex : source url d'image refusée) — on garde format + design system.
    const msg = await c.messages.create({ model: MODEL, max_tokens: 4000, system: VISUAL_SYSTEM_PROMPT_BASE, messages: [{ role: 'user', content: [{ type: 'text', text: textBlock }] }] });
    raw = msg.content.filter((x: any) => x.type === 'text').map((x: any) => x.text).join('\n');
  }
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
