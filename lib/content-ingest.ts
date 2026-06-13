// V54 — Ingestion partagee de posts LinkedIn vers content_items.
//
// Point d'entree unique pour ecrire des posts (texte integral) dans la couche
// canonique. Utilise par :
//   - le backfill ponctuel depuis l'export disque (scripts/backfill-*.mjs replique
//     cette logique car un .mjs ne peut pas importer ce module TS),
//   - le cron DMA (lib/linkedin-dma.ts) une fois le consentement donne.
//
// source_id = hash stable (date + debut du texte). Identique entre backfill et
// DMA -> une meme publication n'est jamais dupliquee (upsert sur la cle).

import crypto from 'node:crypto';
import { supabase } from './supabase';

export type IncomingPost = {
  date?: string | null;   // 'YYYY-MM-DD HH:mm:ss' ou ISO ou epoch ms (string)
  text: string;           // texte integral du post
  url?: string | null;    // lien LinkedIn (ShareLink)
  media?: string | null;
  visibility?: string | null;
};

// Postgres refuse le NUL et les surrogates isoles ; on nettoie via une boucle
// (aucun caractere de controle ecrit en dur dans la source).
function clean(s: string | null | undefined): string {
  if (s == null) return '';
  let out = '';
  for (const ch of String(s)) {
    const c = ch.codePointAt(0)!;
    if (c === 0) continue;
    if (c < 32 && c !== 9 && c !== 10 && c !== 13) continue;
    if (c >= 0xd800 && c <= 0xdfff) continue; // surrogate isole -> casse le JSON
    if (c === 0xfffe || c === 0xffff) continue;
    out += ch;
  }
  return out;
}
function norm(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
export function postSourceId(date: string | null | undefined, text: string): string {
  const d = (date || '').slice(0, 10);
  const k = norm((text || '').split('\n')[0]).slice(0, 80);
  return 'li:' + crypto.createHash('sha256').update(d + '|' + k, 'utf8').digest('hex').slice(0, 24);
}
function safeLinkedinUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(String(raw).trim());
    if (u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase();
    if (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) return null;
    return u.toString();
  } catch { return null; }
}
function extractUrn(url: string | null): string | null {
  if (!url) return null;
  const m = decodeURIComponent(url).match(/urn:li:(activity|ugcPost|share):(\d+)/);
  return m ? `urn:li:${m[1]}:${m[2]}` : null;
}
function toIso(date: string | null | undefined): string | null {
  if (!date) return null;
  const raw = String(date).trim();
  if (/^\d{10,}$/.test(raw)) { const d = new Date(Number(raw)); return isNaN(d.getTime()) ? null : d.toISOString(); }
  let d = new Date(raw);
  if (isNaN(d.getTime())) d = new Date(raw.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) d = new Date(raw.slice(0, 10) + 'T09:00:00Z');
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export type IngestResult = { received: number; upserted: number; errors: number };

export async function ingestLinkedInPosts(
  posts: IncomingPost[],
  opts?: { sourceType?: 'linkedin_published' | 'linkedin_import_zip'; recompute?: boolean },
): Promise<IngestResult> {
  const sourceType = opts?.sourceType ?? 'linkedin_published';
  const now = new Date().toISOString();
  const seen = new Set<string>();
  const rows: any[] = [];

  for (const p of posts) {
    const text = clean(p.text);
    if (!text || text.trim().length === 0) continue;
    const sid = postSourceId(p.date, p.text);
    if (seen.has(sid)) continue;
    seen.add(sid);
    const liUrl = safeLinkedinUrl(p.url);
    const firstLine = text.split('\n')[0].trim() || 'Post LinkedIn';
    const isoDate = toIso(p.date);
    rows.push({
      source_type: sourceType,
      confidence: 'confirmed',
      canonical_source: 'linkedin',
      source_id: sid,
      notion_page_id: null,
      linkedin_urn: extractUrn(liUrl),
      linkedin_url: liUrl,
      canonical_url: liUrl,
      title: clean(firstLine.slice(0, 280)),   // clean APRES slice (surrogates)
      excerpt: clean(text.slice(0, 600)),
      content: text,
      pilier: null,
      published_at: isoDate,
      scheduled_at: isoDate,
      validation_status: null,
      sync_status: 'synced',
      embeddings_state: 'absent',
      analytics_state: 'absent',
      meta: { source: 'linkedin_dma', media_url: clean(p.media) || null, visibility: clean(p.visibility) || null },
      last_synced_at: now,
      updated_at: now,
      indexed_at: now,
    });
  }

  let upserted = 0, errors = 0;
  for (const r of rows) {
    let okRow = false;
    for (let attempt = 0; attempt < 4 && !okRow; attempt++) {
      const { error } = await supabase.from('content_items').upsert(r, { onConflict: 'source_type,source_id' });
      if (!error) okRow = true;
      else await new Promise(res => setTimeout(res, 500 + attempt * 500));
    }
    if (okRow) upserted++; else errors++;
  }

  // Recompute de la voix en fire-and-forget si on a ingere du nouveau.
  if (opts?.recompute !== false && upserted > 0) {
    import('./style-memory').then(m => m.recomputeStyleMemory()).catch(() => { /* silent */ });
  }

  return { received: posts.length, upserted, errors };
}
