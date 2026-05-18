# CADENCE — instructions pour Claude Code

Ce fichier est lu automatiquement par Claude Code à chaque session. Il contient l'état, les conventions et les garde-fous du projet.

---

## 1. Mission

Cadence est un **OS éditorial AI-native pour LinkedIn**. Pas un outil social media — un assistant éditorial intelligent, calme, anticipateur, premium. Inspirations : Linear, Arc, Granola, Notion Calendar, Raycast, Perplexity, Superhuman, Apple éditorial.

Sensation à viser : **« Cadence sait quoi faire »**, jamais « Cadence me demande quoi faire ».

## 2. État actuel (V9.1.1)

- Score estimé : ~97.5 % premium UX.
- 130+ commits depuis V7.7. Versions clés : V8.3 (refonte UX), V8.6 (CadenceEditor unifié), V8.9 (streaming SSE + radar intelligent), V9.0 (Cadence anticipe), V9.1 (import LinkedIn premium + calendrier vivant + analytics humains++), V9.1.1 (anti-patterns IA étendus).
- Prod : https://cadence-api-ruddy.vercel.app
- Repo : https://github.com/cyrilc-git/cadence-api (public)
- Vercel project ID : `prj_NzzzZT7X9LBtVBLwttNjrDw2Mx5B` · team : `team_F89GJ8tofAlmqYucO3HV8Lsh`
- Supabase project : `hzbsvnubmnqsbsgcblfv`

## 3. Stack

- **Next.js 14.2.5** App Router · TypeScript strict
- **Supabase Postgres** (pgvector 0.8.0, HNSW)
- **Notion API** v2022-06-28 (UGC Posts database = source de vérité des posts)
- **LinkedIn UGC Posts API** (publication, mentions via attributes)
- **Anthropic Claude Sonnet 4.6** (texte + Vision pour moodboard tagging + SVG visual gen)
- **OpenAI text-embedding-3-small** (1536 dims, embeddings éditoriaux)
- **DALL-E 3** (fallback illustrations)
- **JSZip 3.10** (parse client-side de l'archive LinkedIn ZIP)
- **Tailwind** 3.4 · pas de UI framework
- Hébergement : Vercel (région iad1)

## 4. Architecture clé

```
app/
  page.tsx                          Dashboard assistant (5 blocs max : insight + NBA + week + état)
  layout.tsx                        LayoutShell wrapper
  posts/
    page.tsx                        Bibliothèque
    new/                            Éditeur silencieux (Notion/Granola feel)
    [id]/edit/                      Éditeur d'un draft existant
  calendar/                         Vue semaine par défaut, heatmap perf
  suggestions/                      Radar (Top 3 + voir plus)
  analytics/                        Prose-driven, 7 patterns détectés
  design-visuel/                    Studio créatif (moodboard masonry + tags Vision)
  sources/                          Liste sobre divide-y, /sources/linkedin = import ZIP
  brand-dna/                        Ligne éditoriale (piliers, anti-patterns, audiences)
  settings/                         Credentials chiffrés AES-256-GCM
  api/
    chat/route.ts                   Non-stream fallback
    chat/stream/route.ts            SSE avec chunking word-boundary + pause 60ms phrase
    generate-post/                  3 propositions Claude
    generate-week/                  Pipeline intelligent (lit embeddings + planNextWeek)
    generate-visual/                Claude SVG + DALL-E 3
    embeddings/index/               Indexe posts Notion en pgvector
    insights/                       Insights radar pour CadenceObserved
    mentions/search + suggest       Cache linkedin_entities + suggestions IA
    design-visuel/moodboard         Upload + Claude Vision tagging async
    notion/post/[id]/move           PATCH date + heure uniquement
    sources/linkedin/import         Import batch posts depuis archive
    publish-due / cron-publish      Cron Vercel quotidien

components/
  CadenceEditor.tsx                 Composant unique : MentionTextarea + SlashMenu + Bubble + streaming
  CadenceObserved.tsx               Bloc "Cadence a remarqué…" dashboard
  CommandPalette.tsx                ⌘K Linear/Raycast
  LayoutShell.tsx                   Switch sidebar compact sur écrans d'écriture
  LinkedInPreview.tsx               Preview LinkedIn light/dark/mobile
  MentionTextarea.tsx               Textarea avec dropdown @
  MentionSuggestions.tsx            Chip discret suggérant tags
  MoveMenu.tsx                      "Déplacer vers…" sur cards calendar
  OnboardingHint.tsx                1 banner contextuel calme
  PreviewDrawer.tsx                 Drawer ⌘P (bottom sheet mobile)
  SlashMenu.tsx                     / commands avec 14 commandes
  Sidebar.tsx                       3 sections, mode compact via prop

lib/
  anthropic.ts                      Claude SDK + tagMoodboardImage Vision
  brand-config.ts                   ANTI_PATTERNS + PILIERS + VOIX
  embeddings.ts                     OpenAI embeddings + semantic search
  radar.ts                          Radar Notion/GitHub/heuristic + enrichSuggestionsWithNovelty
  radar-insights.ts                 pilierStats + trackedTopicStatus + computeRadarInsights
  weekly-intelligent.ts             planNextWeek() — vrai cerveau hebdo
  analytics-insights.ts             7 patterns humains (longueur, pilier×imp, pilier×eng, weekday, hook, cadence, créneau)
  mentions.ts                       parseMentions / insertMentionAtCaret / toLinkedInPayload UGC
  notion.ts                         CRUD Notion + listNotionPosts + replacePageContent
  linkedin.ts                       OAuth + publish UGC avec mentions attributes
  credentials.ts                    Chiffrement AES-256-GCM
  db.ts                             Supabase helpers + designSystemPromptBlock
  weekly.ts                         Fallback non-intelligent (legacy)
```

## 5. Garde-fous absolus (jamais déroger)

- **Aucun publish LinkedIn auto**. Cron skip systématique `validated:false`.
- **Aucun secret jamais en logs**. PAT GitHub redigé dans les shell commands : `sed 's/x-access-token:[^@]*@/[redacted]@/g'`.
- **UTF-8 propre partout**. Pas de mojibake (Ã©, â€™, etc.). Scan avant chaque push.
- **Pushs atomiques** : 1 commit = 1 sujet. Convention `feat(vX.Y §Z): description courte`.
- **Anti-patterns IA bloqués** (cf. `lib/brand-config.ts` ANTI_PATTERNS) :
  - critical : `—`, `Ce n'est pas X, c'est Y`
  - high : mots creux (impactant, insight, game-changer, seamless, robust, delve, etc.), formules signature (`Résultat :`, `Pas parce que…`, `Et c'est là que…`), tutoiement, emoji burst > 3
  - medium : staccato 3+ phrases ≤ 5 mots, 1 emoji
- **Voix Cadence** : vouvoiement, founder voice (pas DAF), phrases aérées, exemples chiffrés, cas anonymisés.
- **Build pré-push** : `npx tsc --noEmit` puis `npm run build`. Si TS error, fixer avant push.

## 6. Conventions code

- **Langue** : UI 100% français, commentaires de code en français, code en anglais.
- **Layout** : `max-w-3xl mx-auto` sur les pages contenu (dashboard, sources, analytics, design-visuel). `max-w-2xl` sur l'éditeur. Header 12px sobre, espace blanc dominant.
- **Typography** : Inter pour chrome système, `font-editorial` (serif Charter/Iowan/Georgia) pour la zone d'écriture.
- **Touch targets** : 40px min sur mobile (`w-10 h-10 sm:w-8 sm:h-8`), safe-area-inset top/bottom respectés.
- **Bottom sheets sur mobile** : PreviewDrawer, SlashMenu, MentionTextarea — tous bascule en `fixed bottom-0 max-h-[X]vh animate-slide-up` sous 640px.
- **Pas de gradient violet→bleu** ni bounce easing ni nested cards ni icon-tiles décoratives.
- **1 action héroïque par écran** max. Le reste : slash, ⌘K, menu contextuel, hover, sélection toolbar.
- **Streaming partout où pertinent**. Optimistic UI partout (drag, save, etc.).

## 7. Workflow CI/CD

- Push `main` → Vercel build auto → alias `cadence-api-ruddy.vercel.app` mis à jour.
- Build typique : 50s. Si > 90s ou ERROR, regarder les logs via `mcp__vercel__get_deployment_build_logs`.
- Pas de tests automatisés actifs aujourd'hui. Workflows QA dressés dans `_github-workflows-to-install/` (à activer manuellement — le PAT actuel n'a pas le scope `workflow`).
- Cron Vercel : `/api/cron-publish` quotidien à 07:30. Skip posts non-`validated`.

## 7bis. Quick start (après clone)

```bash
git clone https://github.com/cyrilc-git/cadence-api.git
cd cadence-api
./scripts/setup.sh        # crée .env.local, installe deps, typecheck
# édite .env.local (6 vars depuis Vercel)
npm run dev               # http://localhost:3000
```

Pour activer les CI GitHub Actions une fois ton PAT régénéré avec scope `workflow` :
```bash
./scripts/activate-workflows.sh
```

## 8. Variables d'environnement (à mettre dans `.env.local`)

Voir `.env.example` à la racine — il contient tous les noms exacts utilisés par le code et les indications. Synthèse :

**Obligatoires** : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `MASTER_ENCRYPTION_KEY` (≥ 32 chars, doit matcher la prod), `NOTION_API_TOKEN`, `NOTION_LINKEDIN_DS_ID`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI`, `CRON_SECRET`, `COCKPIT_SECRET`.

**Optionnelles** : `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` (sinon lues depuis DB chiffrée via MASTER_ENCRYPTION_KEY). `GITHUB_TOKEN` + `GITHUB_REPOS` pour le Radar.

## 9. Comment ajouter une feature

1. Lire le brief et discuter avant d'écrire du code si ambigu.
2. Identifier les fichiers concernés via `Grep` / `Glob`. Lire les fichiers AVANT d'éditer.
3. Coder en atomique — une chose à la fois.
4. Vérifier UTF-8 (`grep -Pn "Ã©|â€™|Ã¨"` sur les fichiers modifiés).
5. `npx tsc --noEmit` localement.
6. Commit avec convention `feat(vX.Y §Z): ...`.
7. Push, attendre Vercel READY, vérifier en prod.
8. Si build error, lire les logs Vercel et fixer immédiatement.

## 10. Anti-patterns produit (ne JAMAIS faire)

- Ajouter une feature qui n'améliore pas la sensation produit.
- Ajouter du chrome (sticky bar, card, panel) là où l'écriture suffit.
- Multiplier les CTA (max 1 primaire par écran).
- Afficher des IDs/URN/hashes en clair.
- Mettre du scores 80/100 partout (variance réelle ou rien).
- Empty states muets ("0 brouillon" sans CTA).
- Décorer avec icon-tiles 40px gradient.
- Mettre des labels techniques ("rich_text", "drafts.id").
- Ajouter un emoji "✨" partout.
- Demander à l'utilisateur quoi faire alors que Cadence pourrait anticiper.

## 11. Roadmap V9.2+ (priorités déclarées)

- **Figma API** réelle : si PAT user fourni, extraction palette/typo/composants.
- **Mémoire vivante visible** : page "Cerveau" qui montre `N posts indexés, dernière analyse, X piliers couverts`.
- **@dnd-kit/core** pour drag/drop calendar mobile (HTML5 D&D ne marche pas touch).
- **Cron weekly auto** qui appelle `planNextWeek()` dimanche soir → DM Slack/email avec "Voici votre semaine".
- **Audit mobile sur device réel** (clavier iOS, scroll fluidity).
- **CI GitHub Actions** : activer les workflows dans `_github-workflows-to-install/`.
- **Streaming visible mentions** : preview LinkedIn rendu en live pendant le tape.
- **Multi-utilisateur** : Heelio Studio, Mova, Therapilot ont chacun leur propre compte.

## 12. Vocabulaire Cadence (ne pas confondre)

- **Pilier** : axe éditorial (Lundi/Cas client, Mardi/Pédagogie, etc.). Stocké comme `pilier` sur chaque post.
- **Brief** : texte court qui décrit ce que l'utilisateur veut dire. `/api/generate-post` le transforme en 3 propositions.
- **Validation** : checkbox "Validé pour cron" qui autorise le cron à publier. Sans elle, jamais d'auto-publish.
- **Recyclable** : post publié > 6 mois, candidat à un re-post sous autre angle.
- **Saturation** : combien de posts récents (60j) ressemblent sémantiquement (cosine > 0.75) au sujet courant.
- **Novelty** : 1 - max similarity to recent posts. Plus c'est haut, plus le sujet est inédit.
- **Cadence_source** : `cadence` (créé par l'app) vs `linkedin_archive` (importé) vs `null` (créé directement dans Notion).

---

**Quand tu commences une session, lis ce fichier en entier avant de toucher au code. Ne brise pas les conventions. Pas de feature drift.**
