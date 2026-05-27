// Brand DNA et garde-fous éditoriaux Cadence/Heelio
// Tout est server-side. Affichable côté UI sans secrets.

export const PILIERS = [
  { key: 'Lundi · Cas client',         day: 'Lundi',    color: 'blue',   anonymisation: true },
  { key: 'Mardi · Pédagogie',          day: 'Mardi',    color: 'green',  anonymisation: false },
  { key: 'Mercredi · Produit',         day: 'Mercredi', color: 'purple', anonymisation: false },
  { key: 'Jeudi · Opinion',            day: 'Jeudi',    color: 'orange', anonymisation: false },
  { key: 'Vendredi · Build in public', day: 'Vendredi', color: 'pink',   anonymisation: false }
] as const;

// V15.19 — Voix Cadence enrichie après référence Yann Leonardi.
// "Expert simple avisé proximité" devient le pivot : on partage de
// l'expertise finance à des CEO/dirigeants sans poser ni jargonner.
// Le hook est concret et imagé (idéalement un objet du quotidien ou
// une métaphore familière) pour désamorcer la barrière technique.
// La leçon est implicite, jamais assénée.
export const VOIX = {
  vouvoiement: true,
  founder_voice: true, // Pas DAF, Cyril fondateur Heelio
  tonalité: ['pragmatique', 'expert sans jargon', 'avisé', 'proximité', 'concret', 'fiable'],
  hook_style: 'concret-imagé : objet du quotidien, métaphore familière, anecdote courte. Désamorce la technicité avant d\'entrer dans le sujet.',
  démonstration: 'Sans jargon. Sans posture. Toujours à hauteur d\'épaule du lecteur dirigeant.',
  leçon: 'Implicite, jamais assénée. Le lecteur tire la conclusion lui-même.',
  longueur_cible: { min: 200, max: 1300 } // caractères
};

export const ANTI_PATTERNS = [
  { id: 'em_dash',      label: 'Tiret long (— ou –)', pattern: /[—–]/g, severity: 'critical' },
  { id: 'not_x_y',      label: '"Ce n\'est pas X, c\'est Y" et variantes', pattern: /\b(c['e]?st|n['e]?st)\s+pas\s+\w+[\s,]+c['e]?st\s+\w+/gi, severity: 'critical' },
  // V9.1.1 — mots creux étendus : impactant, insight, game-changer (déjà présent), etc.
  { id: 'mots_creux',   label: 'Mots creux IA (impactant, insight, game-changer, seamless…)', pattern: /\b(impactant|impactante|insight|insights|game[- ]?changer|seamless|robust|delve|leverage|unlock|unleash|deep[- ]dive|dans un monde où|révolutionnaire|disrupter|disruption)\b/gi, severity: 'high' },
  // V9.1.1 — formules signature : "Résultat :", "Et c'est là que…", "La vérité c'est que…"
  { id: 'resultat_formule', label: 'Formule signature ("Résultat :", "Et c\'est là…", "La vérité c\'est…")', pattern: /(?:^|\n|\.\s+)\s*(?:R[ée]sultat\s*:|Et\s+c['e]?st\s+l[àa]\s+que|La\s+v[ée]rit[ée]\s+c['e]?st\s+que|Voici\s+pourquoi\s*:|Le\s+vrai\s+probl[èe]me\s*c['e]?st)/gi, severity: 'high' },
  // V9.1.1 — "Pas parce que..." en début de phrase (cliché IA "not because... but because...")
  { id: 'pas_parce_que', label: '"Pas parce que…" en début de phrase (cliché IA)', pattern: /(?:^|\n|\.\s+|\?\s+|!\s+)\s*Pas\s+parce\s+qu[e']/gi, severity: 'high' },
  // V9.1.1 — emoji burst plus strict (>1 emoji = soupçon, >3 = clair)
  { id: 'emoji',        label: 'Emoji détecté (préférer mots / chiffres)', test: (t: string) => (t.match(/\p{Extended_Pictographic}/gu) || []).length >= 1, severity: 'medium' },
  // V9.1.1 — staccato : 3+ phrases courtes (<6 mots) consécutives
  { id: 'staccato',     label: 'Phrases ultra-courtes en rafale (staccato IA)', test: (t: string) => {
      const sentences = t.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
      let streak = 0, maxStreak = 0;
      for (const s of sentences) {
        const words = s.trim().split(/\s+/).length;
        if (words > 0 && words <= 5) { streak++; if (streak > maxStreak) maxStreak = streak; }
        else streak = 0;
      }
      return maxStreak >= 3;
    }, severity: 'medium' },
  { id: 'all_caps',     label: 'Mot en MAJUSCULES (>1 mot consécutif)', pattern: /\b[A-Z]{4,}\s+[A-Z]{4,}/g, severity: 'medium' },
  { id: 'tutoiement',   label: 'Tutoiement détecté', pattern: /\b(tu|toi|ton|ta|tes)\b/gi, severity: 'high' },
  // V16.2 — Détection "trop LinkedIn" : morales évidentes, "voici les N
  // leçons", punchlines fabriquées, conclusion forcée. La voix Cadence
  // pose la leçon implicite, jamais assénée.
  { id: 'voici_n_lecons', label: '"Voici les N leçons / N raisons / N choses" (cliché LinkedIn)', pattern: /(?:^|\n|\.\s+)\s*Voici\s+(?:les|mes|\d+|trois|cinq|sept)\s+(?:le[çc]ons?|raisons?|choses?|cl[ée]s?|conseils?|astuces?|erreurs?|principes?)/gi, severity: 'high' },
  { id: 'morale_assenee', label: 'Morale assénée ("J\'ai compris que…", "Ma plus grande leçon…")', pattern: /(?:^|\n|\.\s+)\s*(?:J['e]ai compris que|Ma plus grande le[çc]on|Le[çc]on apprise\s*:|Ce que j['e]ai retenu\s*:|En conclusion\s*:|Pour conclure\s*:)/gi, severity: 'high' },
  { id: 'cta_generique', label: 'CTA générique fin de post ("Et vous ?", "Qu\'en pensez-vous ?")', pattern: /(?:^|\n|\.\s+)\s*(?:Et\s+vous\s*\?|Qu['e]en pensez-vous\s*\?|Vos\s+retours\s*\?|Partagez\s+en\s+commentaires|Dites-moi\s+(?:en\s+)?(?:commentaires?|ce\s+que))/gi, severity: 'high' },
  { id: 'changement_dramatique', label: 'Bascule dramatique surjouée ("Et c\'est là que tout a changé")', pattern: /(?:^|\n|\.\s+)\s*(?:Et\s+c['e]?st\s+l[àa]\s+que\s+(?:tout\s+)?a\s+chang[ée]|Tout\s+a\s+chang[ée]\s+(?:le\s+jour\s+où|quand|en\s+un\s+instant)|Et\s+puis\s+un\s+jour)/gi, severity: 'high' },
  { id: 'vision_abstraite', label: 'Vocabulaire vision abstraite (visionnaire, stratégique, tournant majeur, optimiser…)', pattern: /\b(visionnaire|tournant\s+majeur|optimiser\s+la\s+valeur|impacter\s+durablement|cl[ée]\s+de\s+la\s+r[ée]ussite|cr[ée]er\s+de\s+la\s+valeur|aligner\s+les\s+[ée]quipes|excellence\s+op[ée]rationnelle)\b/gi, severity: 'medium' },
  { id: 'motivation_creuse', label: 'Phrase motivationnelle (la peur, le doute, les rêves, l\'audace…)', pattern: /\b(?:n['e]?ayez plus peur|osez (?:vraiment|enfin)|croyez en (?:vous|vos r[êe]ves)|sortez de (?:votre )?zone de confort|libérez votre potentiel|d[ée]passez vos limites)\b/gi, severity: 'high' },
  // V25.1 — Anti-slop FR enrichi inspiré du corpus Rossmann (24 règles)
  // adapté au français. Tous les patterns ci-dessous viennent de signaux
  // qui distinguent un texte humain d'un texte IA même quand le lexique
  // semble naturel.
  // ── Intensifiers vides : « extrêmement », « considérablement »…
  //    L'humain met un chiffre, l'IA met un adverbe. Sortie possible :
  //    « les prix sont extrêmement élevés » → « les prix ont doublé en 18 mois ».
  { id: 'intensifiers_creux', label: 'Intensifiers creux (extrêmement, considérablement, incroyablement…)', pattern: /\b(extr[êe]mement|dramatiquement|consid[ée]rablement|incroyablement|profond[ée]ment|v[ée]ritablement|absolument|litt[ée]ralement|remarquablement|exceptionnellement|significativement)\b/gi, severity: 'high' },
  // ── Transitions IA : « de plus », « en outre », « cela étant dit »…
  //    L'humain enchaîne avec « et », « mais », « pourtant ». L'IA empile.
  { id: 'transitions_ai', label: 'Transitions IA empilées (de plus, en outre, cela étant dit, à sa base…)', pattern: /\b(?:de plus|en outre|n[ée]anmoins|cela [ée]tant dit|ceci [ée]tant|il convient de noter que|[àa] sa base|pour simplifier|en essence|par cons[ée]quent)\b/gi, severity: 'medium' },
  // ── Weasel words : « pourrait éventuellement », « peut potentiellement »…
  //    Soit l'affirmation est vraie, soit elle ne l'est pas. Couper le hedge
  //    ou la phrase complète.
  { id: 'weasel_words', label: 'Hedging fuyant ("pourrait éventuellement", "peut potentiellement", "il se pourrait que")', pattern: /\b(?:pourrait [ée]ventuellement|peut potentiellement|est susceptible de|il se pourrait que|il semble que|il appara[îi]t que|on pourrait dire que)\b/gi, severity: 'high' },
  // ── Tells académiques FR : « mettre en lumière », « ouvrir la voie à »,
  //    « primordial », « préalablement à »…
  { id: 'academic_tells', label: 'Tournures académiques IA (mettre en lumière, ouvrir la voie à, primordial, dans le cadre de…)', pattern: /\b(?:mettre en lumi[èe]re|ouvrir la voie [àa]|primordial(?:e|es|aux)?|pr[ée]alablement [àa]|[àa] la lumi[èe]re de|au regard de|dans le cadre de|le fait que|au sein de la dynamique)\b/gi, severity: 'medium' },
  // ── Symbolisme creux : phrases AI-tells multipliées 100-400x dans le
  //    corpus IA. Version FR de « left an indelible mark », « provide a
  //    valuable insight », « a stark reminder », « watershed moment ».
  { id: 'symbolisme_creux', label: 'Symbolisme creux IA (empreinte durable, tournant majeur, profondément ancré, signal fort…)', pattern: /\b(?:ouvrir de nouvelles perspectives|laisser(?:a|ait)?\s+une empreinte durable|un t[ée]moignage de|un tournant majeur|profond[ée]ment ancr[ée]e?s?|un signal fort|une le[çc]on (?:pr[ée]cieuse|essentielle)|un rappel saisissant)\b/gi, severity: 'high' },
  // ── Hallucinations markup : artefacts d'outils IA recopiés sans relecture.
  //    Tolérance zéro — si présent, le texte n'a pas été relu.
  { id: 'markup_hallucination', label: 'Artefact de markup IA ("oaicite", "turn0search", "grok_card", "contentReference")', pattern: /\b(oaicite|turn0search\d+|grok_card|contentReference|attributableIndex)\b/gi, severity: 'critical' },
  // ── Narration de processus : « je n'ai pas trouvé », « impossible de
  //    vérifier ». L'IA raconte sa recherche, l'humain coupe ce qu'il
  //    ne peut pas tenir.
  { id: 'process_narration', label: 'Narration du processus de recherche ("je n\'ai pas trouvé", "impossible de vérifier")', pattern: /\b(?:je n['e]?ai pas (?:pu )?trouv[ée]|je n['e]?ai pas (?:pu )?identifier|impossible de v[ée]rifier|aucune source disponible|n['e]?a pas pu [êe]tre identifi[ée]|d['e]?apr[èe]s mes recherches)\b/gi, severity: 'medium' },
  // ── Hedging density : > 3 marqueurs (peut-être, probablement, semble-t-il,
  //    il se peut que, possiblement) dans un même paragraphe = drapeau rouge.
  //    Mesuré paragraphe par paragraphe.
  { id: 'hedging_density', label: 'Densité de prudence (>3 marqueurs "peut-être/probablement/sans doute" dans un même paragraphe)', test: (t: string) => {
      const paras = t.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 50);
      const hedgeRe = /\b(?:peut-?[êe]tre|probablement|vraisemblablement|sans doute|possiblement|apparemment|il semble que|il se peut que|on dirait que|en quelque sorte|grosso modo)\b/gi;
      for (const p of paras) {
        const hits = (p.match(hedgeRe) || []).length;
        if (hits > 3) return true;
      }
      return false;
    }, severity: 'medium' },
  // ── Question rhétorique vide : « Et si je vous disais que… ? », « Vous
  //    savez quoi ? », « Devinez quoi ? » — l'IA croit que ça crée du
  //    suspense, l'humain le trouve mou.
  { id: 'question_rhetorique', label: 'Question rhétorique creuse ("Et si je vous disais que…", "Devinez quoi ?")', pattern: /(?:^|\n|\.\s+)\s*(?:Et si je vous disais|Vous savez quoi\s*\?|Devinez quoi\s*\?|Et si je vous dis que|Imaginez (?:un instant|que))/gi, severity: 'medium' }
];

export type AntiPatternHit = { id: string; label: string; severity: string; matches: string[] };

// V14.8 — Nettoie le texte d'un anti-pattern visible avant affichage
// (ex: suggestions du Radar qui contiennent encore des em-dashes datant
// d'avant le ban). Remplace — et – par " · " (mid-dot signature Cadence).
// Doit rester idempotent : appelable plusieurs fois sans dégrader.
export function sanitizeForBrandVoice(text: string): string {
  if (!text) return text;
  return text
    .replace(/\s*[—–]\s*/g, ' · ')          // tiret long entouré d'espaces -> " · "
    .replace(/[“”]/g, '"')        // smart double quotes -> "
    .replace(/\s{2,}/g, ' ')                // espaces multiples
    .trim();
}

// V25.6 — autoFixAntiPatterns : "Calmer le texte" en un clic.
// Corrige UNIQUEMENT les patterns lexicaux automatisables sans risque :
// em-dashes, smart quotes, doubles espaces, ellipses unicode, espaces
// avant ponctuation, conversions d'emojis (supprimés). Ne touche PAS
// aux patterns sémantiques ("voici les 3 leçons", morale assénée, etc.)
// qui exigent une réécriture humaine. Retourne le texte corrigé et la
// liste des changements appliqués (pour feedback éditorial).
export type AutoFixResult = {
  text: string;
  changes: { kind: string; count: number }[];
};

export function autoFixAntiPatterns(text: string): AutoFixResult {
  if (!text) return { text, changes: [] };
  const changes: { kind: string; count: number }[] = [];
  let out = text;

  // 1. Em-dash et en-dash entourés d'espaces -> " · "
  const emDashMatches = (out.match(/\s*[—–]\s*/g) || []).length;
  if (emDashMatches > 0) {
    out = out.replace(/\s*[—–]\s*/g, ' · ');
    changes.push({ kind: 'tiret long remplacé par " · "', count: emDashMatches });
  }

  // 2. Smart double quotes “ ” -> "
  const smartDQ = (out.match(/[“”]/g) || []).length;
  if (smartDQ > 0) {
    out = out.replace(/[“”]/g, '"');
    changes.push({ kind: 'guillemets typographiques droits', count: smartDQ });
  }

  // 3. Smart single quotes ’ -> ' (l'apostrophe française reste correcte)
  const smartSQ = (out.match(/[‘’]/g) || []).length;
  if (smartSQ > 0) {
    out = out.replace(/[‘’]/g, '\'');
    changes.push({ kind: 'apostrophe typographique normalisée', count: smartSQ });
  }

  // 4. Ellipsis unicode … -> ...
  const ellipsis = (out.match(/…/g) || []).length;
  if (ellipsis > 0) {
    out = out.replace(/…/g, '...');
    changes.push({ kind: 'ellipsis unicode → trois points', count: ellipsis });
  }

  // 5. Emojis : suppression nette (anti-pattern emoji-burst Cadence)
  const emoji = (out.match(/\p{Extended_Pictographic}/gu) || []).length;
  if (emoji > 0) {
    out = out.replace(/\p{Extended_Pictographic}\s*/gu, '');
    changes.push({ kind: 'emojis supprimés', count: emoji });
  }

  // 6. Doubles espaces → simple
  const doubleSp = (out.match(/  +/g) || []).length;
  if (doubleSp > 0) {
    out = out.replace(/  +/g, ' ');
    changes.push({ kind: 'espaces doubles', count: doubleSp });
  }

  // 7. Espaces insécables collés à la ponctuation simple FR (.,;:)
  //    On garde l'espace insécable devant ! ? : ; (norme FR), mais on
  //    supprime les espaces fantômes après ouverture de parenthèse ou
  //    devant virgule/point.
  const beforeComma = (out.match(/\s+([,.])/g) || []).length;
  if (beforeComma > 0) {
    out = out.replace(/\s+([,.])/g, '$1');
    changes.push({ kind: 'espace fantôme avant virgule/point', count: beforeComma });
  }

  return { text: out, changes };
}

export function checkAntiPatterns(text: string): AntiPatternHit[] {
  const hits: AntiPatternHit[] = [];
  for (const ap of ANTI_PATTERNS) {
    let matches: string[] = [];
    if ('pattern' in ap && ap.pattern) {
      matches = Array.from(text.matchAll(ap.pattern as RegExp), m => m[0]).slice(0, 5);
    } else if ('test' in ap && (ap as any).test) {
      if ((ap as any).test(text)) matches = ['(détecté)'];
    }
    if (matches.length) hits.push({ id: ap.id, label: ap.label, severity: ap.severity, matches });
  }
  return hits;
}

// Heelio brand visual tokens (used for /api/generate-visual claude-design mode + UI accents)
export const HEELIO_DESIGN = {
  colors: {
    primary: '#6366F1',
    primaryDark: '#4F46E5',
    bg: '#F8FAFC',
    surface: '#FFFFFF',
    ink: '#0F172A',
    muted: '#64748B',
    success: '#10B981',
    danger: '#EF4444'
  },
  fonts: {
    sans: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
  },
  radius: { card: 16, button: 10, pill: 999 },
  spacing: { card: 24 }
};
