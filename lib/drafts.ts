// V55 Lot 5b — Brouillons éditoriaux canoniques dans content_items.
//
// Cadence n'a plus besoin de Notion pour créer / éditer / programmer / publier.
// content_items est la source : le corps, le titre, l'état, la date y vivent.
// Notion n'est plus qu'un MIROIR best-effort (« Export vers Notion ») : si
// Notion est hors ligne, la sauvegarde réussit quand même.

import crypto from 'node:crypto';
import { supabase } from './supabase';
import { upsertDraft, replacePageContent, type NotionPostSummary } from './notion';
import type { ContentItemFull } from './content-items';
import { parisWallClockToUtcIso, parisHHMM } from './tz';

const UUID = /^[0-9a-f-]{32,40}$/i;

function scheduledIso(date?: string | null, time?: string | null): string | null {
  const d10 = (date || '').slice(0, 10); // tolère 'YYYY-MM-DD' ou un ISO complet
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d10)) return null;
  const t = (time && /^\d{1,2}:\d{2}$/.test(time)) ? time : '07:30';
  // V58.3 — l'heure saisie est une heure de Paris ; on stocke l'instant UTC correct.
  return parisWallClockToUtcIso(d10, t);
}

// Sauvegarde un brouillon dans content_items (primaire) + miroir Notion best-effort.
// `key` = l'id utilisé par l'éditeur (content_items.id OU notion_page_id), ou
// absent pour une création.
export async function saveDraft(input: {
  key?: string | null;
  title?: string;
  content?: string;
  date?: string | null;
  time?: string | null;
  pilier?: string | null;
}): Promise<{ id: string; notion_page_id: string | null }> {
  const now = new Date().toISOString();
  const sched = scheduledIso(input.date, input.time);

  // 1. Résoudre la ligne existante (par id OU notion_page_id).
  let row: { id: string; notion_page_id: string | null; title: string | null } | null = null;
  if (input.key && UUID.test(input.key)) {
    const { data } = await supabase
      .from('content_items')
      .select('id, notion_page_id, title')
      .or(`id.eq.${input.key},notion_page_id.eq.${input.key}`)
      .limit(1);
    row = (data && data[0]) || null;
  }

  // Titre : ce qui est fourni, sinon le titre existant (jamais d'écrasement par
  // un défaut lors d'une sauvegarde de corps seul), sinon « Brouillon ».
  const title = (input.title && input.title.trim() ? input.title.trim() : (row?.title || 'Brouillon')).slice(0, 280);

  let id: string;
  let notion_page_id: string | null;

  if (row) {
    const patch: any = { title, updated_at: now };
    if (typeof input.content === 'string') { patch.content = input.content; patch.excerpt = input.content.slice(0, 600); }
    if (sched) patch.scheduled_at = sched;
    if (input.pilier) patch.pilier = input.pilier;
    await supabase.from('content_items').update(patch).eq('id', row.id);
    id = row.id;
    notion_page_id = row.notion_page_id;
  } else {
    // Création : nouveau brouillon 100 % content_items.
    const ins: any = {
      source_type: 'cadence_generated',
      confidence: 'inferred',
      canonical_source: 'cadence',
      source_id: 'cad:' + crypto.randomUUID(),
      title,
      content: input.content || '',
      excerpt: (input.content || '').slice(0, 600),
      pilier: input.pilier || null,
      scheduled_at: sched,
      validation_status: 'pending',
      sync_status: 'synced',
      embeddings_state: 'absent',
      analytics_state: 'absent',
      meta: { source: 'cadence_editor' },
      last_synced_at: now, updated_at: now, indexed_at: now,
    };
    const { data, error } = await supabase.from('content_items').insert(ins).select('id').single();
    if (error) throw new Error('content_items insert: ' + error.message);
    id = data.id;
    notion_page_id = null;
  }

  // 2. Miroir Notion best-effort (export). Jamais bloquant.
  try {
    const r = await upsertDraft({
      id: notion_page_id || undefined,
      title,
      pilier: input.pilier || undefined,
      date: input.date || undefined,
      time: input.time || undefined,
    });
    if (typeof input.content === 'string') await replacePageContent(r.id, input.content);
    if (!notion_page_id && r.id) {
      notion_page_id = r.id;
      await supabase.from('content_items').update({ notion_page_id }).eq('id', id);
    }
  } catch { /* Notion optionnel : la sauvegarde content_items a déjà réussi */ }

  return { id, notion_page_id };
}

// Construit un NotionPostSummary à partir d'une ligne content_items, pour que
// l'éditeur existant fonctionne sans changement, alimenté par content_items.
export function buildDraftSummary(ci: ContentItemFull): NotionPostSummary {
  const sched = ci.scheduled_at || null;
  const scheduled_time = parisHHMM(sched); // V58.3 — heure affichée en Paris
  return {
    id: ci.notion_page_id || ci.id, // clé éditeur : notion_page_id si dispo (compat aux features), sinon content_items.id
    title: ci.title || 'Brouillon',
    excerpt: ci.excerpt || '',
    pilier: ci.pilier || undefined,
    status: sched ? 'scheduled' : 'draft',
    scheduled_at: sched,
    scheduled_time,
    notion_url: '',
    linkedin_url: ci.linkedin_url || undefined,
    cover_url: (ci.meta && ci.meta.cover_url) || null,
    cover_source: (ci.meta && ci.meta.cover_url) ? 'cadence' : null,
  };
}
