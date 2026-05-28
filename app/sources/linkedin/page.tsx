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
        <p className="mt-2 text-sm text-ink-500 max-w-xl leading-relaxed">
          LinkedIn est la source de vérité de vos publications. L&apos;import ZIP officiel est aujourd&apos;hui la voie la plus fiable pour reconstruire votre mémoire éditoriale dans Cadence.
        </p>
      </header>

      <LinkedInImportClient />

      {/* Comment obtenir l'archive : discret, en bas */}
      <section className="pt-6 border-t border-ink-100 text-xs text-ink-500 leading-relaxed">
        <strong className="text-ink-700 font-medium">Comment obtenir l&apos;archive : </strong>
        Allez sur <a href="https://www.linkedin.com/mypreferences/d/download-my-data" target="_blank" rel="noopener" className="text-brand-700 hover:underline">linkedin.com/mypreferences/d/download-my-data</a>, choisissez «&nbsp;Want something in particular&nbsp;? Select the data files you&apos;re most interested in.&nbsp;» et cochez la case <strong className="text-ink-700">Posts</strong> (qui inclut le fichier <code className="text-ink-700">Shares.csv</code>, vos vrais posts du feed). Cliquez «&nbsp;Request archive&nbsp;». LinkedIn envoie le ZIP par email sous 10 min à 24&nbsp;h. Si vous ne voyez que vos articles longs, c&apos;est que vous avez pris l&apos;archive «&nbsp;Fast file only&nbsp;» qui ne contient pas les posts&nbsp;: relancez en mode complet. Tout est traité dans votre navigateur, rien n&apos;est envoyé à Cadence avant validation.
      </section>
    </div>
  );
}
