// V54 — Enregistrement du token DMA (active la synchro automatique).
//
// GET  -> { connected: bool } (un token est-il stocke ?)
// POST -> { access_token, refresh_token?, expires_in? } : stocke le token DMA
//         genere via l'outil OAuth LinkedIn (scope r_dma_portability_self_serve).
//         Des qu'il est present, le cron /api/cron/linkedin-sync devient actif.

import { NextRequest, NextResponse } from 'next/server';
import { getDmaToken, setDmaToken } from '@/lib/linkedin-dma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authed(req: NextRequest): boolean {
  const secret = process.env.COCKPIT_SECRET;
  if (!secret) return true;
  const host = req.headers.get('host') || '';
  const o = req.headers.get('origin') || req.headers.get('referer') || '';
  if (host && o.includes(host)) return true; // same-origin UI
  const provided = req.headers.get('x-cockpit-secret') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  return provided === secret;
}

export async function GET() {
  const t = await getDmaToken();
  return NextResponse.json({ connected: !!t });
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const b = await req.json();
    if (!b?.access_token) return NextResponse.json({ error: 'access_token requis' }, { status: 400 });
    const expires_at = b.expires_in ? new Date(Date.now() + Number(b.expires_in) * 1000).toISOString() : undefined;
    await setDmaToken({
      access_token: String(b.access_token),
      refresh_token: b.refresh_token ? String(b.refresh_token) : undefined,
      expires_at,
    });
    return NextResponse.json({ ok: true, connected: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
