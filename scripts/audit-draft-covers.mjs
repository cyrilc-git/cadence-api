// Audit (lecture seule) des couvertures Notion des brouillons : combien en ont
// une, et de quel type (permanente vs expiree). Aucune ecriture.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) { let v = m[2].trim(); if ((v[0]==='"'&&v.endsWith('"'))||(v[0]==="'"&&v.endsWith("'"))) v=v.slice(1,-1); process.env[m[1]]=v; }
    }
  }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
function bucket(url) {
  if (!url) return 'aucune';
  const u = url.toLowerCase();
  if (u.includes('supabase')) return 'supabase (permanent)';
  if (u.includes('licdn')) return 'licdn (LinkedIn, expire)';
  if (u.includes('oaidalle') || u.includes('blob.core') || u.includes('dalle')) return 'dalle (expire)';
  if (u.includes('notion') || u.includes('amazonaws') || u.includes('prod-files')) return 'notion-file (expire ~1h)';
  return 'autre';
}

(async () => {
  loadEnv();
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const tok = process.env.NOTION_API_TOKEN || process.env.NOTION_TOKEN;
  if (!tok) { console.error('NOTION_API_TOKEN manquant'); process.exit(1); }

  const { data: rows } = await sb.from('content_items')
    .select('id, notion_page_id, source_type')
    .in('source_type', ['cadence_generated', 'notion_draft'])
    .not('notion_page_id', 'is', null);

  const counts = {};
  let cadenceWithCover = 0, errs = 0;
  for (const r of rows) {
    try {
      const res = await fetch(`https://api.notion.com/v1/pages/${r.notion_page_id}`, {
        headers: { Authorization: `Bearer ${tok}`, 'Notion-Version': '2022-06-28' },
      });
      if (!res.ok) { errs++; await sleep(330); continue; }
      const page = await res.json();
      const url = page?.cover?.external?.url || page?.cover?.file?.url || null;
      const b = bucket(url);
      counts[b] = (counts[b] || 0) + 1;
      if (url && r.source_type === 'cadence_generated') cadenceWithCover++;
    } catch { errs++; }
    await sleep(330);
  }
  console.log(`Brouillons examines : ${rows.length} | erreurs : ${errs}`);
  console.log('Repartition des couvertures :');
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${k} : ${v}`);
  console.log(`Brouillons cadence_generated AVEC une couverture : ${cadenceWithCover}`);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
