# Cadence — LinkedIn publishing

App perso de Cyril Coulange pour préparer, valider et publier ses posts LinkedIn depuis une seule UI, branchée à Notion (drafts) + Supabase (token storage + logs) + Anthropic (génération texte) + OpenAI (illustrations DALL-E) + LinkedIn UGC API.

## Stack
- Next.js 14 (App Router, RSC)
- Tailwind CSS
- Supabase (Postgres + Storage)
- Anthropic SDK (Claude Sonnet 4.6)
- LinkedIn OAuth 2.0 + UGC Posts API
- Notion API v2022-06-28

## Routes UI
- `/`             Dashboard (statuts LinkedIn / Notion, KPIs, prochains posts)
- `/posts`        Liste des posts (drafts / programmés / publiés)
- `/posts/new`    Création de post (brief → 3 propositions IA → édition → programmation/publi)
- `/calendar`     Vue calendrier 4 semaines
- `/brand-dna`    Voix, piliers, anti-patterns IA
- `/inspirations` Comptes LinkedIn de référence
- `/analytics`    KPIs publiés + logs Supabase
- `/settings`     Diagnostic connexions et env vars

## Routes API
- `GET  /api/auth/linkedin`     OAuth init
- `GET  /api/auth/callback`     OAuth callback
- `GET  /api/auth/status`       JSON status LinkedIn
- `GET  /api/notion/status`     JSON status Notion
- `GET  /api/notion/posts`      Liste des posts
- `POST /api/notion/posts`      Create / update draft
- `GET/PATCH /api/notion/post/[id]`  CRUD un post
- `POST /api/generate-post`     3 propositions Claude
- `POST /api/generate-visual`   Mode `claude-design` (SVG) ou `openai` (DALL-E PNG)
- `POST /api/publish`           Publi explicite (UI ou X-Cockpit-Secret)
- `POST /api/publish-due`       Publi tous les drafts dus (bouton manuel UI)
- `GET  /api/cron-publish`      Cron Vercel quotidien 5h30 UTC
- `GET  /api/scrape-analytics`  Cron Vercel quotidien 22h UTC (placeholder V5.2)

## Sécurité
- Aucune publication LinkedIn sans `confirmed=true` côté UI ou Bearer secret côté cron.
- Tous les secrets vivent dans Vercel env vars (encrypted), jamais dans le code.
- Aucune variable client `NEXT_PUBLIC_*` ne contient de secret.

## Dev
```
npm install
npm run dev
```
