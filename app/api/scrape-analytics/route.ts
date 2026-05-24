import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// V12.7 §5 — Propage les analytics de content_items vers visual_items
// (via content_item_id). Le vrai scrape LinkedIn API arrive quand le scope
// r_member_social sera validé. En attendant, on synchronise les impressions
// déjà saisies dans Notion vers la couche visuelle pour que
// analyzeVisualMemory ait du signal réel à analyser.

function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

async function propagate(): Promise<{ ok: true; updated: number; checked: number; errors: number }> {
  const { data: items, error } = await supabase
    .from('content_items')
    .select('id, meta')
    .not('meta->impressions', 'is', null);
  if (error) throw new Error(error.message);

  let updated = 0, errors = 0;
  const list = items || [];
  for (const ci of list) {
    const meta = ci.meta as any;
    const impr = typeof meta?.impressions === 'number' ? meta.impressions : null;
    if (impr === null) continue;
    const likes = typeof meta?.likes === 'number' ? meta.likes : null;
    const comments = typeof meta?.comments === 'number' ? meta.comments : null;
    const shares = typeof meta?.shares === 'number' ? meta.shares : null;

    const { error: upErr } = await supabase
      .from('visual_items')
      .update({ impressions: impr, likes, comments, shares })
      .eq('content_item_id', ci.id);
    if (upErr) errors++;
    else updated++;
  }

  return { ok: true, updated, checked: list.length, errors };
}

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const res = await propagate();
    return NextResponse.json({ ...res, note: 'Propagation content_items -> visual_items. Vrai scrape LinkedIn API en attente du scope r_member_social.', ran_at: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // POST autorisé via COCKPIT_SECRET pour test manuel
  const cockpit = process.env.COCKPIT_SECRET;
  const h = req.headers.get('x-cockpit-secret') || req.headers.get('authorization') || '';
  const ok = (cockpit && (h === cockpit || h === `Bearer ${cockpit}`)) || cronAuthorized(req);
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const res = await propagate();
    return NextResponse.json({ ...res, ran_at: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
