import { NextRequest, NextResponse } from 'next/server';
import { listNotionPosts } from '@/lib/notion';
import { saveDraft } from '@/lib/drafts';

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

// POST — créer ou mettre à jour un brouillon.
// V55 Lot 5b — content_items est la source : saveDraft écrit content_items
// (primaire) puis miroir Notion best-effort. Si Notion est KO, la sauvegarde
// réussit quand même. On renvoie notion_page_id si dispo (compat clé éditeur),
// sinon l'id content_items.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { id, title, pilier, date, time, scheduled_date, scheduled_time, content } = body;
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });
  try {
    const r = await saveDraft({ key: id, title, pilier, date: date || scheduled_date, time: time || scheduled_time, content });
    return NextResponse.json({ id: r.notion_page_id || r.id, ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
