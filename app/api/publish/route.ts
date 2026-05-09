import { NextRequest, NextResponse } from 'next/server';
import { getActiveToken } from '@/lib/supabase';
import { publishUgcPost } from '@/lib/linkedin';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  // Auth simple : header X-Cockpit-Secret partagé entre l'artifact Cowork et Cadence
  const secret = req.headers.get('x-cockpit-secret');
  if (!secret || secret !== process.env.COCKPIT_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { text, notion_page_id } = body as { text?: string; notion_page_id?: string };
  if (!text || text.trim().length < 10) {
    return NextResponse.json({ error: 'text_too_short' }, { status: 400 });
  }

  const token = await getActiveToken();
  if (!token) return NextResponse.json({ error: 'no_linkedin_token' }, { status: 400 });

  const authorUrn = `urn:li:person:${token.linkedin_user_id}`;

  try {
    const { postUrn } = await publishUgcPost(token.access_token, authorUrn, text);
    await supabase.from('publish_log').insert({
      notion_page_id: notion_page_id || null,
      linkedin_post_urn: postUrn,
      status: 'success'
    });
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
  return NextResponse.json({ usage: 'POST /api/publish with { text, notion_page_id }, header X-Cockpit-Secret' });
}
