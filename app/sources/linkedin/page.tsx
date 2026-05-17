import Link from 'next/link';
import LinkedInImportClient from './client';

export const dynamic = 'force-dynamic';

// V9.1 §1 — Import LinkedIn premium
// Page sobre, prose-driven. La logique est dans client.tsx.

export default function ImportLinkedInPage() {
  return (
    <div className="space-y-10 max-w-3xl mx-auto">
      <header>
        <p className="text-2xs uppercase tracking-wider font-semibold text-ink-400">
          <Link href="/sources" className="hover:text-ink-700 transition">Sources</Link> · LinkedIn
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-ink-900 tracking-tight">Importez votre historique</h1>
        <p className="mt-2 text-sm text-ink-500 max-w-xl">
          Glissez l'archive ZIP officielle (ou directement Shares.csv). Cadence détecte vos patterns, reconstruit la mémoire éditoriale, et enrichit le radar.
        </p>
      </header>

      <LinkedInImportClient />

      {/* Comment obtenir l'archive — discret, en bas */}
      <section className="pt-6 border-t border-ink-100 text-xs text-ink-500 leading-relaxed">
        <strong className="text-ink-700 font-medium">Comment obtenir l'archive : </strong>
        Allez sur <a href="https://www.linkedin.com/mypreferences/d/download-my-data" target="_blank" rel="noopener" className="text-brand-700 hover:underline">linkedin.com/mypreferences/d/download-my-data</a>, cochez "Posts" puis "Request archive". LinkedIn envoie le ZIP par email sous 10 min à 24h. Tout est traité dans votre navigateur — rien n'est envoyé à Cadence avant validation.
      </section>
    </div>
  );
}
