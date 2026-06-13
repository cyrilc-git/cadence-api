// V54 — Connexion + diagnostic LinkedIn DMA.
//
// GET            -> statut { connected, cursor, expires_at }
// GET ?probe=1   -> sonde : forme reelle des reponses Snapshot/Changelog
//                   (pour confirmer les 3 CONFIRM). N'ingere rien.
// POST {access_token,...}        -> stocke le token (active la synchro)
// POST {action:'snapshot'}       -> lance le rattrapage historique (Snapshot)
//
// Auth : same-origin (UI Cadence) OU x-cockpit-secret. Tout passe par cette
// route same-origin pour que l'UI puisse tout piloter sans secret.

import { NextRequest, NextResponse } from 'next/server';
import { getDmaStatus, setDmaToken, probeDma, syncDma } from '@/lib/linkedin-dma';

export const runtime = 'nodejs';
export const maxDuration = 300;
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

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('probe') === '1') {
    if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return NextResponse.json(await probeDma());
  }
  return NextResponse.json(await getDmaStatus());
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const b = await req.json().catch(() => ({} as any));

  // Declencheur de rattrapage historique (Snapshot).
  if (b?.action === 'snapshot' || b?.snapshot === true) {
    const res = await syncDma({ snapshot: true });
    return NextResponse.json(res);
  }

  // Enregistrement du token.
  if (!b?.access_token) return NextResponse.json({ error: 'access_token requis' }, { status: 400 });
  const expires_at = b.expires_in ? new Date(Date.now() + Number(b.expires_in) * 1000).toISOString() : undefined;
  await setDmaToken({
    access_token: String(b.access_token).trim(),
    refresh_token: b.refresh_token ? String(b.refresh_token) : undefined,
    expires_at,
  });
  return NextResponse.json({ ok: true, connected: true });
}
