import { NextRequest, NextResponse } from 'next/server';
import { semanticSearch, noveltyScore } from '@/lib/embeddings';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const q = (body.q || body.query || '').toString();
  if (!q) return NextResponse.json({ error: 'q required' }, { status: 400 });
  try {
    const [hits, novelty] = await Promise.all([
      semanticSearch(q, { limit: body.limit || 10, floor: body.floor ?? 0.4 }),
      body.includeNovelty ? noveltyScore(q) : Promise.resolve(null)
    ]);
    return NextResponse.json({ hits, novelty });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
