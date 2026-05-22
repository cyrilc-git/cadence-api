// V9.3 + V10.1 — Lecture et shadow-write content_items.
// Cette couche expose un ContentItem normalisé pour toute l'UI. Elle lit en
// priorité la table content_items si elle existe et est peuplée, sinon elle
// reconstruit le ContentItem à la volée depuis Notion + post_embeddings.
//
// Stratégie : shadow-write idempotent depuis Notion + post_embeddings.
// Tant que la table est vide, fallback live garantit la même UX.

import { supabase } from './supabase';
import { listNotionPosts } from './notion';
import { listIndexed } from './embeddings';
import { inferFromNotion, inferFromEmbedding, type Provenance, type SourceType } from './provenance';

export type ContentItem = {
  id: string;
  provenance: Provenance;
  title: string;
  excerpt?: string | null;
  pilier?: string | null;
  scheduled_at?: string | null;
  published_at?: string | null;
  validated?: boolean | null;
  linkedin_url?: string | null;
  notion_url?: string | null;
  linkedin_urn?: string | null;
  meta?: any;
};

// Détecte si la table content_items existe et contient des lignes utiles.
// V10.1.3 — n'utilise plus head:true (count peut être null) : on lit 1 row.
async function contentItemsAvailable(): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('content_items')
      .select('id')
      .limit(1);
    if (error) return { ok: false, count: 0, error: error.message };
    return { ok: (data?.length || 0) > 0, count: data?.length || 0 };
  } catch (e: any) {
    return { ok: false, count: 0, error: e?.message || 'exception' };
  }
}

// Lecture depuis la table (quand peuplée).
async function fromTable(limit: number): Promise<ContentItem[]> {
  const { data, error } = await supabase
    .from('content_items')
    .select('*')
    .order('scheduled_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((row: any): ContentItem => ({
    id: row.id,
    provenance: {
      source_type: row.source_type as SourceType,
      confidence: row.confidence,
      canonical_source: row.canonical_source,
      source_id: row.source_id,
      notion_page_id: row.notion_page_id,
      linkedin_urn: row.linkedin_urn,
      linkedin_url: row.linkedin_url,
      canonical_url: row.canonical_url,
      published_at: row.published_at,
      scheduled_at: row.scheduled_at,
      validation_status: row.validation_status,
      sync_status: row.sync_status,
      embeddings_state: row.embeddings_state,
      analytics_state: row.analytics_state,
      last_synced_at: row.last_synced_at,
    },
    title: row.title || 'Sans titre',
    excerpt: row.excerpt,
    pilier: row.pilier,
    scheduled_at: row.scheduled_at,
    published_at: row.published_at,
    validated: row.validation_status === 'validated',
    linkedin_url: row.linkedin_url,
    linkedin_urn: row.linkedin_urn,
    meta: row.meta || {},
  }));
}

// Fallback live : agrège Notion + embeddings sans dépendre de content_items.
async function fromLive(limit: number): Promise<ContentItem[]> {
  const [notionPosts, embeddedRows] = await Promise.all([
    listNotionPosts(limit).catch(() => [] as any[]),
    listIndexed({ limit }).catch(() => [] as any[]),
  ]);

  const seenSourceIds = new Set<string>();
  const out: ContentItem[] = [];

  // Notion d'abord (signal le plus riche)
  for (const p of notionPosts) {
    const prov = inferFromNotion({
      id: p.id,
      title: p.title,
      status: p.status,
      linkedin_url: p.linkedin_url,
      notion_url: p.notion_url,
      scheduled_at: p.scheduled_at,
      validated: p.validated,
      cadence_source: p.cadence_source,
    });
    const key = `notion:${p.id}`;
    if (seenSourceIds.has(key)) continue;
    seenSourceIds.add(key);
    out.push({
      id: p.id,
      provenance: prov,
      title: p.title,
      excerpt: p.excerpt,
      pilier: p.pilier,
      scheduled_at: p.scheduled_at,
      published_at: prov.published_at || (p.status === 'published' ? p.scheduled_at : null),
      validated: !!p.validated,
      linkedin_url: p.linkedin_url || null,
      linkedin_urn: prov.linkedin_urn,
      notion_url: p.notion_url || null,
      meta: { impressions: p.impressions, likes: p.likes, comments: p.comments, reposts: p.reposts },
    });
  }

  // Embeddings : ajout uniquement si la ligne n'a pas déjà été représentée par Notion
  for (const e of embeddedRows) {
    if (!e.source_ref) continue;
    if (e.source === 'notion' && seenSourceIds.has(`notion:${e.source_ref}`)) continue;
    const key = `${e.source}:${e.source_ref}`;
    if (seenSourceIds.has(key)) continue;
    seenSourceIds.add(key);

    const prov = inferFromEmbedding({
      id: e.id,
      source: e.source,
      source_ref: e.source_ref,
      status: e.status,
      scheduled_at: e.scheduled_at,
    });
    out.push({
      id: e.id,
      provenance: prov,
      title: e.title || 'Sans titre',
      pilier: e.pilier,
      scheduled_at: e.scheduled_at,
      published_at: prov.published_at,
      validated: null,
      linkedin_url: prov.linkedin_url,
      linkedin_urn: prov.linkedin_urn,
      meta: {},
    });
  }

  // Tri stable : par scheduled_at desc puis published_at
  out.sort((a, b) => (b.scheduled_at || b.published_at || '').localeCompare(a.scheduled_at || a.published_at || ''));
  return out.slice(0, limit);
}

// Façade principale : utilisée par les routes API et les pages.
export async function listContentItems(opts?: { limit?: number; sourceType?: SourceType | SourceType[]; debug?: boolean }): Promise<ContentItem[] & { _debug?: any } | ContentItem[]> {
  const limit = opts?.limit ?? 200;
  const avail = await contentItemsAvailable();
  const items = avail.ok ? await fromTable(limit) : await fromLive(limit);
  if (opts?.debug) (items as any)._debug = { layer: avail.ok ? 'table' : 'live', count: avail.count, error: avail.error };
  if (!opts?.sourceType) return items;
  const allowed = new Set(Array.isArray(opts.sourceType) ? opts.sourceType : [opts.sourceType]);
  return items.filter(i => allowed.has(i.provenance.source_type));
}

// V10.1 — Shadow-write idempotent depuis Notion + post_embeddings.
// Upsert sur (source_type, source_id) défini par la migration.
export type SyncResult = {
  fromNotion: number;
  fromEmbeddings: number;
  skipped: number;
  errors: number;
  totalAfter: number;
  errorMessages: string[];
};

function provenanceToRow(prov: Provenance, extras: { title: string; excerpt?: string | null; pilier?: string | null; meta?: any }) {
  return {
    source_type: prov.source_type,
    confidence: prov.confidence,
    canonical_source: prov.canonical_source,
    source_id: prov.source_id,
    notion_page_id: prov.notion_page_id || null,
    linkedin_urn: prov.linkedin_urn || null,
    linkedin_url: prov.linkedin_url || null,
    canonical_url: prov.canonical_url || null,
    title: (extras.title || 'Sans titre').slice(0, 280),
    excerpt: extras.excerpt ? extras.excerpt.slice(0, 600) : null,
    pilier: extras.pilier || null,
    published_at: prov.published_at || null,
    scheduled_at: prov.scheduled_at || null,
    validation_status: prov.validation_status || null,
    sync_status: prov.sync_status || null,
    embeddings_state: prov.embeddings_state || 'absent',
    analytics_state: prov.analytics_state || 'absent',
    meta: extras.meta || {},
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function syncContentItems(opts?: { limit?: number }): Promise<SyncResult> {
  const limit = opts?.limit ?? 500;
  const res: SyncResult = { fromNotion: 0, fromEmbeddings: 0, skipped: 0, errors: 0, totalAfter: 0, errorMessages: [] };

  // 1. Préchargement embeddings (avec content_excerpt) pour enrichir analytics / excerpt.
  const { data: embeddedRows } = await supabase
    .from('post_embeddings')
    .select('id, source, source_ref, title, pilier, status, scheduled_at, content_excerpt, meta')
    .order('scheduled_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  const allEmbedded = (embeddedRows || []) as any[];
  const embeddedByNotionRef = new Map<string, any>();
  for (const e of allEmbedded) {
    if (e.source === 'notion' && e.source_ref) embeddedByNotionRef.set(e.source_ref, e);
  }

  // 2. Notion : upsert chaque post avec provenance enrichie.
  const notionPosts = await listNotionPosts(limit).catch(() => [] as any[]);
  for (const p of notionPosts) {
    try {
      const prov = inferFromNotion({
        id: p.id, title: p.title, status: p.status,
        linkedin_url: p.linkedin_url, notion_url: p.notion_url,
        scheduled_at: p.scheduled_at, validated: p.validated,
        cadence_source: p.cadence_source,
      });
      const embedded = embeddedByNotionRef.get(p.id);
      const hasMetrics = typeof p.impressions === 'number' && p.impressions > 0;
      const provEnriched: Provenance = {
        ...prov,
        embeddings_state: embedded ? 'indexed' : 'absent',
        analytics_state: hasMetrics ? (prov.canonical_source === 'linkedin' ? 'confirmed' : 'inferred') : 'absent',
      };
      const row = provenanceToRow(provEnriched, {
        title: p.title,
        excerpt: (embedded && embedded.content_excerpt) || p.excerpt || null,
        pilier: p.pilier,
        meta: {
          impressions: p.impressions,
          likes: p.likes,
          comments: p.comments,
          reposts: p.reposts,
        },
      });
      const { error } = await supabase.from('content_items').upsert(row, { onConflict: 'source_type,source_id' });
      if (error) {
        res.errors++;
        res.errorMessages.push(`notion ${p.id.slice(0, 8)}: ${error.message}`);
      } else {
        res.fromNotion++;
      }
    } catch (e: any) {
      res.errors++;
      res.errorMessages.push(`notion exc: ${e.message}`);
    }
  }

  // 3. Embeddings : ajout des items présents en pgvector mais absents du flux Notion (ex : import LinkedIn).
  const seenSourceIds = new Set(notionPosts.map(p => `notion-derived:${p.id}`));
  for (const e of allEmbedded) {
    if (e.source === 'notion') continue; // déjà couvert par la passe Notion
    if (!e.source_ref) continue;
    try {
      const prov = inferFromEmbedding({
        id: e.id, source: e.source, source_ref: e.source_ref,
        status: e.status, scheduled_at: e.scheduled_at,
        meta: e.meta,
      });
      const key = `${prov.source_type}:${prov.source_id}`;
      if (seenSourceIds.has(key)) { res.skipped++; continue; }
      seenSourceIds.add(key);
      const provEnriched: Provenance = {
        ...prov,
        embeddings_state: 'indexed',
        analytics_state: 'inferred',
      };
      const row = provenanceToRow(provEnriched, {
        title: e.title || 'Sans titre',
        excerpt: e.content_excerpt || null,
        pilier: e.pilier,
        meta: e.meta || {},
      });
      const { error } = await supabase.from('content_items').upsert(row, { onConflict: 'source_type,source_id' });
      if (error) {
        res.errors++;
        res.errorMessages.push(`embed ${e.source_ref.slice(0, 12)}: ${error.message}`);
      } else {
        res.fromEmbeddings++;
      }
    } catch (e: any) {
      res.errors++;
      res.errorMessages.push(`embed exc: ${e.message}`);
    }
  }

  const { count } = await supabase.from('content_items').select('id', { count: 'exact', head: true });
  res.totalAfter = count || 0;
  return res;
}

// V11.1 — Adapter ContentItem -> NotionPostSummary-like
// Le format utilisé par /posts /calendar /dashboard est NotionPostSummary.
// Cet adapter permet de basculer la lecture UI sur la couche canonique sans
// refondre les clients existants. Tous les champs sont reconstruits depuis
// les colonnes content_items + meta.
import type { NotionPostSummary } from './notion';

export function contentItemToPostSummary(item: ContentItem): NotionPostSummary {
  const sourceType = item.provenance.source_type;
  let status: 'draft' | 'scheduled' | 'published' | 'error' = 'draft';
  if (sourceType === 'linkedin_published' || sourceType === 'linkedin_import_zip' || sourceType === 'notion_archive') {
    status = 'published';
  } else if (item.scheduled_at) {
    status = 'scheduled';
  }

  const scheduledIso = item.scheduled_at || item.published_at || null;
  let scheduledTime: string | null = null;
  if (scheduledIso) {
    try {
      const d = new Date(scheduledIso);
      scheduledTime = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
    } catch {}
  }

  const cadenceSource: string | null =
    sourceType === 'cadence_generated' ? 'cadence' :
    sourceType === 'linkedin_import_zip' ? 'linkedin_archive' :
    null;

  const isLate = scheduledIso ? (status === 'scheduled' && new Date(scheduledIso).getTime() < Date.now()) : false;

  return {
    id: item.provenance.notion_page_id || item.id,
    title: item.title,
    excerpt: item.excerpt || '',
    pilier: item.pilier || undefined,
    status,
    scheduled_at: scheduledIso,
    scheduled_time: scheduledTime,
    notion_url: item.notion_url
      || (item.meta && item.meta.notion_url)
      || (item.provenance.canonical_source === 'notion' ? (item.provenance.canonical_url || '') : ''),
    linkedin_url: item.linkedin_url || undefined,
    validated: !!item.validated,
    late: isLate,
    cadence_source: cadenceSource,
    cover_url: (item.meta && item.meta.cover_url) || null,
    impressions: item.meta?.impressions,
    likes: item.meta?.likes,
    comments: item.meta?.comments,
    reposts: item.meta?.reposts,
  };
}

// V11.1 — Fire-and-forget : déclenche un syncContentItems en background si la
// dernière sync est trop ancienne. Garantit une fraîcheur sans bloquer le TTFB.
export async function ensureFreshContentItems(maxAgeMinutes = 120): Promise<void> {
  try {
    const { data } = await supabase
      .from('content_items')
      .select('last_synced_at')
      .order('last_synced_at', { ascending: false })
      .limit(1);
    const lastSync = data?.[0]?.last_synced_at;
    if (!lastSync) {
      // Aucune sync encore : on lance en background.
      syncContentItems({ limit: 200 }).catch(() => {});
      return;
    }
    const ageMs = Date.now() - new Date(lastSync).getTime();
    if (ageMs > maxAgeMinutes * 60 * 1000) {
      syncContentItems({ limit: 200 }).catch(() => {});
    }
  } catch { /* silent */ }
}

// V11.1 — Lecture haut-niveau prête pour l'UI : retourne directement des
// NotionPostSummary depuis content_items.
export async function listPostSummaries(opts?: { limit?: number }): Promise<NotionPostSummary[]> {
  const items = await listContentItems({ limit: opts?.limit ?? 200 });
  return items.map(contentItemToPostSummary);
}

// Compteurs par provenance (utilisé par /cerveau et la Bibliothèque).
export async function countByProvenance(opts?: { limit?: number }): Promise<Record<SourceType, number>> {
  const items = await listContentItems({ limit: opts?.limit ?? 500 });
  const counts: Record<SourceType, number> = {
    linkedin_published: 0,
    linkedin_import_zip: 0,
    notion_draft: 0,
    notion_archive: 0,
    cadence_generated: 0,
    unknown: 0,
  };
  for (const it of items) counts[it.provenance.source_type]++;
  return counts;
}
