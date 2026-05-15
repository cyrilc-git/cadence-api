import { NextResponse } from 'next/server';
import { indexedCount } from '@/lib/embeddings';
import { listNotionPosts } from '@/lib/notion';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const [total, posts] = await Promise.all([
      indexedCount(),
      listNotionPosts(150).catch(() => [])
    ]);
    return NextResponse.json({
      indexed_total: total,
      notion_posts_total: posts.length,
      notion_posts_with_content: posts.filter(p => p.title && p.title !== 'Sans titre').length,
      coverage_pct: posts.length ? Math.round((total / posts.length) * 100) : 0
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
