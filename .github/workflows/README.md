# CI Cadence

Workflows actifs dans `.github/workflows/`.

## qa.yml

Sur chaque push et PR vers `main` :
- `npm ci` install
- `npx tsc --noEmit` typecheck
- `npm run build` Next build avec env vars factices
- `node scripts/scan-mojibake.mjs` scan UTF-8
- Vérification des fichiers critiques (`app/page.tsx`, `components/CadenceEditor.tsx`, etc.)

## smoke.yml

Toutes les 6h et sur trigger manuel. Ping les routes prod :
- Pages : `/`, `/calendar`, `/posts`, `/posts/new`, `/suggestions`, `/sources`, `/sources/notion`, `/sources/linkedin`, `/cerveau`, `/analytics`, `/brand-dna`, `/design-visuel`, `/inspirations`, `/settings`
- API : `/api/health`, `/api/insights`, `/api/content-items?limit=1`

Codes acceptés : 200, 3xx, 401, 403, 404. Fail si 5xx ou pas de réponse.

## V10.1+ — Pistes futures

- **Playwright headless** : screenshots de référence par page, comparaison entre déploiements. Nécessite l'install des binaires Chromium dans le runner (`npx playwright install --with-deps chromium`, ~3 min). À ajouter quand on aura besoin d'un vrai diff visuel.
- **Lighthouse CI** : audit perf + a11y sur les routes clés.
- **Console errors check** : extension Playwright qui collecte `console.error` à chaque navigation.

Aucun de ces workflows n'est strictement nécessaire pour la V10 ; ils restent à arbitrer selon le besoin produit.
