// V39.1 — Disponibilité des moteurs IA.
//
// GET → { engines: { 'claude-design': bool, openai: bool, gemini: bool } }
//
// Source de vérité : getCredential() qui regarde DB chiffrée PUIS env var.
// Donc un moteur est "disponible" si l'utilisateur a renseigné sa clé
// (dans /sources/ai) OU si une clé existe en variable d'environnement.
// On n'expose JAMAIS la clé, seulement un booléen.

import { NextResponse } from 'next/server';
import { getCredential } from '@/lib/credentials';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [anthropic, openai, gemini, replicate, stability, ideogram] = await Promise.all([
      getCredential('anthropic').catch(() => ({ value: null })),
      getCredential('openai').catch(() => ({ value: null })),
      getCredential('gemini').catch(() => ({ value: null })),
      getCredential('replicate').catch(() => ({ value: null })),
      getCredential('stability').catch(() => ({ value: null })),
      getCredential('ideogram').catch(() => ({ value: null })),
    ]);
    return NextResponse.json({
      engines: {
        'claude-design': !!anthropic.value,
        openai: !!openai.value,
        gemini: !!gemini.value,
        replicate: !!replicate.value,
        stability: !!stability.value,
        ideogram: !!ideogram.value,
      },
    });
  } catch (e: any) {
    // En cas d'erreur, on renvoie tout indisponible plutôt que de planter
    // l'UI : le dropdown grisera tout et invitera à connecter.
    return NextResponse.json({ engines: { 'claude-design': false, openai: false, gemini: false, replicate: false, stability: false, ideogram: false }, error: e?.message }, { status: 200 });
  }
}
