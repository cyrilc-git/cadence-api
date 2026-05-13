'use client';

import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';

const CADENCE_REQUIRED = [
  { name: 'Name', type: 'title', purpose: 'Titre interne du post' },
  { name: 'Date de publication', type: 'date', purpose: 'Quand publier' },
  { name: 'Heure de publication', type: 'text', purpose: 'Heure HH:MM' },
  { name: 'Pilier', type: 'select', purpose: 'Pilier éditorial' },
  { name: 'Tags', type: 'select', purpose: 'Statut Notion (Non publié / Publié)' },
  { name: 'URL', type: 'url', purpose: 'Lien LinkedIn après publication' },
  { name: 'Anonymisation OK', type: 'checkbox', purpose: 'Sécurité cas client' },
  { name: 'Visuel prêt', type: 'checkbox', purpose: 'Visuel disponible' }
];

export default function NotionSettingsClient({ status, dbInfo, actions }: { status: any; dbInfo: any; actions: any[] }) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-ink-900">Notion · Mapping</h1>
        <p className="mt-1 text-ink-500">Configuration de la database où Cadence écrit. Vos posts historiques restent visibles côté Notion mais Cadence ne les modifie jamais sans action explicite.</p>
      </header>

      {/* Current DB */}
      <section className="bg-white rounded-2xl p-6 shadow-card ring-1 ring-inset ring-ink-300/20">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-semibold text-ink-900">Database Cadence</h2>
            <p className="text-xs text-ink-500 mt-0.5">Tous les drafts générés par Cadence atterrissent ici. Filtre « Créé par Cadence » dans la Bibliothèque pour les distinguer de votre historique.</p>
          </div>
          {status.ok ? <StatusBadge variant="success">Accessible</StatusBadge> : <StatusBadge variant="danger">Erreur</StatusBadge>}
        </div>
        {dbInfo ? (
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-ink-500 text-xs">Titre :</span>
              <a href={dbInfo.url} target="_blank" rel="noopener" className="font-medium text-ink-900 hover:text-brand-700">{dbInfo.title} ↗</a>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-ink-500 text-xs">ID :</span>
              <code className="text-xs text-ink-700">{dbInfo.id}</code>
            </div>
          </div>
        ) : <p className="mt-3 text-sm text-danger-700">Impossible de récupérer la database. Vérifiez NOTION_API_TOKEN et NOTION_LINKEDIN_DS_ID.</p>}
      </section>

      {/* Required columns check */}
      <section className="bg-white rounded-2xl p-6 shadow-card ring-1 ring-inset ring-ink-300/20">
        <h2 className="font-semibold text-ink-900">Colonnes requises par Cadence</h2>
        <p className="text-xs text-ink-500 mt-0.5">Vérification que votre database expose les bonnes propriétés.</p>
        <table className="mt-4 w-full text-sm">
          <thead><tr className="text-xs text-ink-500 uppercase tracking-wide">
            <th className="text-left font-medium pb-2">Colonne attendue</th>
            <th className="text-left font-medium pb-2">Type</th>
            <th className="text-left font-medium pb-2">Rôle</th>
            <th className="text-left font-medium pb-2">Statut</th>
          </tr></thead>
          <tbody className="divide-y divide-ink-100">
            {CADENCE_REQUIRED.map(req => {
              const found = dbInfo?.properties?.find((p: any) => p.name === req.name);
              const typeOk = found && found.type === req.type;
              return (
                <tr key={req.name}>
                  <td className="py-2 font-mono text-xs text-ink-900">{req.name}</td>
                  <td className="py-2 text-xs text-ink-500">{req.type}</td>
                  <td className="py-2 text-xs text-ink-500">{req.purpose}</td>
                  <td className="py-2">
                    {!found ? <StatusBadge variant="danger">Manquante</StatusBadge> :
                     typeOk   ? <StatusBadge variant="success">OK</StatusBadge> :
                                <StatusBadge variant="warn">Type {found.type}</StatusBadge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-ink-500">Si une colonne manque ou a un mauvais type, ajoutez-la dans Notion. Cadence n'auto-crée pas les colonnes pour éviter d'altérer votre schéma.</p>
      </section>

      {/* Cadence-only marker info */}
      <section className="bg-brand-50/50 ring-1 ring-inset ring-brand-500/20 rounded-2xl p-6">
        <h2 className="font-semibold text-ink-900">Distinguer historique vs Cadence</h2>
        <p className="mt-2 text-sm text-ink-700">Cadence stocke côté Supabase (table <code>cadence_drafts</code>) la liste des pages Notion qu'elle a créées. Cela permet :</p>
        <ul className="mt-2 list-disc list-inside text-sm text-ink-700 space-y-1">
          <li>Filtrer « Créé par Cadence » dans la Bibliothèque sans modifier votre schéma Notion</li>
          <li>Ne jamais toucher à vos posts historiques sauf action explicite</li>
          <li>Distinguer dans le calendrier les drafts générés vs vos posts existants</li>
        </ul>
        <p className="mt-3 text-xs text-ink-500">Future V7.7 : wizard de création de DB Cadence dédiée si vous voulez séparer complètement.</p>
      </section>

      {/* Actions log */}
      <section className="bg-white rounded-2xl p-6 shadow-card ring-1 ring-inset ring-ink-300/20">
        <h2 className="font-semibold text-ink-900">10 dernières actions Notion par Cadence</h2>
        {actions.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500 italic">Aucune action enregistrée pour l'instant.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {actions.map((a: any) => (
              <li key={a.id} className="flex items-start gap-3 text-sm">
                <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded bg-ink-100 text-ink-700">{a.action}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-ink-700">{a.detail || '—'}</div>
                  <div className="text-xs text-ink-500">{new Date(a.created_at).toLocaleString('fr-FR')} {a.notion_page_id && <code className="ml-2">{a.notion_page_id.slice(0, 8)}…</code>}</div>
                </div>
                {a.url && <a href={a.url} target="_blank" rel="noopener" className="text-xs text-brand-700 hover:text-brand-600">↗</a>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="text-xs text-ink-500">
        <Link href="/settings" className="text-brand-700 hover:text-brand-600">← Retour aux connecteurs</Link>
      </div>
    </div>
  );
}
