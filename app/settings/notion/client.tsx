'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { confirmDialog, toast } from '@/components/Dialog';

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
            Vos brouillons Cadence atterrissent dans <a href={dbInfo.url} target="_blank" rel="noopener" className="text-brand-700 hover:text-brand-900 transition font-medium">{dbInfo.title}</a> et restent visibles dans la <Link href="/posts" className="text-brand-700 hover:text-brand-900 transition">Bibliothèque</Link>.
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
            Connexion à Notion indisponible pour le moment.
          </p>
        )}
      </section>

      {/* V17.6 — Toggle sens de sync : Cadence -> Notion par défaut.
          Réactiver Notion -> Cadence si l'utilisateur veut que les
          brouillons saisis directement dans Notion remontent dans
          la Bibliothèque Cadence. */}
      <NotionReadToggle />

      {/* V18 §calendar-clean — Toggle d'affichage Notion dans le calendrier. */}
      <CalendarShowNotionToggle />

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
        <p className="text-xs text-ink-500 mb-4">Vérification que votre espace Notion contient les bonnes colonnes. Si l'une manque, créez-la côté Notion avec exactement le bon nom et type.</p>
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
            <li>• Crée de nouveaux brouillons dans votre espace Notion</li>
            <li>• Met à jour le contenu d'un brouillon généré par Cadence</li>
            <li>• Marque un post comme « Publié » après publication LinkedIn</li>
            <li>• Lit les brouillons pour alimenter le calendrier et la Bibliothèque</li>
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
            <li>• Publier sans votre validation explicite</li>
            <li>• Toucher à la structure de votre espace Notion (colonnes, vues, filtres)</li>
          </ul>
        </div>
      </section>

      {/* Recent actions log */}
      <section className="card p-5">
        <h2 className="font-semibold text-ink-900">Activité récente</h2>
        <p className="text-xs text-ink-500 mt-0.5">Les 15 dernières actions Cadence dans votre espace Notion.</p>
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


// V17.6 — Toggle pour réactiver la lecture Notion -> Cadence. Par défaut
// désactivé : Cadence ne lit plus les brouillons Notion automatiquement.
// L'utilisateur peut réactiver s'il veut que les posts écrits directement
// dans Notion remontent dans la Bibliothèque Cadence.
function NotionReadToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/design-system?key=notion.read_enabled', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const val = String(d?.value || '').toLowerCase().trim();
        setEnabled(val === 'true' || val === '1' || val === 'on');
      })
      .catch(() => setEnabled(false));
  }, []);

  async function toggle() {
    if (enabled === null) return;
    const next = !enabled;
    setSaving(true);
    try {
      const r = await fetch('/api/design-system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'notion.read_enabled', value: next ? 'true' : 'false', category: 'sync' }),
      });
      if (r.ok) {
        setEnabled(next);
        toast.success(next ? 'Lecture Notion activée' : 'Lecture Notion désactivée');
      } else {
        toast.error('Échec de la mise à jour');
      }
    } catch (e: any) {
      toast.error('Erreur : ' + e.message);
    } finally { setSaving(false); }
  }

  if (enabled === null) return null;

  return (
    <section className="border-l-2 border-ink-200 pl-4 py-1">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0 max-w-2xl">
          <h2 className="text-sm font-semibold text-ink-900">Sens de la synchronisation</h2>
          <p className="mt-1 text-xs text-ink-500 leading-relaxed">
            Cadence écrit toujours vers Notion à chaque sauvegarde et chaque publication.
            La lecture inverse (importer les brouillons que vous écrivez directement dans
            Notion) est <strong>{enabled ? 'activée' : 'désactivée'}</strong> par défaut.
          </p>
          <p className="mt-2 text-2xs text-ink-400 leading-relaxed">
            {enabled
              ? 'Vos brouillons Notion remontent dans la Bibliothèque Cadence toutes les 2h.'
              : 'Seuls les posts créés ou édités dans Cadence apparaissent dans la Bibliothèque. Notion reste la copie de travail, pas la source.'}
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={saving}
          className={`shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50 ${enabled ? 'bg-brand-500 text-white hover:bg-brand-700' : 'border border-ink-200 text-ink-700 hover:bg-ink-50'}`}
        >
          <span className={`inline-block w-2 h-2 rounded-full ${enabled ? 'bg-white' : 'bg-ink-300'}`} aria-hidden />
          {enabled ? 'Lecture activée' : 'Lecture désactivée'}
        </button>
      </div>
    </section>
  );
}

// V18 §calendar-clean — Toggle "Afficher les brouillons Notion dans le
// calendrier". Indépendant de notion.read_enabled : même quand on aspire
// les brouillons Notion dans content_items, on peut vouloir ne PAS les
// voir dans la vue calendrier (qui doit refléter la réalité éditoriale
// LinkedIn + Cadence par défaut).
function CalendarShowNotionToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/design-system?key=calendar.show_notion', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const val = String(d?.value || '').toLowerCase().trim();
        setEnabled(val === 'true' || val === '1' || val === 'on');
      })
      .catch(() => setEnabled(false));
  }, []);

  async function toggle() {
    if (enabled === null) return;
    const next = !enabled;
    setSaving(true);
    try {
      const r = await fetch('/api/design-system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'calendar.show_notion', value: next ? 'true' : 'false', category: 'sync' }),
      });
      if (r.ok) {
        setEnabled(next);
        toast.success(next ? 'Notion affiché dans le calendrier' : 'Notion masqué du calendrier');
      } else {
        toast.error('Échec de la mise à jour');
      }
    } catch (e: any) {
      toast.error('Erreur : ' + e.message);
    } finally { setSaving(false); }
  }

  if (enabled === null) return null;

  return (
    <section className="border-l-2 border-ink-200 pl-4 py-1">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0 max-w-2xl">
          <h2 className="text-sm font-semibold text-ink-900">Brouillons Notion dans le calendrier</h2>
          <p className="mt-1 text-xs text-ink-500 leading-relaxed">
            Par défaut, le calendrier n&apos;affiche que les posts LinkedIn vérifiés et ceux
            créés dans Cadence. Les brouillons qui ne vivent que dans Notion sont masqués
            pour ne pas saturer la vue.
          </p>
          <p className="mt-2 text-2xs text-ink-400 leading-relaxed">
            {enabled
              ? 'Le filtre "Brouillons Notion" est visible dans la barre de filtres du calendrier.'
              : 'Le calendrier reste concentré sur la réalité LinkedIn. Vous pouvez réactiver ici à tout moment.'}
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={saving}
          className={`shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50 ${enabled ? 'bg-brand-500 text-white hover:bg-brand-700' : 'border border-ink-200 text-ink-700 hover:bg-ink-50'}`}
        >
          <span className={`inline-block w-2 h-2 rounded-full ${enabled ? 'bg-white' : 'bg-ink-300'}`} aria-hidden />
          {enabled ? 'Notion affiché' : 'Notion masqué'}
        </button>
      </div>
    </section>
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
    const ok = await confirmDialog({
      title: 'Mettre à jour la mémoire ?',
      body: 'Cadence va lire vos posts Notion non encore mémorisés et les ajouter à la mémoire éditoriale (via votre clé OpenAI). Coût indicatif : ~0,001 $ pour 100 posts.',
      confirmLabel: 'Mettre à jour',
    });
    if (!ok) return;
    setIndexing(true); setLastResult(null);
    try {
      let total = 0, indexed = 0;
      for (let pass = 0; pass < 5; pass++) {
        setProgress(`Mémorisation en cours… (étape ${pass + 1}/5)`);
        const r = await fetch('/api/embeddings/index', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ limit: 30 }) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        total = d.total_in_db || total;
        indexed += d.indexed || 0;
        if ((d.indexed || 0) === 0) break; // nothing more to do
      }
      setLastResult(`${indexed} nouveaux posts ajoutés, ${total} au total dans la mémoire.`);
      if (indexed > 0) toast.success(`${indexed} post${indexed > 1 ? 's' : ''} ajouté${indexed > 1 ? 's' : ''} à la mémoire`);
      else toast.info('Tous les posts étaient déjà indexés');
      await refresh();
    } catch (e: any) {
      setLastResult('Erreur : ' + e.message);
      toast.error('Indexation interrompue : ' + e.message);
    } finally { setIndexing(false); setProgress(null); }
  }

  const pct = stats?.coverage_pct ?? 0;
  return (
    <section className="border-l-2 border-brand-300 pl-4 py-1">
      <h2 className="text-sm font-semibold text-ink-900">Mémoire éditoriale</h2>
      <p className="mt-1 text-xs text-ink-500 leading-relaxed">Cadence mémorise vos posts pour éviter les répétitions, repérer les sujets non couverts et mesurer la nouveauté d&apos;une idée.</p>
      {loading ? (
        <div className="mt-3 skeleton h-4 w-32" />
      ) : stats ? (
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-semibold text-ink-900 tabular-nums">{stats.indexed_total}</span>
              <span className="text-xs text-ink-500">/ {stats.notion_posts_total} posts en mémoire ({pct}%)</span>
            </div>
            <div className="mt-1.5 h-1 bg-ink-100 rounded-full overflow-hidden">
              <div className="h-full bg-brand-500 transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <button onClick={indexNow} disabled={indexing} className="text-xs px-3 py-1.5 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 disabled:opacity-50 transition">
            {indexing ? (<><span className="dot bg-white animate-pulse-soft" /> Mémorisation…</>) : 'Mettre à jour'}
          </button>
        </div>
      ) : null}
      {progress && <div className="mt-2 text-2xs text-ink-500">{progress}</div>}
      {lastResult && <div className="mt-2 text-xs text-success-700">{lastResult}</div>}
      <p className="mt-3 text-2xs text-ink-400 italic">La mémoire utilise votre clé OpenAI. Sans clé OpenAI connectée, elle reste vide.</p>
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
