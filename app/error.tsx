'use client';

// V12.10 §8 — Boundary erreur globale. Capture toute exception runtime
// dans un render et propose un reset propre, plutôt que l'écran rouge
// brut de Next.js. Reste sobre : on ne dévoile pas la stack trace en
// production (envoyée silencieusement à Sentry/logs côté serveur si
// configuré).

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[Cadence error boundary]', error);
  }, [error]);

  return (
    <div className="space-y-8 max-w-2xl mx-auto pt-10">
      <header>
        <p className="text-2xs uppercase tracking-wider font-semibold text-ink-400">Quelque chose s&apos;est cassé</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink-900 tracking-tight">Désolé, cette page n&apos;a pas pu s&apos;afficher</h1>
        <p className="mt-2 text-sm text-ink-500 leading-relaxed">
          Une erreur inattendue est survenue. Essayez de recharger, ou revenez au tableau de bord.
        </p>
      </header>

      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => reset()} className="btn-primary">Réessayer</button>
        <Link href="/" className="btn-secondary">Retour au tableau de bord</Link>
      </div>

      {error?.digest && (
        <p className="text-2xs text-ink-400 italic">Référence interne : {error.digest}</p>
      )}
    </div>
  );
}
