import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// POST /api/notion/post/:id/archive — archive (move to trash) a Notion page.
// Reversible côté Notion : l'utilisateur peut restaurer depuis la corbeille Notion.
// Cadence ne touche jamais aux pages historiques sans cette confirmation explicite.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const token = process.env.NOTION_API_TOKEN;
  if (!token) return NextResponse.json({ error: 'NOTION_API_TOKEN missing' }, { status: 500 });
  try {
    const r = await fetch(`https://api.notion.com/v1/pages/${params.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: true })
    });
    if (!r.ok) {
      const err = await r.text();
      return NextResponse.json({ error: `Notion ${r.status}: ${err.slice(0, 200)}` }, { status: r.status });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
