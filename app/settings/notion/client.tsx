'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

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
          <p className="text-2xs uppercase tracking-wider font-semibold text-ink-400">Sources · Notion</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink-900 tracking-tight">Espace de travail éditorial</h1>
          <p className="mt-2 text-sm text-ink-500 leading-relaxed max-w-2xl">Vos brouillons, validations, planification et notes vivent ici. LinkedIn reste la source des publications réellement publiées.</p>
        </div>
        <Link href="/sources" className="text-xs text-ink-500 hover:text-ink-900 transition">← Sources</Link>
      </header>

      {/* V11.4 §6 — Database : prose calme, plus de nested cards admin */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <span className={`w-1.5 h-1.5 rounded-full ${status.ok ? 'bg-emerald-500' : 'bg-danger-500'}`} aria-hidden />
          <span className="text-2xs uppercase tracking-wider font-semibold text-ink-500">{status.ok ? 'Connecté' : 'Erreur'}</span>
        </div>
        {dbInfo ? (
          <p className="text-sm text-ink-700 leading-relaxed">
            Database <a href={dbInfo.url} target="_blank" rel="noopener" className="text-brand-700 hover:text-brand-900 transition font-medium">{dbInfo.title}</a>.
            {' '}Les brouillons générés par Cadence y atterrissent et restent filtrables dans la <Link href="/posts?provenance=cadence_generated" className="text-brand-700 hover:text-brand-900 transition">Bibliothèque</Link>.
            {' '}
            <button
              onClick={() => navigator.clipboard?.writeText(dbInfo.id)}
              className="text-ink-500 hover:text-ink-900 transition underline decoration-dotted underline-offset-2"
              title="Copier l'identifiant complet dans le presse-papier"
            >
              copier l&apos;identifiant
            </button>
          </p>
        ) : (
          <p className="text-sm text-danger-700 leading-relaxed">
            Impossible d&apos;atteindre la database Notion. Vérifiez vos credentials dans <Link href="/settings" className="underline">Paramètres</Link>.
          </p>
        )}
      </section>

      {/* Editorial memory — V8.1 */}
      <EditorialMemoryCard />

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
                <span className="text-sm font-medium text-ink-900 w-44 truncate">{req.name}</span>
                <span className="text-2xs text-ink-400 w-24 truncate">{humanType(req.type)}</span>
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
                    <div className="text-sm text-ink-800 truncate">{a.detail || 'Action'}</div>
                    <div className="text-2xs text-ink-500 mt-0.5">
                      {new Date(a.created_at).toLocaleString('fr-FR')}
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


function EditorialMemoryCard() {
  const [stats, setStats] = useState<{ indexed_total: number; notion_posts_total: number; coverage_pct: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [indexing, setIndexing] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch('/api/embeddings/status', { cache: 'no-store' });
      if (r.ok) setStats(await r.json());
    } finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  async function indexNow() {
    if (!confirm('Indexer vos posts Notion ? Cadence va lire le contenu et créer des embeddings via OpenAI (~$0.001 pour 100 posts).')) return;
    setIndexing(true); setLastResult(null);
    try {
      let total = 0, indexed = 0;
      for (let pass = 0; pass < 5; pass++) {
        setProgress(`Pass ${pass + 1}/5 : indexation par lots de 30…`);
        const r = await fetch('/api/embeddings/index', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ limit: 30 }) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        total = d.total_in_db || total;
        indexed += d.indexed || 0;
        if ((d.indexed || 0) === 0) break; // nothing more to do
      }
      setLastResult(`${indexed} nouveaux posts indexés, ${total} au total dans la mémoire.`);
      await refresh();
    } catch (e: any) {
      setLastResult('Erreur : ' + e.message);
    } finally { setIndexing(false); setProgress(null); }
  }

  const pct = stats?.coverage_pct ?? 0;
  return (
    <section className="card p-5 bg-gradient-to-br from-brand-50/40 to-white border-brand-100">
      <div className="flex-1 min-w-0">
        <h2 className="font-semibold text-ink-900">Mémoire éditoriale</h2>
          <p className="text-xs text-ink-500 mt-0.5">Cadence indexe vos posts (titre + contenu) en vecteurs sémantiques. Ça permet : éviter les répétitions, détecter les sujets non couverts, scorer la nouveauté d'une idée, faire de la recherche sémantique.</p>
          {loading ? (
            <div className="mt-3 skeleton h-4 w-32" />
          ) : stats ? (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-semibold text-ink-900 tabular-nums">{stats.indexed_total}</span>
                  <span className="text-xs text-ink-500">/ {stats.notion_posts_total} posts indexés ({pct}%)</span>
                </div>
                <div className="mt-1 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <button onClick={indexNow} disabled={indexing} className="btn-primary text-xs">
                {indexing ? (<><span className="dot bg-white animate-pulse-soft" /> Indexation…</>) : 'Indexer maintenant'}
              </button>
            </div>
          ) : null}
          {progress && <div className="mt-2 text-2xs text-ink-500">{progress}</div>}
          {lastResult && <div className="mt-2 text-xs text-success-700">{lastResult}</div>}
      </div>
      <p className="mt-3 text-2xs text-ink-400">Modèle : OpenAI text-embedding-3-small (1536 dims, indexé HNSW pgvector). Coût : ~$0.02 / million de tokens, pas d'OpenAI = pas d'embedding.</p>
    </section>
  );
}


function humanType(t: string): string {
  return ({
    'title': 'Titre',
    'rich_text': 'Texte',
    'date': 'Date',
    'select': 'Choix',
    'multi_select': 'Choix multiples',
    'url': 'Lien',
    'checkbox': 'Booléen',
    'number': 'Nombre',
    'people': 'Personne',
    'files': 'Fichier'
  } as Record<string,string>)[t] || t;
}
