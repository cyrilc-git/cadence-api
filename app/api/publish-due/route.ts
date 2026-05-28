import { NextRequest, NextResponse } from 'next/server';
import { getActiveToken, supabase } from '@/lib/supabase';
import { publishUgcPost } from '@/lib/linkedin';
import { searchNotionDrafts, markNotionPublished } from '@/lib/notion';
import { isValidated } from '@/lib/db';

// V51 §8 (garde-fou) — Même règle que le cron : on ne publie QUE les brouillons
// explicitement validés. Sans cette barrière, un appel à /api/publish-due
// publiait tous les drafts dus, y compris ceux jamais validés. validated:false
// par défaut + aucune publication sans validation explicite.
export async function POST(req: NextRequest) {
  const referer = req.headers.get('referer') || '';
  const host    = req.headers.get('host')    || '';
  if (!referer.includes(host)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const token = await getActiveToken();
  if (!token) return NextResponse.json({ error: 'no_linkedin_token' }, { status: 400 });
  const drafts = await searchNotionDrafts(60 * 24);
  const results: any[] = [];
  for (const draft of drafts) {
    if (draft.pilier?.includes('Cas client') && !draft.anonymisation_ok) {
      results.push({ id: draft.id, status: 'skipped_anonymisation_required' });
      continue;
    }
    if (!(await isValidated(draft.id))) {
      results.push({ id: draft.id, status: 'skipped_not_validated', reason: 'Brouillon non validé. Cadence ne publie que les brouillons explicitement validés.' });
      continue;
    }
    try {
      const { postUrn } = await publishUgcPost(token.access_token, `urn:li:person:${token.linkedin_user_id}`, draft.content);
      await markNotionPublished(draft.id, postUrn);
      await supabase.from('publish_log').insert({ notion_page_id: draft.id, linkedin_post_urn: postUrn, status: 'success', meta: { source: 'manual_due' } });
      results.push({ id: draft.id, status: 'published', urn: postUrn });
    } catch (e: any) {
      await supabase.from('publish_log').insert({ notion_page_id: draft.id, status: 'failed', error: e.message, meta: { source: 'manual_due' } });
      results.push({ id: draft.id, status: 'failed', error: e.message });
    }
  }
  return NextResponse.json({ checked: drafts.length, results });
}
