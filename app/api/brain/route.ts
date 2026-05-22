// V11.4 §9 — API publique de lecture de l'état mémoire éditorial.
// GET /api/brain : renvoie le BrainState complet en JSON. Utile pour :
// - intégrations futures (Slack bot "récap hebdo", n8n, Zapier...)
// - widgets externes
// - tests E2E qui veulent vérifier la santé du Cerveau

import { NextResponse } from 'next/server';
import { computeBrainState } from '@/lib/brain';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const brain = await computeBrainState();
    return NextResponse.json({ ok: true, brain, generated_at: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
