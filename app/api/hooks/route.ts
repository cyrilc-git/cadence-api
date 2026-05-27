// V25.3 — Hook generator endpoint
//
// POST { topic, pilier?, voiceMode? }
// → 200 { hooks: [{ angle, line1, line2 }, ...] } (6 hooks)
// → 4xx/5xx avec error explicite
//
// Aucun side-effect : pas de persist, pas de log du brief utilisateur.
// L'utilisateur consomme la liste côté client, choisit ou ignore.

import { NextResponse } from 'next/server';
import { generateHooks } from '@/lib/anthropic';
import { readStyleMemory } from '@/lib/style-memory';

export const runtime = 'nodejs';
export const maxDuration = 20;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
    if (topic.length < 4) {
      return NextResponse.json({ error: 'Précisez un sujet (au moins 4 caractères).' }, { status: 400 });
    }
    if (topic.length > 400) {
      return NextResponse.json({ error: 'Sujet trop long (max 400 caractères).' }, { status: 400 });
    }

    // Injecte la signature stylistique si on a un corpus suffisant.
    let styleSummary: string | null = null;
    try {
      const mem = await readStyleMemory();
      if (mem && mem.posts_analyzed >= 5) styleSummary = mem.voice_summary || null;
    } catch { /* silent — style_memory peut ne pas exister */ }

    const { hooks } = await generateHooks({
      topic,
      pilier: typeof body.pilier === 'string' ? body.pilier : undefined,
      voiceMode: body.voiceMode,
      styleSummary,
    });

    return NextResponse.json({ hooks });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Génération impossible.' }, { status: 500 });
  }
}
