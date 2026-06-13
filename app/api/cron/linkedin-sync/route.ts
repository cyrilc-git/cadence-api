// V54 — Cron de synchro LinkedIn (DMA). Appele quotidiennement par Vercel
// (cf. vercel.json). INERTE tant qu'aucun token DMA n'est stocke : syncDma
// renvoie { skipped: 'no_dma_token' } et ne fait rien. Une fois Cyril consenti
// et le token enregistre (/api/sources/linkedin/dma), ce cron maintient la
// memoire a jour automatiquement : Changelog (nouveaux posts, fenetre 28j) +
// Snapshot au 1er passage (backfill historique).

import { NextRequest, NextResponse } from 'next/server';
import { syncDma } from '@/lib/linkedin-dma';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // single-user, pas de secret configure -> ouvert
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-cron-secret') || '';
  if (provided === secret) return true;
  if (req.headers.get('x-vercel-cron')) return true; // invocation cron Vercel
  return false;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const snapshot = req.nextUrl.searchParams.get('snapshot') === '1';
  try {
    const res = await syncDma({ snapshot });
    return NextResponse.json(res);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
