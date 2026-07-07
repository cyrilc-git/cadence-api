#!/usr/bin/env node
// V10.7 — Smoke content : vérifie que chaque route prod contient un marqueur
// HTML attendu. Détecte les régressions silencieuses (page 200 mais contenu
// cassé / squelette mal rendu / texte disparu).
//
// Usage : node scripts/smoke-content.mjs [BASE_URL]
// Default BASE_URL : https://cadence-api-ruddy.vercel.app
// Exit 0 si tout OK, 1 sinon.

const base = process.argv[2] || process.env.SMOKE_BASE || 'https://cadence-api-ruddy.vercel.app';

// V18 §fix — Markers mis à jour après V13/V14/V15/V17/V18 refontes UI.
// Chaque marker doit être un fragment STABLE de la page (titre h1,
// eyebrow, ou consigne caractéristique). Évite les éléments susceptibles
// de bouger à chaque polish.
// V58.7 — Markers alignés sur l'app réelle (5 onglets : Écrire, Calendrier,
// Sources, Mémoire). Les routes qui ne font que rediriger (/posts, /suggestions,
// /analytics, /brand-dna, /design-visuel, /inspirations, /settings) sont
// retirées : on ne smoke que de vraies pages, pour ne pas casser à chaque refonte.
const ROUTES = [
  { path: '/',                marker: 'Bonjour' },
  { path: '/calendar',        marker: 'Aucune publication sans validation' },
  { path: '/posts/new',       marker: 'Parlez à Cadence' },       // V57 composer conversationnel
  { path: '/sources',         marker: 'connexions' },
  { path: '/sources/notion',  marker: 'espace de travail' },
  { path: '/sources/linkedin',marker: 'historique', soft: true },
  { path: '/sources/style',   marker: 'style', soft: true },      // V58.5 brand kit visuel
  { path: '/cerveau',         marker: 'Mémoire éditoriale' },
  { path: '/api/insights',         marker: '"insights"', json: true },
  { path: '/api/content-items?limit=1', marker: '"count"', json: true },
];

let failed = 0;
let warned = 0;
const results = [];

for (const r of ROUTES) {
  const url = base + r.path;
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 12000);
    const res = await fetch(url, { signal: ctl.signal, headers: { 'user-agent': 'cadence-smoke/1.0' } });
    clearTimeout(to);
    const code = res.status;
    if (code >= 500) {
      failed++;
      results.push(`FAIL ${code} ${r.path}`);
      continue;
    }
    const txt = await res.text();
    const lower = txt.toLowerCase();
    const needle = r.marker.toLowerCase();
    const found = lower.includes(needle);
    if (!found) {
      if (r.soft) { warned++; results.push(`WARN ${code} ${r.path} : "${r.marker}" manquant`); }
      else { failed++; results.push(`FAIL ${code} ${r.path} : "${r.marker}" manquant`); }
    } else {
      results.push(`OK   ${code} ${r.path}`);
    }
  } catch (e) {
    failed++;
    results.push(`FAIL --- ${r.path} : ${e.message}`);
  }
}

for (const line of results) console.log(line);
console.log(`\n${results.length} routes, ${failed} échec${failed > 1 ? 's' : ''}, ${warned} avertissement${warned > 1 ? 's' : ''}.`);
process.exit(failed > 0 ? 1 : 0);
