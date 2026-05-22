#!/usr/bin/env node
// V10.7 — Smoke content : vérifie que chaque route prod contient un marqueur
// HTML attendu. Détecte les régressions silencieuses (page 200 mais contenu
// cassé / squelette mal rendu / texte disparu).
//
// Usage : node scripts/smoke-content.mjs [BASE_URL]
// Default BASE_URL : https://cadence-api-ruddy.vercel.app
// Exit 0 si tout OK, 1 sinon.

const base = process.argv[2] || process.env.SMOKE_BASE || 'https://cadence-api-ruddy.vercel.app';

const ROUTES = [
  { path: '/',                marker: 'Bonjour' },
  { path: '/calendar',        marker: 'Cron publie' },
  { path: '/posts',           marker: 'Bibliothèque' },
  { path: '/posts/new',       marker: 'Brouillon' },
  { path: '/suggestions',     marker: 'Radar' },
  { path: '/sources',         marker: 'connexions' },
  { path: '/sources/notion',  marker: 'espace de travail' },
  { path: '/sources/linkedin',marker: 'source de vérité' },
  { path: '/cerveau',         marker: 'Mémoire éditoriale' },
  { path: '/analytics',       marker: 'Fiabilité' },
  { path: '/brand-dna',       marker: 'editorial', soft: true },
  { path: '/design-visuel',   marker: 'Design',    soft: true },
  { path: '/inspirations',    marker: 'inspir',    soft: true },
  { path: '/settings',        marker: 'param',     soft: true },
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
