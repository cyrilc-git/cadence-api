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
  // V18.1 §fix — Auth en deux temps :
  // - Same-origin (UI Cadence depuis le navigateur authentifié) : allowed
  //   sans secret. On vérifie via le header `referer` ou `origin` qui
  //   matche le host de la requête.
  // - Cross-origin / cron externe : exige x-cockpit-secret si COCKPIT_SECRET
  //   est défini.
  // Single-user app, pas de session formelle — l'origine du browser suffit.
  const secret = process.env.COCKPIT_SECRET;
  const host = req.headers.get('host') || '';
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';
  const isSameOrigin =
    (origin && host && origin.includes(host)) ||
    (referer && host && referer.includes(host));
  if (secret && !isSameOrigin) {
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
