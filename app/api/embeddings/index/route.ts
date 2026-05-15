import { NextRequest, NextResponse } from 'next/server';
import { listNotionPosts, getNotionPost } from '@/lib/notion';
import { indexPost, indexedCount } from '@/lib/embeddings';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/embeddings/index — indexe les posts Notion non encore embedded.
// Body : { limit?: number, force?: boolean }
// Cap : 30 posts par appel (~6s à 200ms/embed) pour rester sous maxDuration.
export async function POST(req: NextRequest) {
  let body: any = {};
  try { body = await req.json(); } catch {}
  const cap = Math.min(Math.max(body.limit || 30, 1), 50);
  const force = !!body.force;

  try {
    const posts = await listNotionPosts(150);
    const results: any[] = [];
    let processed = 0;
    for (const p of posts) {
      if (processed >= cap) break;
      try {
        // Read full content via getNotionPost (only for first cap posts)
        const full = await getNotionPost(p.id).catch(() => null);
        if (!full?.content) { results.push({ id: p.id, status: 'no_content' }); continue; }
        const r = await indexPost({
          source: 'notion',
          source_ref: p.id,
          title: p.title,
          content: full.content,
          pilier: p.pilier,
          status: p.status,
          scheduled_at: p.scheduled_at,
          meta: { notion_url: p.notion_url, impressions: p.impressions || null }
        });
        results.push({ id: p.id, title: p.title.slice(0, 60), ...r });
        processed++;
        if (force) continue; // re-embed even if hash matches (re-creates row)
      } catch (e: any) {
        results.push({ id: p.id, status: 'error', error: e.message });
      }
    }
    const total = await indexedCount().catch(() => -1);
    const indexed = results.filter(r => r.indexed).length;
    return NextResponse.json({ processed: results.length, indexed, total_in_db: total, results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
