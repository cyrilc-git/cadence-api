import { NextRequest, NextResponse } from 'next/server';
import { listNotionPosts, upsertDraft, replacePageContent } from '@/lib/notion';

// GET — list posts
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500));
  try {
    const posts = await listNotionPosts(limit);
    return NextResponse.json({ posts });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST — create or update a draft
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { id, title, pilier, axe, date, time, anonymisation_ok, content } = body;
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });
  try {
    const r = await upsertDraft({ id, title, pilier, axe, date, time, anonymisation_ok });
    if (typeof content === 'string') {
      await replacePageContent(r.id, content);
    }
    return NextResponse.json({ id: r.id, ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
