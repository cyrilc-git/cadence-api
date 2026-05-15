import Link from 'next/link';
import LinkedInImportClient from './client';

export const dynamic = 'force-dynamic';

export default function ImportLinkedInPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900 tracking-tight">Importer mon historique LinkedIn</h1>
          <p className="mt-1 text-sm text-ink-500 lead">Récupérez vos posts publiés pour enrichir Bibliothèque, Analytics et le radar Suggestions.</p>
        </div>
        <Link href="/sources" className="btn-ghost text-xs">← Sources</Link>
      </header>

      <section className="card p-5">
        <h2 className="font-semibold text-ink-900">3 méthodes possibles</h2>
        <div className="mt-4 grid sm:grid-cols-3 gap-3 text-xs">
          <div className="card p-3 border-success-100 bg-success-50/30">
            <span className="chip chip-success"><span className="dot bg-success-500" /> Déjà actif</span>
            <div className="mt-2 font-semibold text-ink-900">API officielle</div>
            <p className="mt-1 text-ink-500">Posts créés via votre OAuth Cadence (depuis l'autorisation). Pas d'historique antérieur.</p>
          </div>
          <div className="card p-3 border-brand-100 bg-brand-50/30">
            <span className="chip chip-brand"><span className="dot bg-brand-500" /> Recommandé V8</span>
            <div className="mt-2 font-semibold text-ink-900">Export ZIP officiel</div>
            <p className="mt-1 text-ink-500">Téléchargez votre archive LinkedIn (Settings → Data Privacy → Get a copy of your data). Uploadez ici le <code className="font-mono bg-white px-1 rounded">Shares.csv</code>.</p>
          </div>
          <div className="card p-3 border-warn-100 bg-warn-50/30">
            <span className="chip chip-warn"><span className="dot bg-warn-500" /> Plus tard</span>
            <div className="mt-2 font-semibold text-ink-900">Tiers Shield/Inlytics</div>
            <p className="mt-1 text-ink-500">~10€/mois. Stats par post + tendances. Intégration future.</p>
          </div>
        </div>
      </section>

      <LinkedInImportClient />

      <section className="card p-4 bg-brand-50/40 border-brand-100 text-xs text-ink-700">
        <h3 className="font-semibold text-ink-900 text-sm">Comment obtenir votre export</h3>
        <ol className="mt-2 list-decimal list-inside space-y-1">
          <li>Allez sur <a href="https://www.linkedin.com/mypreferences/d/download-my-data" target="_blank" rel="noopener" className="text-brand-700 hover:underline">linkedin.com/mypreferences/d/download-my-data</a></li>
          <li>Cochez « Posts » (ou tout) puis « Request archive »</li>
          <li>LinkedIn vous envoie un email sous 10 min à 24h avec le ZIP</li>
          <li>Décompressez et uploadez ici le fichier <code className="font-mono bg-white px-1 rounded">Shares.csv</code></li>
        </ol>
      </section>
    </div>
  );
}
