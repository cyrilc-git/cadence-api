import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';

export default function ImportLinkedInPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-ink-900">Importer mon historique LinkedIn</h1>
        <p className="mt-1 text-ink-500">Récupérer vos posts publiés pour enrichir Bibliothèque, Analytics et le radar Suggestions.</p>
      </header>

      <section className="bg-warn-50 ring-1 ring-inset ring-warn-500/20 rounded-2xl p-5 text-sm">
        <h2 className="font-semibold text-ink-900">État actuel</h2>
        <p className="mt-2 text-warn-700">Aucun import effectué. L'API LinkedIn officielle restreint sévèrement la récupération de l'historique pour les comptes personnels.</p>
      </section>

      <section className="bg-white rounded-2xl p-6 shadow-card ring-1 ring-inset ring-ink-300/20">
        <h2 className="font-semibold text-ink-900">Ce qui est possible</h2>
        <table className="mt-4 w-full text-sm">
          <thead><tr className="text-xs text-ink-500 uppercase tracking-wide">
            <th className="text-left font-medium pb-2">Méthode</th>
            <th className="text-left font-medium pb-2">Données récupérables</th>
            <th className="text-left font-medium pb-2">Statut</th>
          </tr></thead>
          <tbody className="divide-y divide-ink-100">
            <tr>
              <td className="py-2 font-medium">API LinkedIn officielle (UGC Posts)</td>
              <td className="py-2 text-xs text-ink-500">Posts créés via votre OAuth uniquement (depuis l'autorisation Cadence). Pas d'historique antérieur.</td>
              <td className="py-2"><StatusBadge variant="success">Déjà actif</StatusBadge></td>
            </tr>
            <tr>
              <td className="py-2 font-medium">Export ZIP officiel LinkedIn</td>
              <td className="py-2 text-xs text-ink-500">Téléchargement personnel (Settings → Data Privacy → Get a copy of your data). Texte des posts + dates + URL. Pas de stats.</td>
              <td className="py-2"><StatusBadge variant="neutral">Manuel ZIP</StatusBadge></td>
            </tr>
            <tr>
              <td className="py-2 font-medium">Scrape via session cookie personnelle</td>
              <td className="py-2 text-xs text-ink-500">Posts + impressions + likes + commentaires + reposts. Uniquement votre compte. Zone grise.</td>
              <td className="py-2"><StatusBadge variant="warn">À implémenter</StatusBadge></td>
            </tr>
            <tr>
              <td className="py-2 font-medium">Tiers (Shield Analytics, Inlytics…)</td>
              <td className="py-2 text-xs text-ink-500">~10€/mois. Stats LinkedIn par post + tendances.</td>
              <td className="py-2"><StatusBadge variant="neutral">Externe payant</StatusBadge></td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="bg-white rounded-2xl p-6 shadow-card ring-1 ring-inset ring-ink-300/20">
        <h2 className="font-semibold text-ink-900">Plan d'import (à venir)</h2>
        <ol className="mt-3 list-decimal list-inside text-sm text-ink-700 space-y-2">
          <li>Téléchargez votre archive LinkedIn depuis l'export ZIP officiel.</li>
          <li>Uploadez le fichier <code>Shares.csv</code> ici (UI à venir V7.7).</li>
          <li>Cadence parse, dédoublonne, et enrichit Notion avec source = <code>linkedin_archive</code>.</li>
          <li>Aucun post existant n'est modifié sans validation explicite.</li>
        </ol>
        <button disabled className="mt-4 px-4 py-2 rounded-lg bg-ink-200 text-ink-500 text-sm font-medium cursor-not-allowed">Importer l'archive ZIP (V7.7)</button>
      </section>

      <div className="text-xs text-ink-500"><Link href="/settings" className="text-brand-700 hover:text-brand-600">← Retour aux connecteurs</Link></div>
    </div>
  );
}
