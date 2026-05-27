# V20 — Cahier des charges
# Intégration des skills `charlie947/social-media-skills` et `realrossmanngroup/no_ai_slop_writing_rules` dans Cadence

> Statut : projet · à valider avant exécution
> Préparé après audit des deux repos publics (28 fichiers SKILL.md + références)
> Périmètre : Cadence (Heelio · Cyril Coulange) — édition LinkedIn FR vouvoiement

---

## 0. TL;DR

Les deux repos GitHub couvrent **deux problèmes orthogonaux** :

| Repo | Problème résolu | Vraie nouveauté pour Cadence |
|---|---|---|
| `charlie947/social-media-skills` | **Pipeline LinkedIn** : voix → idéation → écriture → scoring → publication | Le **scoring data-driven** (engagement réel), la **content-matrix** (idées × formats), le **hook-generator** structuré, le **post-formatter** par framework |
| `realrossmanngroup/no_ai_slop_writing_rules` | **Anti-slop** : ne pas écrire comme une IA | Liste anglaise hyper-rigoureuse (24 règles + corpus statistique), **détection de patterns structurels** (variance de longueur, burstiness, densité de transitions), distinction métaphorique vs littéral |

**Ce que Cadence a déjà :**
- ✅ STATIC_VOICE riche en français, vouvoiement, founder voice, 7 structures narratives invisibles (V16.1)
- ✅ STATIC_BANNED (21 anti-patterns FR), brand-config ANTI_PATTERNS (15 patterns regex)
- ✅ `lib/style-memory.ts` (voix personnelle, agrégat sur posts confirmés)
- ✅ `lib/narrative-check.ts` (8 signaux narratifs, détection morale assénée / scène absente)
- ✅ 7 voiceModes (V18.4), détection répétition stylistique opening/closing (V18.5)
- ✅ Carousels PDF natifs (V18.6-V18.9)

**Ce que Cadence n'a PAS encore :**
- ❌ Post-scorer **data-driven** sur les vrais perfs LinkedIn (likes + commentaires)
- ❌ Content-matrix (pillars × formats) pour génération d'idées en lot
- ❌ Variance de longueur de phrase + burstiness statistique en signal d'écriture
- ❌ Detection des hallucinations de markup (`oaicite`, `turn0search0`)
- ❌ Distinction métaphorique/littéral (ex : "navigate the website" OK vs "navigate the regulatory process" KO)
- ❌ Hook-generator structuré (6 angles : number-led, contrarian, transformation, authority, admission, future shock)
- ❌ Frameworks PAS/AIDA/BAB/STAR/SLAY comme options explicites côté éditeur
- ❌ Liste statistique "phrases AI-tells" (provide a valuable insight 468×, watershed moment, paramount, …)
- ❌ Auto-onboarding voice-builder (entretien guidé + génération about-me.md + voice.md)

---

## 1. Ce que `charlie947/social-media-skills` apporte

### 1.1 Architecture qu'on retient

> **Pattern fondateur** : `voice-builder` produit **deux fichiers** (`about-me.md` + `voice.md`) que **toutes les autres skills lisent en préambule**. La voix n'est pas embarquée dans chaque prompt, elle vit dans un artefact lisible et modifiable par l'utilisateur.

**Mapping vers Cadence existant :**

| Skill Charlie | Équivalent Cadence | Statut |
|---|---|---|
| `voice-builder` (about-me + voice.md) | `lib/style-memory.ts` + `lib/brand-config.ts` VOIX | **Partiel** — Cadence calcule auto à partir des posts publiés, mais pas de **fichier humainement lisible** dans /cerveau |
| `post-writer` | `/api/generate-post` + `/posts/new` | ✅ Couvert mais pas explicitement "voice files first" |
| `post-formatter` (PAS/AIDA/BAB/STAR/SLAY) | ❌ rien | **Manquant** — option structure côté éditeur |
| `post-scorer` | ❌ pas vraiment | **Manquant** — Cadence a `/api/memory-check` mais ne scorre pas contre les vraies perfs |
| `hook-generator` (6 angles, 40 chars × 2 lignes) | ❌ rien | **Manquant** — utile pour /suggestions ou bouton "+ hook" dans éditeur |
| `content-matrix` (3-5 pillars × 8 formats) | `/suggestions` Radar | **Partiel** — Cadence suggère mais pas de matrice exhaustive |
| `niche-research` | ❌ rien | **Bonus** — pourrait alimenter le Radar |
| `analytics-dashboard` | `/analytics` | ✅ Couvert |
| `pinned-comment` | ❌ rien | **Bonus** — pinned-comment suggéré après publication |
| `gemini-carousel`, `gemini-infographic`, `graphic-designer`, `reels-scripting`, `youtube-thumbnail`, `quote-post`, `profile-optimizer`, `newsletter-voice` | ❌ rien | **Hors scope V20** — Cadence reste LinkedIn-first |

### 1.2 Patterns techniques notables

1. **"Auto-start on load"** : chaque skill démarre direct sur l'étape 1, sans préambule. Cadence applique déjà cette logique côté UI (V14 sensation produit).
2. **`AskUserQuestion` batch de 4 max** : pattern pour onboarding multi-questions. Cadence pourrait l'utiliser dans `/cerveau` pour un voice-builder guidé si la mémoire est `confidence_score < 0.3`.
3. **Scoring rigoureux** : `engagement = reactions + comments × 3`, top-10 % comparé au draft, fix avec "vos top posts utilisent X (42 %) — ce draft utilise Y (12 %)". **Très applicable** à Cadence si on a un import LinkedIn de qualité (V19.1 fait).
4. **Charlie Hills benchmarks fallback** : si pas assez de data perso, fallback sur des moyennes. Cadence peut faire pareil avec un "fallback Yann Leonardi" déjà référencé en inspiration.

---

## 2. Ce que `realrossmanngroup/no_ai_slop_writing_rules` apporte

### 2.1 Les 24 règles cross-référencées

| # | Règle Rossmann | Couvert par Cadence ? | Détail |
|---|---|---|---|
| 1 | Pas d'em-dash | ✅ `em_dash` regex + `sanitizeForBrandVoice` | OK |
| 2 | Pas de stats sans source | ⚠️ partiel | STATIC_VOICE dit "exemples chiffrés" mais ne force pas l'attribution |
| 3 | Pas de clarifications parenthétiques dans les titres | N/A | Cadence ne fait pas de titres |
| 4 | Pas d'intensifiers (extremely, dramatically, significantly…) | ⚠️ partiel | `mots_creux` couvre quelques-uns, manque la liste FR : extrêmement, dramatiquement, considérablement, incroyablement, profondément, véritablement, absolument, littéralement |
| 5 | Pas de claims creux (chaque phrase finit sur du concret) | ✅ TERRAIN block | "Si pas un chiffre/détail, manque de terrain" |
| 6 | Pas de répétition de talking points | ❌ rien | À ajouter dans `narrative-check` |
| 7 | Varier la structure (pas 3 sections identiques) | ⚠️ `staccato` partiel | Ne détecte pas la **paragraph length uniformity** |
| 8 | Référence sans narration de la référence ("comme dit plus haut") | ❌ rien | Manque "comme vu précédemment", "comme nous allons le voir" |
| 9 | Pas d'urgence performative ("agissez maintenant") | ❌ rien | À ajouter |
| 10 | Pas de guillemets ironiques sur mots normaux | ❌ rien | Hors scope |
| 11 | Pas de filler phrases | ⚠️ partiel | `mots_creux` a "dans un monde où" mais manque "au final", "en fin de compte", "il convient de noter que", "il va sans dire" |
| 12 | Jamais commencer par "Whether you're" | N/A FR | Équivalent FR : "Que vous soyez…" — à ajouter |
| 13 | Écrire en chercheur, pas en copywriter | ✅ TERRAIN + démonstration sans posture | OK |
| 14 | Pas d'enthousiasme synthétique (!) | ⚠️ partiel | Pas de bannissement explicite de "!" |
| 15 | Pas de weasel words ("peut potentiellement…") | ❌ rien | FR : "pourrait éventuellement", "peut potentiellement", "est susceptible de" |
| 16 | Pas de titres narratifs/dramatiques | N/A | Pas de titres |
| 17-19 | Pas d'études de cas, dates, attributions fabriquées | ✅ STATIC_VOICE "cas anonymisés" + "secteur générique" | OK |
| 20 | Pas de transitions AI ("Furthermore", "Moreover"…) | ⚠️ partiel | Manque équivalents FR : "De plus", "En outre", "Cela étant dit", "Ceci étant", "Il convient de noter que", "À sa base", "Pour simplifier" |
| 21 | Pas de verbes AI (delve, leverage, utilize…) | ✅ `mots_creux` couvre delve/leverage/unlock | Manque les équivalents FR métaphoriques : "naviguer dans" (sens figuré), "exploiter", "tirer parti de", "favoriser", "renforcer", "souligner", "dévoiler", "simplifier", "rationaliser" |
| 22 | Pas de tells académiques (shed light on, pave the way, paramount, prior to, in light of…) | ⚠️ partiel | FR : "mettre en lumière", "ouvrir la voie à", "primordial", "préalablement à", "à la lumière de", "au regard de", "dans le cadre de", "le fait que…" |
| 23 | Citations exactes ou bracketées | ❌ rien | Hors scope (Cadence ne cite pas) |
| 24 | Pas de narration du processus ("je n'ai pas trouvé…") | ❌ rien | À ajouter — Claude pourrait écrire "je n'ai pas pu vérifier" |

### 2.2 Patterns structurels Rossmann hors lexique (les vrais cadeaux)

**Patterns que `lib/style-memory.ts` ne mesure PAS encore** mais qui sont des signaux d'IA :

1. **Sentence-length variance / Burstiness**
   - Humain : variance > AI. AI cluster autour de 15-20 mots.
   - Seuil Rossmann : "si un bloc de 500 mots ne contient ni phrase < 8 mots ni > 30 mots, manque de burstiness humaine"
   - **Applicable Cadence** : ajouter `sentence_length_variance` dans `analyzePostStyle`, signal dans `/api/memory-check`

2. **Paragraph length uniformity**
   - "Si tous les paragraphes d'une section sont à ±15 % en word count, suspect IA"
   - **Applicable Cadence** : signal `paragraph_uniformity` dans narrative-check

3. **Transition density**
   - "Si > 30 % des paragraphes commencent par un mot de transition, artificiel"
   - **Applicable Cadence** : compter "donc", "alors", "ainsi", "d'ailleurs", "par ailleurs" en début de paragraphe

4. **Opening-word repetition**
   - "3+ paragraphes consécutifs qui commencent par le même mot = mécanique"
   - **Applicable Cadence** : déjà partiellement couvert par `top_openings` de `style-memory.ts` mais en intra-post c'est nouveau

5. **Segmental entropy**
   - Variance de longueur de phrase calculée séparément intro/corps/conclusion. Si écart < 10 % entre les trois, single-pass IA.
   - **Applicable Cadence** : signal avancé, version 2

6. **Contrasting parallelism overuse**
   - "It's not X, it's Y" > 2 fois dans 500 mots = AI confiant
   - **Cadence couvre déjà** `not_x_y` regex, mais ne compte pas l'overuse — peut renforcer

7. **Inflated symbolism (statistique)** — 10 phrases anglaises avec leur multiplicateur (provide a valuable insight 468×, left an indelible mark 317×, …)
   - **Applicable Cadence** : monter le vocabulaire FR équivalent : "ouvrir de nouvelles perspectives", "laisser une empreinte durable", "un témoignage de", "un tournant", "profondément ancré"

8. **Hallucinated markup artifacts** (`oaicite`, `turn0search0`, `grok_card`, `contentReference`, `attributableIndex`)
   - **Applicable Cadence** : tolérance zéro, à ajouter dans STATIC_BANNED côté output sanitization

9. **Metaphorical vs literal distinction**
   - "navigate the website" OK / "navigate the regulatory process" flag
   - "tapestry" littéral OK / "a tapestry of regulations" flag
   - **Applicable Cadence** : ajouter un check bigram-aware pour les 5-6 mots FR les plus métaphoriques en IA : "écosystème", "paysage", "tapisserie", "symphonie", "balise" (figurative)

10. **Hedging density**
    - "Plus de 3 marqueurs de hedging dans un paragraphe = drapeau rouge"
    - FR : "il se pourrait que", "il semble que", "potentiellement", "vraisemblablement", "probablement", "il convient de noter"
    - **Applicable Cadence** : compteur dans narrative-check

---

## 3. Cadence vs les deux skills — gap final

### 3.1 Tableau de couverture
| Domaine | Cadence | Charlie947 | Rossmann | Action V20 |
|---|---|---|---|---|
| Voix personnelle pré-écriture | ✅ style-memory auto | voice.md humain | rossmann-voice statistical fingerprint | **V20.1** : exporter style-memory en `about-me.md` + `voice.md` éditables dans /cerveau |
| Anti-patterns FR riches | ✅ 36 patterns | — | — | OK |
| Anti-patterns EN/académiques | ⚠️ partiel | — | ✅ 24 règles + corpus | **V20.2** : enrichir STATIC_BANNED + ANTI_PATTERNS FR avec les équivalents (intensifiers, transitions, weasel, hedging, markup hallucinations) |
| Structures narratives | ✅ V16 (7 structures) | — | — | OK |
| Score data-driven | ❌ | ✅ post-scorer | — | **V20.3** : `/api/post-score` qui lit `content_items` filtré linkedin_published + applique scoring 5 critères |
| Hook generator | ❌ | ✅ 6 angles | — | **V20.4** : bouton "Générer 6 hooks" dans /posts/new |
| Frameworks (PAS/BAB/…) | ❌ | ✅ post-formatter | — | **V20.5** : voiceMode étendu avec 5 frameworks ou nouveau selector "structure" |
| Content-matrix | ⚠️ Radar partiel | ✅ 8 formats × pillars | — | **V20.6** : `/api/content-matrix` qui renvoie `pillars × formats` (5×8 = 40 idées) |
| Burstiness / variance | ❌ | — | ✅ thresholds | **V20.7** : ajouter `sentence_variance` à `analyzePostStyle` |
| Transition density / opening repetition intra-post | ❌ | — | ✅ | **V20.8** : enrichir narrative-check |
| Metaphorical vs literal | ❌ | — | ✅ | **V20.9** : sous-règles bigram pour 5-6 mots FR |
| Markup hallucinations | ❌ | — | ✅ zéro tolérance | **V20.10** : check pré-publication `oaicite\|turn0search\|grok_card\|contentReference\|attributableIndex` |
| Pinned comment | ❌ | ✅ | — | **V20.11 (bonus)** : suggestion pinned-comment après publication |
| Niche research / Radar enrichi | ⚠️ Radar | ✅ niche-research | — | **V20.12 (bonus)** : enrichir Radar avec contrarian takes + data points |

### 3.2 Hors scope V20 (à ne pas faire)

- Scraping LinkedIn via Apify : Cadence a déjà l'import ZIP V19.1, on garde
- Visuels Gemini : Cadence a son propre studio + carrousels PDF natifs V18
- Newsletter / Reels / YouTube : Cadence reste LinkedIn-first
- Profile optimizer : pas le cœur de Cadence

---

## 4. Plan V20 — découpage commits unitaires

> **Rappel garde-fous** (verbatim utilisateur, non négociables) :
> "1 commit = 1 sujet" · "npx tsc --noEmit avant chaque push" · "scan mojibake avant chaque push" · "attendre Vercel READY après chaque push" · "aucun publish LinkedIn auto" · "aucun secret en logs" · "vérifier en prod après chaque push"

### V20.1 — Voix exportable : `about-me.md` + `voice.md`
**Fichiers** : `lib/voice-export.ts` (nouveau), `app/api/voice-export/route.ts` (nouveau), `app/cerveau/page.tsx` (ajouter bloc), `components/VoiceFilesView.tsx` (nouveau)

**Spec** :
- À partir de `style_memory` + `brand-config.VOIX` + `narrative-check` agrégat, générer **2 blocs Markdown affichés et copiables** :
  - `about-me.md` : Cyril Coulange · founder Heelio · audience CEO/DAF/EC · 5 piliers · point de vue
  - `voice.md` : voix (3-5 attributs), rythme de phrase, hook patterns observés (top 3 openings), CTA style, **What this voice never does** (depuis top anti-patterns détectés)
- Pas de write disque : juste affichage + bouton "Copier". L'utilisateur peut éditer dans Notion s'il veut.
- Source de vérité reste `style_memory` (recalculé).

### V20.2 — Anti-slop FR enrichi
**Fichiers** : `lib/brand-config.ts` (ANTI_PATTERNS), `lib/anthropic.ts` (STATIC_BANNED), `lib/anti-slop.ts` (nouveau si volumineux)

**Spec** : ajouter 4 nouveaux patterns regex :

1. `intensifiers_fr` : `\b(extr[êe]mement|dramatiquement|consid[ée]rablement|incroyablement|profond[ée]ment|v[ée]ritablement|absolument|litt[ée]ralement|remarquablement|exceptionnellement|significativement)\b` — severity high
2. `transitions_ai_fr` : `\b(de plus|en outre|n[ée]anmoins|cela [ée]tant dit|ceci [ée]tant|il convient de noter que|[àa] sa base|pour simplifier|en essence)\b` — severity medium
3. `weasel_fr` : `\b(pourrait [ée]ventuellement|peut potentiellement|est susceptible de|il se pourrait que|il semble que|il appara[îi]t que)\b` — severity high
4. `academic_tells_fr` : `\b(mettre en lumi[èe]re|ouvrir la voie [àa]|primordial|pr[ée]alablement [àa]|[àa] la lumi[èe]re de|au regard de|dans le cadre de|le fait que)\b` — severity medium
5. `inflated_symbolism_fr` : `\b(ouvrir de nouvelles perspectives|laisser une empreinte durable|un t[ée]moignage de|un tournant majeur|profond[ée]ment ancr[ée]|un signal fort)\b` — severity high
6. `hedging_density` (test function, pas regex) : count > 3 hedging markers dans un même paragraphe
7. `markup_hallucination` : `(oaicite|turn0search\d+|grok_card|contentReference|attributableIndex)` — severity critical (drapeau rouge auto-rejet)
8. `process_narration_fr` : `\b(je n['e]?ai pas trouv[ée]|impossible de v[ée]rifier|aucune source disponible|n['e]?a pas pu [êe]tre identifi[ée])\b` — severity medium

Ajouter aussi dans STATIC_BANNED les bannières correspondantes en prose française.

### V20.3 — Post-scorer data-driven
**Fichiers** : `app/api/post-score/route.ts` (nouveau), `lib/post-scorer.ts` (nouveau), `components/PostScorecard.tsx` (nouveau)

**Spec** :
- Endpoint POST `{ text }` qui :
  1. Lit `content_items` où `provenance IN ('linkedin_published', 'linkedin_import_zip')` et `meta.engagement_score IS NOT NULL`
  2. Calcule engagement_score = reactions + comments × 3 (à ajouter dans `meta` lors du parse ZIP — **V20.3a**)
  3. Identifie top 10 % par engagement
  4. Score 5 critères 1-10 : Hook strength, Voice match (vs style_memory), Value density, Structure, Publish readiness
  5. Retourne JSON avec verdict + 3 fixes data-backed
- Affiché dans éditeur via bouton "Scorer ce post" à côté de "Sauvegarder"
- Fallback : si < 30 posts confirmés, scoring purement voice-based (sans data) + warning

### V20.4 — Hook generator
**Fichiers** : `app/api/hooks/route.ts` (nouveau), `lib/hook-gen.ts` (nouveau), `app/posts/new/client.tsx` (bouton)

**Spec** :
- POST `{ topic, voiceMode? }` → renvoie **6 hooks** en 2 lignes de 40 chars max
- 6 angles : number-led · contrarian · personal transformation · authority reference · admission · future shock
- Génération via Claude avec system prompt strict (≤ 40 chars/ligne, pas de question en ligne 1, pas d'em-dash, FR vouvoiement, **respecter VOIX Cadence**)
- Bouton "+ hooks" dans StartHint, dropdown listing les 6, click insère en haut de l'éditeur

### V20.5 — Framework selector
**Fichiers** : `app/posts/new/client.tsx`, `lib/anthropic.ts` (`FRAMEWORK_HINTS`)

**Spec** :
- Ajouter à côté du VoiceMode selector un selector `Framework` : **Aucun · PAS · BAB · STAR · Mini-récit · Contrarian**
- `FRAMEWORK_HINTS[framework]` injecté dans system prompt
- Default : Aucun (laisse Claude choisir la structure narrative invisible V16)
- "Mini-récit" force scène→analyse, "Contrarian" force croyance→coût caché, etc. (utilise les structures V16 existantes)

### V20.6 — Content-matrix
**Fichiers** : `app/api/content-matrix/route.ts` (nouveau), `app/suggestions/page.tsx` (nouvel onglet), `components/ContentMatrix.tsx` (nouveau)

**Spec** :
- GET → matrice 5 piliers (Lundi cas client … Vendredi build in public) × 8 formats (Actionnable · Motivationnel · Analytique · Contrarian · Observation · X vs Y · Présent vs Futur · Listicle)
- Chaque cellule = 1 angle concret de 1 phrase max (généré via Claude une fois, caché 7 jours dans `suggestions` table)
- Click sur cellule → ouvre /posts/new pré-rempli avec ce brief
- Surface : nouvel onglet "Idées" dans /suggestions, à côté du Radar

### V20.7 — Sentence variance dans style-memory
**Fichiers** : `lib/style-memory.ts`

**Spec** :
- Ajouter dans `analyzePostStyle` :
  - `sentence_lengths: number[]`
  - `sentence_length_variance: number` (variance statistique)
  - `min_sentence_words`, `max_sentence_words`
- Ajouter dans `aggregateStyleMemory` :
  - `avg_sentence_variance`, signal "Vos posts ont une variance saine (>X)" ou "Phrases trop uniformes"
- Affiché dans `<StyleMemoryView>`

### V20.8 — Narrative-check enrichi (uniformity, transitions intra-post)
**Fichiers** : `lib/narrative-check.ts`

**Spec** : ajouter 4 nouveaux signaux :
1. `paragraph_uniformity` : si tous les paragraphes du post ont word_count à ±15 % d'écart
2. `transition_density` : si > 30 % des paragraphes commencent par "Donc · Alors · Ainsi · D'ailleurs · Par ailleurs · De plus · En outre"
3. `opening_repetition` : si 2+ paragraphes consécutifs commencent par le même mot
4. `contrasting_parallelism_overuse` : déjà couvert par `not_x_y` mais ajouter compteur > 2 dans le post

Chaque signal renvoyé dans `/api/memory-check` et affiché en footer éditeur (italique amber, non bloquant).

### V20.9 — Metaphorical vs literal (bigram-aware)
**Fichiers** : `lib/brand-config.ts` ou nouvelle `lib/metaphor-check.ts`

**Spec** :
- Pour chaque mot dans `[écosystème, paysage, tapisserie, symphonie, balise, naviguer]`, check le bigram :
  - "écosystème logiciel" → OK
  - "écosystème de la trésorerie" → flag
  - "naviguer sur le site" → OK
  - "naviguer dans la complexité" → flag
- Fonction `checkMetaphorMisuse(text): hits[]` exposée à `checkAntiPatterns`
- Severity : low (signal, pas bloquant)

### V20.10 — Markup hallucination zero-tolerance
**Fichiers** : `lib/anthropic.ts` (post-process), `app/api/generate-post/route.ts`

**Spec** :
- Après chaque génération Claude, scanner output pour `(oaicite|turn0search\d+|grok_card|contentReference|attributableIndex)`
- Si match → **rejet automatique**, regenerate une fois, sinon erreur explicite "Génération corrompue, réessayez"
- Log côté serveur (sans le texte exact, juste le pattern matché)

### V20.11 (bonus) — Pinned comment suggestion
**Fichiers** : `app/api/pinned-comment/route.ts` (nouveau), `app/posts/[id]/edit/client.tsx`

**Spec** :
- Après publication LinkedIn confirmée OU sauvegarde finale, bouton "Suggérer un commentaire à épingler"
- Génère 3 commentaires 1-2 lignes qui prolongent le post (référence externe, micro-précision, question ouverte mesurée)
- Pas d'auto-publication, juste copier-coller (garde-fou "Aucun publish LinkedIn auto")

### V20.12 (bonus) — Radar enrichi
**Fichiers** : `lib/radar.ts` (ou équivalent), `/suggestions` page

**Spec** :
- Pour chaque suggestion, ajouter champ `data_point` (1 chiffre vérifiable) et `contrarian_angle` (1 phrase qui retourne une croyance commune du secteur)
- Affiché en bas de chaque carte suggestion (italique, opacity 60)

---

## 5. Ordre d'exécution recommandé

**Lot A — Anti-slop & qualité** (impact immédiat sur tous les posts générés) :
1. V20.10 (markup hallucinations · sécurité)
2. V20.2 (anti-patterns FR enrichis · 8 nouveaux regex)
3. V20.7 (sentence variance dans style-memory)
4. V20.8 (narrative-check enrichi · 4 signaux)
5. V20.9 (metaphor bigram-aware)

**Lot B — Outils créatifs** (nouvelle valeur côté utilisateur) :
6. V20.4 (hook generator · UX visible)
7. V20.5 (framework selector)
8. V20.3 (post-scorer data-driven) ← dépend du score engagement dans `meta`
9. V20.6 (content-matrix)

**Lot C — Voix & polish** :
10. V20.1 (voice files exportables)
11. V20.11 (pinned comment · bonus)
12. V20.12 (Radar enrichi · bonus)

**Estimation** : 12 commits unitaires · 8-12 heures de travail · 3-4 push Vercel à valider en prod.

---

## 6. Tests de non-régression à prévoir

Avant chaque push V20.x :

- `npx tsc --noEmit` propre
- `node scripts/check-french-accents.mjs` propre
- `node scripts/test-narrative.mjs` propre (7/7 fixtures)
- **Nouveau** : `node scripts/test-anti-slop.mjs` (V20.2) — 10 fixtures de phrases AI-slop FR, 10/10 détectées
- `node scripts/smoke-content.mjs` propre en prod après Vercel READY
- Pour V20.3 (scorer) : 1 fixture post réel Cyril (>1000 likes) doit scorer ≥ 40/50

---

## 7. Ce qu'on ne fait PAS

- Pas de copie des skill files dans `.claude/skills/` du repo Cadence : Cadence n'est pas une Claude project, c'est une app Next.js — les patterns sont absorbés en code TS, pas en SKILL.md
- Pas d'Apify ni de scraping LinkedIn : V19.1 (ZIP import + curation) suffit, garde-fou data-cost
- Pas d'auto-publication post scoring : un score > 45/50 ne déclenche rien, l'utilisateur reste maître
- Pas de modification de `STATIC_VOICE` ou `STATIC_BANNED` côté tonalité — la voix Cadence (expert · simple · avisé · proximité · Yann Leonardi-inspired) reste intacte. On *ajoute* des interdictions, on n'altère pas la voix.

---

## 8. Décision à prendre par Cyril

1. **Confirmer Lot A en priorité** (anti-slop) ou commencer par Lot B (outils créatifs plus visibles) ?
2. **Skipper V20.11 et V20.12** (bonus) pour rester ciblé ?
3. **V20.3 (scorer) nécessite que les engagements soient parsés depuis le ZIP** — confirmer si le CSV Shares de l'export LinkedIn contient bien reactions/comments par post (sinon V20.3 est dégradé, fonctionne sans data perso, fallback Yann Leonardi benchmarks)

Une fois validé, j'exécute commit par commit, push, vérification prod, comme d'habitude.
