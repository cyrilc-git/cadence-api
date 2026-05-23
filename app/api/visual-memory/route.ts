// V12.1 §2 — API mémoire visuelle.
// GET /api/visual-memory : retourne items + patterns détectés.
// GET /api/visual-memory?top=1 : retourne les top visuels par impressions.

import { NextResponse } from 'next/server';
import { listVisualItems, analyzeVisualMemory, topVisualsByImpressions, type VisualFormat, type VisualSourceType } from '@/lib/visual-memory';

export const runtime = 'nodejs';
export const maxDuration = 20;
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wantTop = searchParams.get('top') === '1';
    const limit = Math.min(200, parseInt(searchParams.get('limit') || '50', 10) || 50);
    const pilier = searchParams.get('pilier') || undefined;
    const format = (searchParams.get('format') as VisualFormat) || undefined;
    const sourceType = (searchParams.get('source') as VisualSourceType) || undefined;

    if (wantTop) {
      const top = await topVisualsByImpressions({ limit: Math.min(10, limit) });
      return NextResponse.json({ ok: true, top });
    }

    const [items, patterns] = await Promise.all([
      listVisualItems({ limit, pilier, format, sourceType }),
      analyzeVisualMemory(),
    ]);
    return NextResponse.json({ ok: true, items, patterns, count: items.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
