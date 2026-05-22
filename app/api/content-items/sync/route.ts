// V10.1 — Shadow-write content_items depuis Notion + post_embeddings.
// POST /api/content-items/sync (idempotent). Sécurisé par COCKPIT_SECRET en header.

import { NextResponse } from 'next/server';
import { syncContentItems } from '@/lib/content-items';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function authorized(req: Request): boolean {
  const secret = process.env.COCKPIT_SECRET;
  if (!secret) return false;
  const header = req.headers.get('x-cockpit-secret') || req.headers.get('authorization') || '';
  return header === secret || header === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  try {
    if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const result = await syncContentItems({ limit: 500 });
    return NextResponse.json({ ok: true, ...result, ran_at: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
