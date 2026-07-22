import { NextRequest, NextResponse } from 'next/server';
import { getActiveToken, supabase } from '@/lib/supabase';
import { publishUgcPost } from '@/lib/linkedin';
import { markNotionPublished } from '@/lib/notion';
import { isValidated } from '@/lib/db';

// Même règle que le cron : on ne publie QUE les brouillons échus ET explicitement
// validés (post_validations). Aucune publication sans validation.
// V58.11 — Lit content_items au lieu de searchNotionDrafts (Notion déconnecté).
// Host comparé EXACTEMENT (avant : referer.includes(host), sous-chaîne).
function hostFromUrl(u: string): string {
  try { return new URL(u).host; } catch { return ''; }
}

export async function POST(req: NextRequest) {
  const secret  = req.headers.get('x-cockpit-secret');
  const referer = req.headers.get('referer') || '';
  const origin  = req.headers.get('origin')  || '';
  const host    = req.headers.get('host')    || '';
  const sameOrigin = (!!origin && hostFromUrl(origin) === host) || (!!referer && hostFromUrl(referer) === host);
  if (!sameOrigin && (!secret || secret !== process.env.COCKPIT_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const token = await getActiveToken();
  if (!token) return NextResponse.json({ error: 'no_linkedin_token' }, { status: 400 });

  const nowIso = new Date().toISOString();
  const { data: due, error } = await supabase
    .from('content_items')
    .select('id, notion_page_id, content, pilier, scheduled_at')
    .eq('source_type', 'cadence_generated')
    .not('scheduled_at', 'is', null)
    .lte('scheduled_at', nowIso)
    .is('published_at', null)
    .order('scheduled_at', { ascending: true })
    .limit(25);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const authorUrn = `urn:li:person:${token.linkedin_user_id}`;
  const results: any[] = [];

  for (const row of due || []) {
    const editorKey = row.notion_page_id || row.id;
    if (!(await isValidated(editorKey))) {
      results.push({ id: row.id, status: 'skipped_not_validated', reason: 'Brouillon non validé. Cadence ne publie que les brouillons explicitement validés.' });
      continue;
    }
    if (!row.content || !row.content.trim()) {
      results.push({ id: row.id, status: 'skipped_empty' });
      continue;
    }
    try {
      const { postUrn } = await publishUgcPost(token.access_token, authorUrn, row.content);
      const doneIso = new Date().toISOString();
      await supabase.from('content_items')
        .update({ published_at: doneIso, linkedin_url: `https://www.linkedin.com/feed/update/${postUrn}`, updated_at: doneIso })
        .eq('id', row.id);
      if (row.notion_page_id) { try { await markNotionPublished(row.notion_page_id, postUrn); } catch { /* optionnel */ } }
      await supabase.from('publish_log').insert({ notion_page_id: editorKey, linkedin_post_urn: postUrn, status: 'success', meta: { source: 'manual_due' } });
      results.push({ id: row.id, status: 'published', urn: postUrn });
    } catch (e: any) {
      await supabase.from('publish_log').insert({ notion_page_id: editorKey, status: 'failed', error: e.message, meta: { source: 'manual_due' } });
      results.push({ id: row.id, status: 'failed', error: e.message });
    }
  }
  return NextResponse.json({ checked: (due || []).length, results });
}
