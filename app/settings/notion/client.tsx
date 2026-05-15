'use client';

import Link from 'next/link';

const CADENCE_REQUIRED = [
  { name: 'Name', type: 'title', purpose: 'Titre interne du post' },
  { name: 'Date de publication', type: 'date', purpose: 'Quand publier' },
  { name: 'Heure de publication', type: 'rich_text', purpose: 'Heure HH:MM' },
  { name: 'Pilier', type: 'select', purpose: 'Pilier éditorial' },
  { name: 'Tags', type: 'select', purpose: 'Statut Notion (Non publié / Publié)' },
  { name: 'URL', type: 'url', purpose: 'Lien LinkedIn après publication' },
  { name: 'Anonymisation OK', type: 'checkbox', purpose: 'Sécurité cas client' },
  { name: 'Visuel prêt', type: 'checkbox', purpose: 'Visuel disponible' }
];

const ACTION_LABELS: Record<string, { label: string; tone: 'brand'|'success'|'warn'|'danger'|'neutral' }> = {
  page_created:      { label: 'Création',          tone: 'brand'   },
  page_updated:      { label: 'Mise à jour',       tone: 'neutral' },
  content_replaced:  { label: 'Contenu remplacé',  tone: 'neutral' },
  marked_published:  { label: 'Marqué publié',     tone: 'success' },
  publish_failed:    { label: 'Échec publi',       tone: 'danger'  },
};

export default function NotionSettingsClient({ status, dbInfo, actions }: { status: any; dbInfo: any; actions: any[] }) {
  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900 tracking-tight">Notion · Mapping</h1>
          <p className="mt-1 text-sm text-ink-500 lead">Configuration de la database Cadence. Vos posts historiques restent visibles côté Notion mais Cadence ne les modifie jamais sans action explicite.</p>
        </div>
        <Link href="/sources" className="btn-ghost text-xs">← Retour aux sources</Link>
      </header>

      {/* Current DB */}
      <section className="card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-semibold text-ink-900">Database connectée</h2>
            <p className="text-xs text-ink-500 mt-0.5">Tous les drafts générés par Cadence atterrissent ici. Filtre « Créés par Cadence » dans la Bibliothèque pour les distinguer.</p>
          </div>
          {status.ok
            ? <span className="chip chip-success"><span className="dot bg-success-500" /> Accessible</span>
            : <span className="chip chip-danger"><span className="dot bg-danger-500" /> Erreur</span>}
        </div>
        {dbInfo ? (
          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            <div className="card p-3 bg-ink-50/40 border-ink-100">
              <div className="text-2xs uppercase tracking-wider font-semibold text-ink-500">Titre</div>
              <a href={dbInfo.url} target="_blank" rel="noopener" className="block mt-1 font-medium text-ink-900 hover:text-brand-700 truncate">{dbInfo.title} <span className="text-ink-400">↗</span></a>
            </div>
            <div className="card p-3 bg-ink-50/40 border-ink-100">
              <div className="text-2xs uppercase tracking-wider font-semibold text-ink-500">ID</div>
              <code className="block mt-1 text-xs text-ink-700 truncate font-mono">{dbInfo.id}</code>
            </div>
          </div>
        ) : (
          <div className="mt-3 card p-3 bg-danger-50/30 border-danger-100">
            <p className="text-sm text-danger-700">Impossible de récupérer la database.</p>
            <p className="text-xs text-ink-500 mt-1">Vérifiez les variables d'env <code className="font-mono bg-white px-1 rounded">NOTION_API_TOKEN</code> et <code className="font-mono bg-white px-1 rounded">NOTION_LINKEDIN_DS_ID</code> sur Vercel.</p>
          </div>
        )}
      </section>

      {/* Required columns check */}
      <section className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-ink-900">Colonnes requises par Cadence</h2>
          {dbInfo && (
            <span className="text-xs text-ink-500">
              {CADENCE_REQUIRED.filter(req => dbInfo.properties?.find((p: any) => p.name === req.name && p.type === req.type)).length}
              {' / '}
              {CADENCE_REQUIRED.length} OK
            </span>
          )}
        </div>
        <p className="text-xs text-ink-500 mb-4">Vérification que votre database expose les bonnes propriétés. Si l'une manque, créez-la côté Notion avec exactement le bon nom et type.</p>
        <div className="space-y-1.5">
          {CADENCE_REQUIRED.map(req => {
            const found = dbInfo?.properties?.find((p: any) => p.name === req.name);
            const typeOk = found && found.type === req.type;
            return (
              <div key={req.name} className="flex items-center gap-3 p-2.5 rounded-lg border border-ink-100 hover:border-ink-200 transition">
                <code className="font-mono text-xs text-ink-900 w-44 truncate">{req.name}</code>
                <code className="font-mono text-2xs text-ink-500 w-24 truncate">{req.type}</code>
                <span className="flex-1 text-xs text-ink-500 truncate">{req.purpose}</span>
                {!found && <span className="chip chip-danger"><span className="dot bg-danger-500" /> Manquante</span>}
                {found && !typeOk && <span className="chip chip-warn"><span className="dot bg-warn-500" /> Type {found.type}</span>}
                {found && typeOk && <span className="chip chip-success"><span className="dot bg-success-500" /> OK</span>}
              </div>
            );
          })}
        </div>
      </section>

      {/* What Cadence does / does NOT do */}
      <section className="grid sm:grid-cols-2 gap-3">
        <div className="card p-4 bg-success-50/30 border-success-100">
          <h3 className="font-semibold text-ink-900 text-sm flex items-center gap-2">
            <span className="dot bg-success-500" />
            Cadence FAIT
          </h3>
          <ul className="mt-2 text-xs text-ink-700 space-y-1.5">
            <li>• Crée des nouveaux drafts dans la DB</li>
            <li>• Met à jour le contenu d'un draft généré par Cadence</li>
            <li>• Marque un post comme « Publié » après publication LinkedIn</li>
            <li>• Lit les drafts pour le calendrier et le radar</li>
          </ul>
        </div>
        <div className="card p-4 bg-danger-50/30 border-danger-100">
          <h3 className="font-semibold text-ink-900 text-sm flex items-center gap-2">
            <span className="dot bg-danger-500" />
            Cadence NE FAIT JAMAIS
          </h3>
          <ul className="mt-2 text-xs text-ink-700 space-y-1.5">
            <li>• Modifier un post historique non créé par Cadence</li>
            <li>• Supprimer une page Notion</li>
            <li>• Publier sans la case « Validé pour cron » cochée</li>
            <li>• Toucher à votre structure de DB (colonnes, vues, filtres)</li>
          </ul>
        </div>
      </section>

      {/* Recent actions log */}
      <section className="card p-5">
        <h2 className="font-semibold text-ink-900">Activité récente</h2>
        <p className="text-xs text-ink-500 mt-0.5">Les 15 dernières actions Cadence sur votre database.</p>
        {actions.length === 0 ? (
          <div className="mt-4 text-center py-6 text-sm text-ink-500">Aucune activité enregistrée.</div>
        ) : (
          <ul className="mt-4 space-y-2">
            {actions.map((a: any) => {
              const meta = ACTION_LABELS[a.action] || { label: a.action, tone: 'neutral' as const };
              return (
                <li key={a.id} className="flex items-start gap-3 p-2.5 rounded-lg border border-ink-100">
                  <span className={`chip chip-${meta.tone} text-2xs whitespace-nowrap`}>{meta.label}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-ink-800 truncate">{a.detail || '—'}</div>
                    <div className="text-2xs text-ink-500 mt-0.5 flex items-center gap-2">
                      <span>{new Date(a.created_at).toLocaleString('fr-FR')}</span>
                      {a.notion_page_id && <code className="font-mono">{a.notion_page_id.slice(0, 8)}…</code>}
                    </div>
                  </div>
                  {a.url && <a href={a.url} target="_blank" rel="noopener" className="text-xs text-brand-700 hover:text-brand-800 font-medium whitespace-nowrap">Voir ↗</a>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
