// V55 Lot 5a — Rapatrie le CORPS COMPLET des brouillons Notion vers
// content_items.content (additif, aucune suppression). Pour chaque ligne
// cadence_generated / notion_draft ayant une page Notion mais un content vide,
// on lit le corps via l'endpoint deploye /api/notion/post/[id] (qui reutilise
// la logique Notion de l'app) puis on ecrit le texte nettoye en base.
//
// Objectif : zero perte de contenu, les 47 brouillons recuperes dans la couche
// canonique -> l'editeur pourra lire/ecrire sans Notion (lots suivants).
//
// Usage : node scripts/backfill-draft-content.mjs

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const PROD = process.env.CADENCE_URL || 'https://cadence-api-ruddy.vercel.app';

function loadEnv() {
  for (const f of ['.env.local', '.env', '.env.development.local']) {
    const p = path.join(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        let v = m[2].trim();
        if ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  }
}

function clean(s) {
  if (s == null) return '';
  let out = '';
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    if (c === 0) continue;
    if (c < 32 && c !== 9 && c !== 10 && c !== 13) continue;
    if (c >= 0xd800 && c <= 0xdfff) continue;
    if (c === 0xfffe || c === 0xffff) continue;
    out += ch;
  }
  return out;
}
// Meme heuristique que lib/content-ingest : deballe l'artefact guillemets LinkedIn/Notion.
function normalizeCommentary(text) {
  const s = String(text ?? '');
  if (!s) return s;
  const lines = s.split('\n');
  const nonEmpty = lines.filter(l => l.trim().length > 0);
  if (nonEmpty.length < 2) return s.replace(/^"/, '').replace(/"$/, '');
  const blankQuoted = lines.filter(l => { const t = l.trim(); return t === '""' || t === '"'; }).length;
  const edgeQuoted = nonEmpty.filter(l => { const t = l.trim(); return t.startsWith('"') || t.endsWith('"'); }).length;
  const looksArtifact = (edgeQuoted / nonEmpty.length) > 0.4 || blankQuoted > 0;
  if (!looksArtifact) return s;
  return lines
    .map(l => { const t = l.trim(); if (t === '""' || t === '"') return ''; return l.replace(/^(\s*)"/, '$1').replace(/"(\s*)$/, '$1'); })
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

(async () => {
  loadEnv();
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('SUPABASE creds manquantes'); process.exit(1); }
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: rows, error } = await sb
    .from('content_items')
    .select('id, notion_page_id, title, source_type, content')
    .in('source_type', ['cadence_generated', 'notion_draft'])
    .not('notion_page_id', 'is', null);
  if (error) { console.error(error.message); process.exit(1); }
  console.log(`${rows.length} brouillons Notion a verifier.`);

  let updated = 0, skipped = 0, empty = 0, errs = 0;
  const failures = [];
  for (const r of rows) {
    // On ne re-rapatrie pas ce qui a deja un corps consequent.
    if (r.content && r.content.trim().length > 40) { skipped++; continue; }
    try {
      const res = await fetch(`${PROD}/api/notion/post/${r.notion_page_id}`);
      if (!res.ok) { errs++; failures.push(`${r.notion_page_id}: HTTP ${res.status}`); await sleep(350); continue; }
      const j = await res.json();
      const body = clean(normalizeCommentary(j?.content || ''));
      if (!body || body.trim().length < 5) { empty++; await sleep(350); continue; }
      const { error: upErr } = await sb.from('content_items')
        .update({ content: body, excerpt: body.slice(0, 600), updated_at: new Date().toISOString() })
        .eq('id', r.id);
      if (upErr) { errs++; failures.push(`${r.id}: ${upErr.message}`); } else updated++;
    } catch (e) { errs++; failures.push(`${r.id}: ${e.message}`); }
    await sleep(350); // throttle Notion ~3 req/s
  }
  console.log(`Rapatries : ${updated} | deja remplis : ${skipped} | corps vide cote Notion : ${empty} | erreurs : ${errs}`);
  if (failures.length) failures.slice(0, 10).forEach(f => console.log('  ✗', f));
})().catch(e => { console.error('ERR', e.message); process.exit(1); });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
