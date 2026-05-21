// V9.3 — Lecture unifiée content_items (shadow-write).
// Cette couche expose un ContentItem normalisé pour toute l'UI. Elle lit en
// priorité la table content_items si elle existe et est peuplée, sinon elle
// reconstruit le ContentItem à la volée depuis Notion + post_embeddings.
//
// Stratégie 100 % safe : aucune écriture, aucune migration forcée. Tant que
// content_items est vide ou absente, le fallback live garantit la même UX.

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
async function contentItemsAvailable(): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from('content_items')
      .select('id', { count: 'exact', head: true });
    if (error) return false;
    return (count || 0) > 0;
  } catch {
    return false;
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
      source_id: row.source_id,
      notion_page_id: row.notion_page_id,
      linkedin_urn: row.linkedin_urn,
      linkedin_url: row.linkedin_url,
      canonical_url: row.canonical_url,
      published_at: row.published_at,
      scheduled_at: row.scheduled_at,
      validation_status: row.validation_status,
      sync_status: row.sync_status,
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
export async function listContentItems(opts?: { limit?: number; sourceType?: SourceType | SourceType[] }): Promise<ContentItem[]> {
  const limit = opts?.limit ?? 200;
  const useTable = await contentItemsAvailable();
  const items = useTable ? await fromTable(limit) : await fromLive(limit);
  if (!opts?.sourceType) return items;
  const allowed = new Set(Array.isArray(opts.sourceType) ? opts.sourceType : [opts.sourceType]);
  return items.filter(i => allowed.has(i.provenance.source_type));
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
