// V54 — LinkedIn Member Data Portability (DMA) : synchro automatique.
//
// Permet a Cadence de rester a jour SANS scraping et SANS geste manuel : une
// fois que Cyril a consenti (scope r_dma_portability_self_serve, self-serve,
// reserve a l'EEE), LinkedIn archive ses publications et on les recupere :
//   - Snapshot : tout l'historique (backfill complet, alternative a l'export ZIP)
//   - Changelog : chaque nouveau post des le consentement (fenetre 28 jours)
//
// INERTE tant qu'aucun token DMA n'est stocke (design_system) : le cron no-op.
// Reconciliation : on passe par ingestLinkedInPosts -> meme source_id que le
// backfill disque, donc aucun doublon.
//
// CONFIRM (a valider contre la 1re reponse reelle, cf. guide de mise en place) :
//   [1] nom exact du domaine Snapshot pour les posts (DEFAULT 'MEMBER_SHARE_INFO')
//   [2] resourceName exact d'un post cree dans le Changelog (DEFAULT 'ugcPosts')
//   [3] chemin du texte du post dans processedActivity (on tente plusieurs cles)

import { supabase } from './supabase';
import { ingestLinkedInPosts, type IncomingPost } from './content-ingest';

const API = 'https://api.linkedin.com';
const VERSION = process.env.LINKEDIN_DMA_VERSION || '202312';
const SNAPSHOT_DOMAIN_POSTS = process.env.LINKEDIN_DMA_POSTS_DOMAIN || 'MEMBER_SHARE_INFO'; // CONFIRM [1]
const POST_RESOURCES = (process.env.LINKEDIN_DMA_POST_RESOURCES || 'ugcPosts,posts,shares')
  .split(',').map(s => s.trim().toLowerCase()); // CONFIRM [2]

// ── Stockage token + curseur dans design_system (KV deja en place) ───────────
async function kvGet(key: string): Promise<string | null> {
  try {
    const { data } = await supabase.from('design_system').select('value').eq('key', key).maybeSingle();
    return data?.value ?? null;
  } catch { return null; }
}
async function kvSet(key: string, value: string): Promise<void> {
  await supabase.from('design_system').upsert({ key, value }, { onConflict: 'key' });
}

export type DmaToken = { access_token: string; refresh_token?: string; expires_at?: string };
export async function getDmaToken(): Promise<DmaToken | null> {
  const raw = await kvGet('linkedin.dma_token');
  if (!raw) return null;
  try { const t = JSON.parse(raw); return t?.access_token ? t : null; } catch { return null; }
}
export async function setDmaToken(t: DmaToken): Promise<void> {
  await kvSet('linkedin.dma_token', JSON.stringify(t));
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Linkedin-Version': VERSION, 'Content-Type': 'application/json' };
}

// ── Active la generation des events changelog (idempotent) ───────────────────
export async function enableChangelog(token: string): Promise<boolean> {
  try {
    const r = await fetch(`${API}/rest/memberAuthorizations`, { method: 'POST', headers: authHeaders(token), body: '{}' });
    return r.ok;
  } catch { return false; }
}

// ── Extraction defensive du texte d'un post (formats UGC / Posts varies) ──────
function extractText(o: any): string | null {
  if (!o || typeof o !== 'object') return null;
  const paths = [
    o.commentary,
    o?.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text,
    o?.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary,
    o?.content?.content?.string,
    o?.text?.text,
    o?.text,
    o?.shareCommentary?.text,
  ];
  for (const p of paths) {
    if (typeof p === 'string' && p.trim().length > 0) return p;
  }
  return null;
}
function extractDate(o: any): string | null {
  const cands = [o?.createdAt, o?.created?.time, o?.firstPublishedAt, o?.lastModifiedAt];
  for (const c of cands) if (typeof c === 'number' && c > 0) return new Date(c).toISOString();
  return null;
}

// ── Snapshot : historique complet des posts ──────────────────────────────────
export async function fetchSnapshotPosts(token: string, maxPages = 40): Promise<{ posts: IncomingPost[]; pending: boolean }> {
  const out: IncomingPost[] = [];
  let pending = false;
  let url: string | null = `${API}/rest/memberSnapshotData?q=criteria&domain=${SNAPSHOT_DOMAIN_POSTS}`;
  let pages = 0;
  while (url && pages < maxPages) {
    pages++;
    const r: Response = await fetch(url, { headers: authHeaders(token) });
    if (!r.ok) {
      const body = await r.text();
      // 404 « No data found » = domaine valide mais pas encore collate par
      // LinkedIn (historique en cours de preparation) -> on signale "pending".
      if (r.status === 404 && /no data found/i.test(body)) { pending = true; break; }
      if (r.status === 404 || r.status === 400) break; // fin de pagination
      throw new Error(`snapshot ${r.status}: ${body.slice(0, 160)}`);
    }
    const j: any = await r.json();
    const el = (j.elements || [])[0];
    const data: any[] = (el && el.snapshotData) || [];
    for (const row of data) {
      // Les cles ressemblent aux colonnes du Shares.csv (ShareCommentary, Date, ShareLink).
      const text = pick(row, ['ShareCommentary', 'commentary', 'Commentary', 'text']);
      if (!text) continue;
      out.push({
        text,
        date: pick(row, ['Date', 'date', 'ShareDate', 'createdAt']),
        url: pick(row, ['ShareLink', 'shareLink', 'Link', 'url']),
        media: pick(row, ['MediaUrl', 'media']),
        visibility: pick(row, ['Visibility', 'visibility']),
      });
    }
    const next = (j.paging?.links || []).find((l: any) => l.rel === 'next');
    url = next ? `${API}/rest${next.href.replace(/^\/rest/, '')}` : null;
  }
  return { posts: out, pending: pending && out.length === 0 };
}
function pick(row: any, keys: string[]): string | null {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim() !== '') return String(row[k]);
    // tolerance casse
    const found = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase());
    if (found && row[found] != null && String(row[found]).trim() !== '') return String(row[found]);
  }
  return null;
}

// ── Changelog : nouveaux posts depuis le dernier curseur ─────────────────────
export async function fetchChangelogPosts(token: string, startTime?: number): Promise<{ posts: IncomingPost[]; latest: number | null }> {
  const posts: IncomingPost[] = [];
  let latest: number | null = null;
  const params = new URLSearchParams({ q: 'memberAndApplication', count: '50' });
  if (startTime) params.set('startTime', String(startTime));
  const r = await fetch(`${API}/rest/memberChangeLogs?${params.toString()}`, { headers: authHeaders(token) });
  if (!r.ok) throw new Error(`changelog ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const j: any = await r.json();
  for (const ev of (j.elements || [])) {
    if (typeof ev.processedAt === 'number') latest = Math.max(latest || 0, ev.processedAt);
    if ((ev.method || '').toUpperCase() !== 'CREATE') continue;
    if (!POST_RESOURCES.includes(String(ev.resourceName || '').toLowerCase())) continue;
    const body = ev.processedActivity || ev.activity || {};
    const text = extractText(body);
    if (!text) continue;
    posts.push({
      text,
      date: extractDate(body) || (typeof ev.capturedAt === 'number' ? new Date(ev.capturedAt).toISOString() : null),
      url: body.resourceUri || ev.resourceUri || null,
    });
  }
  return { posts, latest };
}

// ── Orchestration : appelee par le cron ──────────────────────────────────────
export async function syncDma(opts?: { snapshot?: boolean }): Promise<any> {
  const tok = await getDmaToken();
  if (!tok) return { skipped: 'no_dma_token' };
  await enableChangelog(tok.access_token);

  // Backfill historique via Snapshot. On (re)tente tant que l'historique n'a
  // pas ete recupere AVEC SUCCES (flag dma_snapshot_done), independamment du
  // curseur changelog — car LinkedIn peut mettre des heures a collater le
  // domaine MEMBER_SHARE_INFO apres le consentement. ?snapshot=1 force un essai.
  let snapshot: any = null;
  const cursorRaw = await kvGet('linkedin.dma_cursor');
  const snapshotDone = (await kvGet('linkedin.dma_snapshot_done')) === 'true';
  // V58.2 — Le Snapshot (archive complete des posts) est reconstruit cote
  // LinkedIn avec du retard : on le RE-joue periodiquement (>= 6 jours) pour
  // rattraper les posts publies HORS Cadence que le Changelog (fenetre 28j)
  // aurait manques. Idempotent (dedup par source_id), donc sans risque.
  const snapshotAt = Number((await kvGet('linkedin.dma_snapshot_at')) || 0);
  const snapshotStale = !snapshotAt || (Date.now() - snapshotAt) > 6 * 86_400_000;
  if (opts?.snapshot || !snapshotDone || snapshotStale) {
    try {
      const { posts, pending } = await fetchSnapshotPosts(tok.access_token);
      if (pending) {
        snapshot = { pending: true, note: 'LinkedIn prepare encore votre historique (domaine MEMBER_SHARE_INFO).' };
      } else {
        snapshot = await ingestLinkedInPosts(posts, { sourceType: 'linkedin_import_zip' });
        if (posts.length > 0) {
          await kvSet('linkedin.dma_snapshot_done', 'true');
          await kvSet('linkedin.dma_snapshot_at', String(Date.now()));
        }
      }
    } catch (e: any) { snapshot = { error: e.message }; }
  } else {
    snapshot = { skipped: 'fresh' };
  }

  // Changelog : nouveaux posts depuis le curseur.
  let changelog: any = null;
  try {
    const startTime = cursorRaw ? Number(cursorRaw) : Date.now() - 27 * 86_400_000;
    const { posts, latest } = await fetchChangelogPosts(tok.access_token, startTime);
    changelog = await ingestLinkedInPosts(posts, { sourceType: 'linkedin_published' });
    if (latest) await kvSet('linkedin.dma_cursor', String(latest));
  } catch (e: any) { changelog = { error: e.message }; }

  // Detection d'expiration : si un 401 a ete renvoye, le token est a renouveler.
  const tokenExpired = /\b401\b|invalid.?token|expired/i.test(JSON.stringify([snapshot, changelog]));
  return { ok: true, token_expired: tokenExpired, snapshot, changelog };
}

// ── Sonde de diagnostic : montre la FORME REELLE des reponses sans rien
// ingerer. Sert a confirmer les 3 CONFIRM (domaine Snapshot, resourceName
// Changelog, chemin du texte) des que le token est branche. ───────────────────
function redact(v: any, depth = 0): any {
  if (v == null) return v;
  if (typeof v === 'string') return v.length > 180 ? v.slice(0, 180) + `…[${v.length} car.]` : v;
  if (typeof v !== 'object' || depth > 4) return v;
  if (Array.isArray(v)) return v.slice(0, 3).map(x => redact(x, depth + 1));
  const o: any = {};
  for (const k of Object.keys(v).slice(0, 40)) o[k] = redact(v[k], depth + 1);
  return o;
}

export async function probeDma(domainOverride?: string): Promise<any> {
  const tok = await getDmaToken();
  if (!tok) return { error: 'no_dma_token' };
  const dom = domainOverride || SNAPSHOT_DOMAIN_POSTS;
  const out: any = { version: VERSION, snapshot_domain_tried: dom, post_resources_tried: POST_RESOURCES };

  // Liste TOUS les domaines Snapshot disponibles (sans filtre) : revele le vrai
  // nom du domaine des posts ET si l'historique est deja traite cote LinkedIn.
  try {
    const r = await fetch(`${API}/rest/memberSnapshotData?q=criteria`, { headers: authHeaders(tok.access_token) });
    out.alldomains_status = r.status;
    if (r.ok) {
      const j: any = await r.json();
      out.alldomains = (j.elements || []).map((e: any) => ({
        domain: e.snapshotDomain,
        rows: (e.snapshotData || []).length,
        sample_keys: e.snapshotData?.[0] ? Object.keys(e.snapshotData[0]).slice(0, 14) : null,
      }));
    } else out.alldomains_body = (await r.text()).slice(0, 220);
  } catch (e: any) { out.alldomains_err = e.message; }

  // Autorisation active ?
  try {
    const r = await fetch(`${API}/rest/memberAuthorizations?q=memberAndApplication`, { headers: authHeaders(tok.access_token) });
    out.authorized_status = r.status;
    if (r.ok) { const j: any = await r.json(); out.authorized = (j.elements || []).length > 0; }
    else out.authorized_body = (await r.text()).slice(0, 240);
  } catch (e: any) { out.authorized_err = e.message; }

  // Snapshot : cles reelles de la 1re ligne (pour CONFIRM [1]).
  try {
    const r = await fetch(`${API}/rest/memberSnapshotData?q=criteria&domain=${dom}`, { headers: authHeaders(tok.access_token) });
    out.snapshot_status = r.status;
    if (r.ok) {
      const j: any = await r.json();
      const el = (j.elements || [])[0];
      out.snapshot_returned_domain = el?.snapshotDomain;
      out.snapshot_total = j.paging?.total;
      out.snapshot_rows = (el?.snapshotData || []).length;
      out.snapshot_first_row_keys = el?.snapshotData?.[0] ? Object.keys(el.snapshotData[0]) : null;
      out.snapshot_first_row = redact(el?.snapshotData?.[0] ?? null);
    } else out.snapshot_body = (await r.text()).slice(0, 300);
  } catch (e: any) { out.snapshot_err = e.message; }

  // Changelog : resourceNames presents + 1er event CREATE (pour CONFIRM [2][3]).
  try {
    const r = await fetch(`${API}/rest/memberChangeLogs?q=memberAndApplication&count=20`, { headers: authHeaders(tok.access_token) });
    out.changelog_status = r.status;
    if (r.ok) {
      const j: any = await r.json();
      const evs: any[] = j.elements || [];
      out.changelog_count = evs.length;
      out.changelog_resourceNames = [...new Set(evs.map(e => `${e.method}:${e.resourceName}`))].slice(0, 20);
      const created = evs.find(e => (e.method || '').toUpperCase() === 'CREATE');
      out.changelog_first_create = created
        ? { resourceName: created.resourceName, processedActivity: redact(created.processedActivity || created.activity) }
        : null;
    } else out.changelog_body = (await r.text()).slice(0, 300);
  } catch (e: any) { out.changelog_err = e.message; }

  return out;
}

// Statut riche pour l'UI (connecte ? curseur ? expiration ?).
export async function getDmaStatus(): Promise<{ connected: boolean; cursor: string | null; expires_at: string | null; snapshot_done: boolean }> {
  const tok = await getDmaToken();
  const cursor = await kvGet('linkedin.dma_cursor');
  const snapshot_done = (await kvGet('linkedin.dma_snapshot_done')) === 'true';
  return { connected: !!tok, cursor, expires_at: tok?.expires_at ?? null, snapshot_done };
}
