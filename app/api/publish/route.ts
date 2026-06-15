import { NextRequest, NextResponse } from 'next/server';
import { getActiveToken, supabase } from '@/lib/supabase';
import { publishUgcPost } from '@/lib/linkedin';
import { markNotionPublished } from '@/lib/notion';

export async function POST(req: NextRequest) {
  // Auth: either X-Cockpit-Secret (programmatic) or same-origin (UI)
  const secret = req.headers.get('x-cockpit-secret');
  const referer = req.headers.get('referer') || '';
  const origin  = req.headers.get('origin')  || '';
  const host    = req.headers.get('host')    || '';
  const sameOrigin = (origin && origin.includes(host)) || (referer && referer.includes(host));
  if (!sameOrigin && (!secret || secret !== process.env.COCKPIT_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { text, notion_page_id, source } = body as { text?: string; notion_page_id?: string; source?: string };
  if (!text || text.trim().length < 10) return NextResponse.json({ error: 'text_too_short' }, { status: 400 });

  const token = await getActiveToken();
  if (!token) return NextResponse.json({ error: 'no_linkedin_token' }, { status: 400 });

  const authorUrn = `urn:li:person:${token.linkedin_user_id}`;

  try {
    const { postUrn } = await publishUgcPost(token.access_token, authorUrn, text);
    await supabase.from('publish_log').insert({
      notion_page_id: notion_page_id || null,
      linkedin_post_urn: postUrn,
      status: 'success',
      meta: { source: source || (sameOrigin ? 'ui' : 'api') }
    });
    if (notion_page_id) {
      try { await markNotionPublished(notion_page_id, postUrn); } catch {}
      // V55 Lot 5b — refléter l'état publié dans content_items (couche
      // canonique) sans attendre la re-synchro DMA. Best-effort, jamais bloquant.
      // La clé éditeur peut être un id content_items OU un notion_page_id.
      if (/^[0-9a-f-]{32,40}$/i.test(notion_page_id)) {
        try {
          const nowIso = new Date().toISOString();
          await supabase.from('content_items')
            .update({ published_at: nowIso, linkedin_url: `https://www.linkedin.com/feed/update/${postUrn}`, updated_at: nowIso })
            .or(`id.eq.${notion_page_id},notion_page_id.eq.${notion_page_id}`);
        } catch {}
      }
    }
    return NextResponse.json({ success: true, post_urn: postUrn });
  } catch (e: any) {
    await supabase.from('publish_log').insert({
      notion_page_id: notion_page_id || null,
      status: 'failed',
      error: e.message
    });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ usage: 'POST /api/publish with { text, notion_page_id }' });
}
