import { NextResponse } from 'next/server';
import { isNotionDisconnected } from '@/lib/notion';

export const runtime = 'nodejs';

// POST /api/notion/post/:id/archive — archive (move to trash) a Notion page.
// Reversible côté Notion : l'utilisateur peut restaurer depuis la corbeille Notion.
// Cadence ne touche jamais aux pages historiques sans cette confirmation explicite.
// V58 — Étape OPTIONNELLE (la suppression côté Cadence passe par /api/cadence-drafts).
// Si Notion est déconnecté (ou sans token), on no-op proprement.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (await isNotionDisconnected()) return NextResponse.json({ ok: true, skipped: 'notion_disconnected' });
  const token = process.env.NOTION_API_TOKEN;
  if (!token) return NextResponse.json({ ok: true, skipped: 'no_token' });
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
