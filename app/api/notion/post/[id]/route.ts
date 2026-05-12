import { NextRequest, NextResponse } from 'next/server';
import { getNotionPost, upsertDraft, replacePageContent } from '@/lib/notion';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const r = await getNotionPost(params.id);
  if (!r) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(r);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const { title, pilier, axe, date, time, anonymisation_ok, content } = body;
  try {
    if (title || pilier || axe || date || time || typeof anonymisation_ok === 'boolean') {
      await upsertDraft({ id: params.id, title: title || 'Sans titre', pilier, axe, date, time, anonymisation_ok });
    }
    if (typeof content === 'string') {
      await replacePageContent(params.id, content);
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
