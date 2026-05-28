import AiKeysClient from './client';
import { getCredential } from '@/lib/credentials';

export const dynamic = 'force-dynamic';

// V39.2 — Gestion des clés IA dans Sources. On utilise le compte de
// l'utilisateur (sa clé), pas le nôtre. Chaque moteur affiche son état
// (clé présente ou non) et l'utilisateur colle sa clé directement ici.
export default async function AiSourcesPage() {
  // Source de vérité d'état : getCredential (DB chiffrée + fallback env).
  const [anthropic, openai, gemini, replicate, stability, ideogram] = await Promise.all([
    getCredential('anthropic').catch(() => ({ value: null, source: 'missing' as const })),
    getCredential('openai').catch(() => ({ value: null, source: 'missing' as const })),
    getCredential('gemini').catch(() => ({ value: null, source: 'missing' as const })),
    getCredential('replicate').catch(() => ({ value: null, source: 'missing' as const })),
    getCredential('stability').catch(() => ({ value: null, source: 'missing' as const })),
    getCredential('ideogram').catch(() => ({ value: null, source: 'missing' as const })),
  ]);

  const initial = {
    anthropic: { present: !!anthropic.value, source: anthropic.source },
    openai: { present: !!openai.value, source: openai.source },
    gemini: { present: !!gemini.value, source: gemini.source },
    replicate: { present: !!replicate.value, source: replicate.source },
    stability: { present: !!stability.value, source: stability.source },
    ideogram: { present: !!ideogram.value, source: ideogram.source },
  };

  return <AiKeysClient initial={initial} />;
}
