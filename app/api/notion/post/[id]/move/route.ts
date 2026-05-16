import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// POST /api/notion/post/:id/move — change uniquement la date/heure d'un draft Notion
// Ne touche pas au titre, ni au contenu, ni au pilier.
// Body : { date: '2026-05-19', time?: '07:30' }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = process.env.NOTION_API_TOKEN;
  if (!token) return NextResponse.json({ error: 'NOTION_API_TOKEN missing' }, { status: 500 });
  const body = await req.json().catch(() => ({}));
  const date = body.date;
  const time = body.time || '07:30';
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date required (YYYY-MM-DD)' }, { status: 400 });
  }
  try {
    const r = await fetch(`https://api.notion.com/v1/pages/${params.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: {
          'Date de publication': { date: { start: date } },
          'Heure de publication': { rich_text: [{ text: { content: time } }] }
        }
      })
    });
    if (!r.ok) {
      const err = await r.text();
      return NextResponse.json({ error: `Notion ${r.status}: ${err.slice(0, 200)}` }, { status: r.status });
    }
    return NextResponse.json({ ok: true, date, time });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
