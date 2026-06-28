import { NextRequest, NextResponse } from 'next/server';
import { saveDraft } from '@/lib/drafts';

export const runtime = 'nodejs';

// POST /api/notion/post/:id/move — reprogramme un brouillon (date/heure).
// V58 — Écriture CANONIQUE dans content_items (scheduled_at) via saveDraft, avec
// miroir Notion best-effort (no-op si Notion déconnecté). Avant, cette route
// écrivait UNIQUEMENT Notion, ce qui cassait la reprogrammation sans Notion.
// Ne touche ni au titre, ni au contenu, ni au pilier.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const date = body.date;
  const time = body.time || '07:30';
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date required (YYYY-MM-DD)' }, { status: 400 });
  }
  try {
    await saveDraft({ key: params.id, date, time });
    return NextResponse.json({ ok: true, date, time });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
