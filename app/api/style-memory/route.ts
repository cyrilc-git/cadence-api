// V18.1 + V18.2 — API mémoire stylistique
//
// GET  -> retourne la StyleMemory courante (ou null si aucune)
// POST -> recompute depuis les posts LinkedIn confirmés (utile en webhook
//         publication ou via cron). Authentifié par x-cockpit-secret si
//         déclenché de l'extérieur.

import { NextRequest, NextResponse } from 'next/server';
import { readStyleMemory, recomputeStyleMemory } from '@/lib/style-memory';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const mem = await readStyleMemory();
    return NextResponse.json({ memory: mem });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Auth simple : si on a un COCKPIT_SECRET en env, on l'exige pour les
  // appels externes. Sinon ouvert (single-user app).
  const secret = process.env.COCKPIT_SECRET;
  if (secret) {
    const provided = req.headers.get('x-cockpit-secret') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (provided !== secret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }
  try {
    const res = await recomputeStyleMemory();
    if (!res.ok) return NextResponse.json({ error: res.error || 'recompute failed' }, { status: 500 });
    const mem = await readStyleMemory();
    return NextResponse.json({ ok: true, analyzed: res.analyzed, memory: mem });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
