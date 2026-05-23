// V12.1 §4 — Backfill visual_items depuis content_items existants.
// Pour chaque content_item publié avec un cover_url, on crée une entrée
// dans visual_items (source linkedin_published) pour pouvoir corréler
// composition / format avec les impressions cumulées.
//
// Endpoint GET protégé par COCKPIT_SECRET (lecture seule depuis prod via
// curl + header). Idempotent : upsert sur (source_type, url).

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { recordVisualItem } from '@/lib/visual-memory';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function authorized(req: Request): boolean {
  const secret = process.env.COCKPIT_SECRET;
  if (!secret) return false;
  const h = req.headers.get('x-cockpit-secret') || req.headers.get('authorization') || '';
  return h === secret || h === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    // Lit les content_items publiés avec un cover_url
    const { data, error } = await supabase
      .from('content_items')
      .select('id, pilier, published_at, meta')
      .eq('source_type', 'linkedin_import_zip')
      .limit(500);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let inserted = 0, skipped = 0, errors = 0;
    for (const row of (data || [])) {
      const meta = row.meta as any;
      const cover: string | null = meta?.cover_url || meta?.image_url || null;
      if (!cover) { skipped++; continue; }
      try {
        await recordVisualItem({
          source_type: 'linkedin_published',
          content_item_id: row.id,
          pilier: row.pilier,
          format: null, // Format inconnu sans Vision pass
          composition: null,
          url: cover,
          impressions: typeof meta?.impressions === 'number' ? meta.impressions : null,
          likes: typeof meta?.likes === 'number' ? meta.likes : null,
          comments: typeof meta?.comments === 'number' ? meta.comments : null,
          published_at: row.published_at,
          meta: { backfill: true },
        });
        inserted++;
      } catch {
        errors++;
      }
    }
    return NextResponse.json({ ok: true, inserted, skipped, errors });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
