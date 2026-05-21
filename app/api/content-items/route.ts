// V9.3 — Lecture unifiée des posts (lecture seule).
// GET /api/content-items?limit=200&source=linkedin_published,notion_draft
// Retourne ContentItem[] : provenance + métadonnées normalisées.

import { NextResponse } from 'next/server';
import { listContentItems, countByProvenance } from '@/lib/content-items';
import type { SourceType } from '@/lib/provenance';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const VALID_SOURCES: SourceType[] = [
  'linkedin_published',
  'linkedin_import_zip',
  'notion_draft',
  'notion_archive',
  'cadence_generated',
  'unknown',
];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '200', 10) || 200));
    const sourceParam = searchParams.get('source');
    const sourceType = sourceParam
      ? (sourceParam.split(',').map(s => s.trim()).filter(s => VALID_SOURCES.includes(s as SourceType)) as SourceType[])
      : undefined;

    const includeCounts = searchParams.get('counts') === '1';
    const items = await listContentItems({ limit, sourceType });
    const payload: any = {
      items,
      count: items.length,
      generated_at: new Date().toISOString(),
    };
    if (includeCounts) payload.counts = await countByProvenance({ limit: 500 });
    return NextResponse.json(payload);
  } catch (e: any) {
    return NextResponse.json({ error: e.message, items: [] }, { status: 500 });
  }
}
