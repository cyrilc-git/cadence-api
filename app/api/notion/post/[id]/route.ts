import { NextRequest, NextResponse } from 'next/server';
import { getNotionPost } from '@/lib/notion';
import { saveDraft } from '@/lib/drafts';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const r = await getNotionPost(params.id);
  if (!r) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(r);
}

// PATCH — mise à jour d'un brouillon existant.
// V55 Lot 5b — content_items primaire (saveDraft) + miroir Notion best-effort.
// Le titre absent ne réécrit pas l'existant (sauvegarde de corps seul).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const { title, pilier, date, time, scheduled_date, scheduled_time, content } = body;
  try {
    const r = await saveDraft({ key: params.id, title, pilier, date: date || scheduled_date, time: time || scheduled_time, content });
    return NextResponse.json({ id: r.notion_page_id || r.id, ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
