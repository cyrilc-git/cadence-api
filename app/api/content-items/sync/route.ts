// V10.1 — Shadow-write content_items depuis Notion + post_embeddings.
// V10.7.1 — Auto-sync via Vercel cron toutes les 6h.
//
// POST /api/content-items/sync : appel manuel, protégé par COCKPIT_SECRET.
// GET  /api/content-items/sync : appel Vercel cron, protégé par CRON_SECRET.

import { NextResponse } from 'next/server';
import { syncContentItems } from '@/lib/content-items';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function cookpitAuthorized(req: Request): boolean {
  const secret = process.env.COCKPIT_SECRET;
  if (!secret) return false;
  const header = req.headers.get('x-cockpit-secret') || req.headers.get('authorization') || '';
  return header === secret || header === `Bearer ${secret}`;
}

function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

async function runSync() {
  const result = await syncContentItems({ limit: 500 });
  return { ok: true, ...result, ran_at: new Date().toISOString() };
}

export async function POST(req: Request) {
  try {
    if (!cookpitAuthorized(req) && !cronAuthorized(req)) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    return NextResponse.json(await runSync());
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    if (!cronAuthorized(req) && !cookpitAuthorized(req)) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    return NextResponse.json(await runSync());
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
