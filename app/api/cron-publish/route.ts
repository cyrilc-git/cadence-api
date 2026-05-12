import { NextRequest, NextResponse } from 'next/server';
import { getActiveToken, supabase } from '@/lib/supabase';
import { publishUgcPost } from '@/lib/linkedin';
import { searchNotionDrafts, markNotionPublished } from '@/lib/notion';

const WINDOW_MINUTES = 60 * 24; // sur Hobby on tourne 1×/jour, on prend toute la journée

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const token = await getActiveToken();
  if (!token) return NextResponse.json({ error: 'no_linkedin_token' }, { status: 400 });

  try {
    const drafts = await searchNotionDrafts(WINDOW_MINUTES);
    const results = [];
    for (const draft of drafts) {
      if (draft.pilier?.includes('Cas client') && !draft.anonymisation_ok) {
        results.push({ id: draft.id, status: 'skipped_anonymisation_required' });
        continue;
      }
      const authorUrn = `urn:li:person:${token.linkedin_user_id}`;
      try {
        const { postUrn } = await publishUgcPost(token.access_token, authorUrn, draft.content);
        await markNotionPublished(draft.id, postUrn);
        await supabase.from('publish_log').insert({ notion_page_id: draft.id, linkedin_post_urn: postUrn, status: 'success', meta: { source: 'cron' } });
        results.push({ id: draft.id, status: 'published', urn: postUrn });
      } catch (e: any) {
        await supabase.from('publish_log').insert({ notion_page_id: draft.id, status: 'failed', error: e.message, meta: { source: 'cron' } });
        results.push({ id: draft.id, status: 'failed', error: e.message });
      }
    }
    return NextResponse.json({ checked_at: new Date().toISOString(), drafts_found: drafts.length, results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
