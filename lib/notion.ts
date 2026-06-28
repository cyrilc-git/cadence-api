import { getCredential } from './credentials';
import { getValidations, logNotionAction, markCadenceDraft, getCadenceDraftSources } from './db';
import { getPostCovers, type PostCover } from './visual-memory';
import { supabase } from './supabase';
const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

async function headersAsync(): Promise<Record<string,string>> {
  const { value } = await getCredential('notion');
  if (!value) throw new Error('NOTION_API_TOKEN introuvable.');
  return {
    Authorization: `Bearer ${value}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json'
  };
}
// Backwards-compat sync version using env (deprecated, only used by code that hasn't been migrated)
const headers = () => ({
  Authorization: `Bearer ${process.env.NOTION_API_TOKEN!}`,
  'Notion-Version': NOTION_VERSION,
  'Content-Type': 'application/json'
});

// V58 — Interrupteur de déconnexion Notion. Quand `notion.disconnected` = true
// dans design_system, Cadence ignore TOTALEMENT Notion (lecture, écriture,
// export, statut), même si un token traîne encore en variable d'environnement.
// Réversible : recoller un token via /sources/notion remet le flag à false.
let _notionDiscCache: { v: boolean; t: number } | null = null;
export async function isNotionDisconnected(): Promise<boolean> {
  if (_notionDiscCache && Date.now() - _notionDiscCache.t < 5000) return _notionDiscCache.v;
  try {
    const { data } = await supabase.from('design_system').select('value').eq('key', 'notion.disconnected').maybeSingle();
    const v = String(data?.value || '').toLowerCase().trim();
    const disc = v === 'true' || v === '1' || v === 'on' || v === 'yes';
    _notionDiscCache = { v: disc, t: Date.now() };
    return disc;
  } catch { return false; }
}

export type NotionDraft = {
  id: string;
  content: string;
  pilier?: string;
  anonymisation_ok?: boolean;
  scheduled_at: string;
};

export type NotionPostSummary = {
  id: string;
  title: string;
  excerpt: string;
  pilier?: string;
  axe?: string;
  status: 'draft' | 'scheduled' | 'published' | 'error';
  scheduled_at: string | null;
  scheduled_time?: string | null;
  notion_url: string;
  linkedin_url?: string;
  visuel_pret?: boolean;
  anonymisation_ok?: boolean;
  validated?: boolean;
  late?: boolean;
  cadence_source?: string | null;
  cover_url?: string | null;
  cover_source?: 'notion' | 'cadence' | null;
  visual_format?: string | null;
  is_carousel?: boolean;
  impressions?: number;
  likes?: number;
  comments?: number;
  reposts?: number;
};

function plain(rich: any[] | undefined): string {
  if (!rich) return '';
  return rich.map((r: any) => r.plain_text || '').join('');
}

async function getDsIdAsync(): Promise<string> {
  const { value } = await getCredential('notion_ds_id');
  if (!value) throw new Error('NOTION_LINKEDIN_DS_ID introuvable.');
  return value;
}
function getDsId(): string {
  const id = process.env.NOTION_LINKEDIN_DS_ID;
  if (!id) throw new Error('NOTION_LINKEDIN_DS_ID env var manquante');
  return id;
}

// === Status ping ===
export async function notionStatus() {
  if (await isNotionDisconnected()) return { ok: false, error: 'Notion déconnecté de Cadence.' };
  const tok = await getCredential('notion');
  if (!tok.value) return { ok: false, error: 'NOTION_API_TOKEN introuvable (ni DB ni env).' };
  const ds = await getCredential('notion_ds_id');
  if (!ds.value) return { ok: false, error: 'NOTION_LINKEDIN_DS_ID introuvable.' };
  try {
    const r = await fetch(`${NOTION_API}/databases/${ds.value}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok.value}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
      body: JSON.stringify({ page_size: 1 })
    });
    if (!r.ok) {
      const txt = await r.text();
      return { ok: false, error: `Notion ${r.status}: ${txt.slice(0, 200)}` };
    }
    const data = await r.json();
    return { ok: true, count_sample: data.results?.length ?? 0 };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// === List posts (paginated) ===
export async function listNotionPosts(limit = 50): Promise<NotionPostSummary[]> {
  if (await isNotionDisconnected()) return [];
  const r = await fetch(`${NOTION_API}/databases/${getDsId()}/query`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      sorts: [{ property: 'Date de publication', direction: 'descending' }],
      page_size: limit
    })
  });
  if (!r.ok) throw new Error(`Notion list failed: ${r.status} ${await r.text()}`);
  const json = await r.json();

  const posts: NotionPostSummary[] = (json.results || []).map((page: any): NotionPostSummary => {
    const props = page.properties || {};
    const tagName = props['Tags']?.select?.name as string | undefined;
    const url = props['URL']?.url as string | undefined;
    const dateProp = props['Date de publication']?.date?.start as string | undefined;
    const heure = plain(props['Heure de publication']?.rich_text);
    let scheduled_at: string | null = null;
    if (dateProp) {
      const [hh, mm] = (heure || '07:30').split(':').map((x: string) => parseInt(x, 10) || 0);
      const d = new Date(dateProp + 'T00:00:00');
      d.setHours(hh, mm, 0, 0);
      scheduled_at = d.toISOString();
    }

    let status: NotionPostSummary['status'] = 'draft';
    if (tagName === 'Publié') status = 'published';
    else if (dateProp) status = 'scheduled';

    return {
      id: page.id,
      title: plain(props['Name']?.title) || 'Sans titre',
      excerpt: '',
      pilier: props['Pilier']?.select?.name,
      axe: props['Axe']?.select?.name,
      status,
      scheduled_at,
      scheduled_time: heure || null,
      notion_url: page.url,
      linkedin_url: url,
      visuel_pret: !!props['Visuel prêt']?.checkbox,
      anonymisation_ok: !!props['Anonymisation OK']?.checkbox,
      cover_url: page.cover?.external?.url || page.cover?.file?.url || null,
      cover_source: (page.cover?.external?.url || page.cover?.file?.url) ? 'notion' : null,
      impressions: props["Nombre d'impressions"]?.number ?? undefined,
      likes:       props['Nombre de likes']?.number ?? undefined,
      comments:    props['Nombre de commentaires']?.number ?? undefined,
      reposts:     props['Nombre de republications']?.number ?? undefined
    };
  });
  try {
    const ids = posts.map(p => p.id);
    const v = await getValidations(ids);
    const now = Date.now();
    const cs = await getCadenceDraftSources(ids);
    // V50.3 — Miniature du visuel généré par Cadence si le post n'a pas de
    // couverture Notion. Le calendrier et la bibliothèque montrent ainsi du
    // contenu, pas seulement du texte.
    const covers = await getPostCovers(ids).catch(() => ({} as Record<string, PostCover>));
    for (const p of posts) {
      p.validated = !!v[p.id];
      p.cadence_source = cs[p.id] || null;
      const cadenceCover = covers[p.id];
      if (cadenceCover) {
        if (!p.cover_url) { p.cover_url = cadenceCover.url; p.cover_source = 'cadence'; }
        p.visual_format = cadenceCover.format;
        p.is_carousel = cadenceCover.isCarousel;
      }
      if (p.status === 'scheduled' && p.scheduled_at && new Date(p.scheduled_at).getTime() < now) p.late = true;
    }
  } catch {}
  return posts;
}

// === Get one post with body content ===
export async function getNotionPost(id: string): Promise<{ summary: NotionPostSummary; content: string } | null> {
  if (await isNotionDisconnected()) return null;
  const r = await fetch(`${NOTION_API}/pages/${id}`, { headers: headers() });
  if (!r.ok) return null;
  const page = await r.json();
  const props = page.properties || {};
  const dateProp = props['Date de publication']?.date?.start as string | undefined;
  const heure = plain(props['Heure de publication']?.rich_text);
  let scheduled_at: string | null = null;
  if (dateProp) {
    const [hh, mm] = (heure || '07:30').split(':').map((x: string) => parseInt(x, 10) || 0);
    const d = new Date(dateProp + 'T00:00:00');
    d.setHours(hh, mm, 0, 0);
    scheduled_at = d.toISOString();
  }
  const tagName = props['Tags']?.select?.name as string | undefined;
  let status: NotionPostSummary['status'] = 'draft';
  if (tagName === 'Publié') status = 'published';
  else if (dateProp) status = 'scheduled';

  const summary: NotionPostSummary = {
    id: page.id,
    title: plain(props['Name']?.title) || 'Sans titre',
    excerpt: '',
    pilier: props['Pilier']?.select?.name,
    axe: props['Axe']?.select?.name,
    status,
    scheduled_at,
    scheduled_time: heure || null,
    notion_url: page.url,
    linkedin_url: props['URL']?.url || undefined,
    visuel_pret: !!props['Visuel prêt']?.checkbox,
    anonymisation_ok: !!props['Anonymisation OK']?.checkbox,
    cover_url: page.cover?.external?.url || page.cover?.file?.url || null,
    cover_source: (page.cover?.external?.url || page.cover?.file?.url) ? 'notion' : null
  };

  // Enrich with cadence_source flag + visuel généré (V50.3)
  try {
    const cs = await getCadenceDraftSources([summary.id]);
    summary.cadence_source = cs[summary.id] || null;
    const covers = await getPostCovers([summary.id]).catch(() => ({} as Record<string, PostCover>));
    const cadenceCover = covers[summary.id];
    if (cadenceCover) {
      if (!summary.cover_url) { summary.cover_url = cadenceCover.url; summary.cover_source = 'cadence'; }
      summary.visual_format = cadenceCover.format;
      summary.is_carousel = cadenceCover.isCarousel;
    }
  } catch {/* silent */}

  const blocksRes = await fetch(`${NOTION_API}/blocks/${id}/children?page_size=100`, { headers: headers() });
  const blocksJson = await blocksRes.json();
  const content = (blocksJson.results || [])
    .map((b: any) => plain(b[b.type]?.rich_text))
    .filter(Boolean)
    .join('\n\n');

  return { summary, content };
}

// === Create or update a draft (page-level props) ===
export async function upsertDraft(input: {
  id?: string; // if set, update; else create
  title: string;
  pilier?: string;
  axe?: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM
  anonymisation_ok?: boolean;
  // V51 §5 — Import LinkedIn : on conserve le lien d'origine et le média.
  // `url` → propriété Notion « URL » (= linkedin_url côté lecture), pour que
  // le « LinkedIn ↗ » des imports pointe vers le vrai post. `cover` → image
  // de couverture externe (média LinkedIn), affichée en miniature.
  url?: string;
  cover?: string;
}): Promise<{ id: string }> {
  if (await isNotionDisconnected()) throw new Error('Notion déconnecté de Cadence.');
  const properties: any = {
    Name: { title: [{ text: { content: input.title } }] }
  };
  if (input.pilier) properties.Pilier = { select: { name: input.pilier } };
  if (input.axe)    properties.Axe    = { select: { name: input.axe } };
  if (input.date)   properties['Date de publication'] = { date: { start: input.date } };
  if (input.time)   properties['Heure de publication'] = { rich_text: [{ text: { content: input.time } }] };
  if (typeof input.anonymisation_ok === 'boolean') properties['Anonymisation OK'] = { checkbox: input.anonymisation_ok };
  if (input.url)    properties['URL'] = { url: input.url };
  // Always non-publié on create
  if (!input.id) properties['Tags'] = { select: { name: 'Non publié' } };

  // Couverture externe (média LinkedIn). Notion valide seulement le format
  // d'URL à la création, pas l'accessibilité : un lien expiré ne casse donc
  // pas l'import et les miniatures (background-image CSS) dégradent en douceur.
  const cover = input.cover ? { type: 'external', external: { url: input.cover } } : undefined;

  if (input.id) {
    const r = await fetch(`${NOTION_API}/pages/${input.id}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify(cover ? { properties, cover } : { properties })
    });
    if (!r.ok) throw new Error(`Notion update failed: ${r.status} ${await r.text()}`);
    await logNotionAction('page_updated', input.id, input.title);
    return { id: input.id };
  }
  const r = await fetch(`${NOTION_API}/pages`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      parent: { database_id: getDsId() },
      properties,
      ...(cover ? { cover } : {})
    })
  });
  if (!r.ok) throw new Error(`Notion create failed: ${r.status} ${await r.text()}`);
  const data = await r.json();
  await logNotionAction('page_created', data.id, input.title, data.url);
  await markCadenceDraft(data.id, 'cadence_app');
  return { id: data.id };
}

// === Replace page content body with given text ===
export async function replacePageContent(pageId: string, text: string) {
  if (await isNotionDisconnected()) return;
  // Delete existing children
  const blocksRes = await fetch(`${NOTION_API}/blocks/${pageId}/children?page_size=100`, { headers: headers() });
  const blocks = (await blocksRes.json()).results || [];
  for (const b of blocks) {
    await fetch(`${NOTION_API}/blocks/${b.id}`, { method: 'DELETE', headers: headers() });
  }
  // Append new paragraphs (split on blank lines)
  const paragraphs = text.split(/\n\n+/);
  const children = paragraphs.map(p => ({
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: [{ type: 'text', text: { content: p.slice(0, 1900) } }] }
  }));
  const r = await fetch(`${NOTION_API}/blocks/${pageId}/children`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ children })
  });
  if (!r.ok) throw new Error(`Notion content replace failed: ${r.status} ${await r.text()}`);
  await logNotionAction('content_replaced', pageId, `${paragraphs.length} paragraphes`);
}

// === Cron helpers (existing) ===
export async function searchNotionDrafts(windowMinutes: number): Promise<NotionDraft[]> {
  if (await isNotionDisconnected()) return [];
  const dsId = getDsId();
  const now = new Date();
  const todayIso = now.toISOString().split('T')[0];

  const queryRes = await fetch(`${NOTION_API}/databases/${dsId}/query`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      filter: {
        and: [
          { property: 'Tags', select: { equals: 'Non publié' } },
          { property: 'Date de publication', date: { equals: todayIso } }
        ]
      },
      page_size: 25
    })
  });
  if (!queryRes.ok) throw new Error(`Notion query failed: ${queryRes.status} ${await queryRes.text()}`);
  const queryJson = await queryRes.json();

  const drafts: NotionDraft[] = [];
  for (const page of queryJson.results || []) {
    const heureRich = plain(page.properties?.['Heure de publication']?.rich_text) || '07:30';
    const [hh, mm] = heureRich.split(':').map((x: string) => parseInt(x, 10));
    const scheduledAt = new Date(now);
    scheduledAt.setHours(hh || 7, mm || 30, 0, 0);
    const diffMin = Math.abs((now.getTime() - scheduledAt.getTime()) / 60000);
    if (diffMin > windowMinutes) continue;

    const blocksRes = await fetch(`${NOTION_API}/blocks/${page.id}/children?page_size=100`, { headers: headers() });
    const blocks = await blocksRes.json();
    const text = (blocks.results || [])
      .map((b: any) => plain(b[b.type]?.rich_text))
      .filter(Boolean)
      .join('\n\n');

    drafts.push({
      id: page.id,
      content: text,
      pilier: page.properties?.['Pilier']?.select?.name,
      anonymisation_ok: page.properties?.['Anonymisation OK']?.checkbox || false,
      scheduled_at: scheduledAt.toISOString()
    });
  }
  return drafts;
}

export async function markNotionPublished(pageId: string, postUrn: string): Promise<void> {
  if (await isNotionDisconnected()) return;
  const linkedinUrl = `https://www.linkedin.com/feed/update/${postUrn}`;
  const r = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({
      properties: {
        'Tags': { select: { name: 'Publié' } },
        'URL': { url: linkedinUrl }
      }
    })
  });
  if (!r.ok) throw new Error(`Notion update failed: ${r.status} ${await r.text()}`);
  await logNotionAction('marked_published', pageId, postUrn, linkedinUrl);

  // V18.2 — Une publication confirmée = enrichissement de la mémoire
  // stylistique. Fire-and-forget : on ne bloque pas le retour API,
  // et on catch silent si la table n'existe pas encore (migration pas
  // appliquée). Le pipeline lit content_items confirmés LinkedIn.
  import('@/lib/style-memory')
    .then(m => m.recomputeStyleMemory())
    .catch(() => { /* silent : table peut ne pas exister */ });
}
