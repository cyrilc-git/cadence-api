'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';

type DerivedStatus = 'all' | 'draft' | 'needs_validation' | 'scheduled' | 'late' | 'published' | 'recyclable';
const STATUS_LABEL: Record<DerivedStatus, string> = {
  all: 'Tous', draft: 'Brouillons', needs_validation: 'À valider',
  scheduled: 'Programmés', late: 'En retard', published: 'Publiés', recyclable: 'À recycler'
};
const STATUS_VARIANT: Record<DerivedStatus, 'neutral' | 'brand' | 'success' | 'danger' | 'warn'> = {
  all: 'neutral', draft: 'neutral', needs_validation: 'warn',
  scheduled: 'brand', late: 'danger', published: 'success', recyclable: 'brand'
};
function derive(p: any): DerivedStatus[] {
  const out: DerivedStatus[] = [];
  if (p.status === 'published') {
    out.push('published');
    // recyclable: published > 6 months ago
    if (p.scheduled_at && new Date(p.scheduled_at).getTime() < Date.now() - 1000*60*60*24*180) out.push('recyclable');
  } else if (p.status === 'draft' || !p.scheduled_at) {
    out.push('draft');
  } else if (p.late) {
    out.push('late');
  } else if (!p.validated) {
    out.push('needs_validation');
  } else {
    out.push('scheduled');
  }
  return out;
}
function primary(p: any): DerivedStatus { return derive(p)[0]; }

export default function PostsLibraryClient({ initial }: { initial: any[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const initialFilter = (params.get('status') as DerivedStatus) || 'all';
  const initialSource = (params.get('source') as 'all'|'cadence'|'historique') || 'all';
  const [filter, setFilter] = useState<DerivedStatus>(initialFilter);
  const [sourceFilter, setSourceFilter] = useState<'all'|'cadence'|'historique'>(initialSource);
  const [search, setSearch] = useState('');
  const [pilier, setPilier] = useState('all');

  useEffect(() => {
    const f = (params.get('status') as DerivedStatus) || 'all';
    if (f !== filter) setFilter(f);
    const sf = (params.get('source') as 'all'|'cadence'|'historique') || 'all';
    if (sf !== sourceFilter) setSourceFilter(sf);
  }, [params]);

  const piliers = useMemo(() => {
    const s = new Set<string>();
    initial.forEach(p => { if (p.pilier) s.add(p.pilier); });
    return Array.from(s);
  }, [initial]);

  const enriched = useMemo(() => initial.map(p => ({ ...p, derivedStatuses: derive(p), primaryStatus: primary(p) })), [initial]);

  const counts: Record<DerivedStatus, number> = useMemo(() => {
    const c: any = { all: enriched.length, draft: 0, needs_validation: 0, scheduled: 0, late: 0, published: 0, recyclable: 0 };
    for (const p of enriched) {
      for (const s of p.derivedStatuses) c[s]++;
    }
    return c;
  }, [enriched]);

  const sourceCounts = useMemo(() => {
    return {
      all: enriched.length,
      cadence: enriched.filter(p => p.cadence_source).length,
      historique: enriched.filter(p => !p.cadence_source).length
    };
  }, [enriched]);

  const filtered = enriched.filter(p => {
    if (filter !== 'all' && !p.derivedStatuses.includes(filter)) return false;
    if (sourceFilter === 'cadence' && !p.cadence_source) return false;
    if (sourceFilter === 'historique' && p.cadence_source) return false;
    if (pilier !== 'all' && p.pilier !== pilier) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function updateUrl(s: DerivedStatus, src: 'all'|'cadence'|'historique') {
    const usp = new URLSearchParams();
    if (s !== 'all') usp.set('status', s);
    if (src !== 'all') usp.set('source', src);
    router.replace(`/posts${usp.toString() ? '?' + usp.toString() : ''}`);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold text-ink-900">Bibliothèque</h1>
          <p className="mt-1 text-ink-500">Tous vos posts Notion, filtrables et consultables.</p>
        </div>
        <Link href="/posts/new" className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600">+ Nouveau</Link>
      </header>

      <div className="flex items-center gap-2 flex-wrap">
        {(['all','draft','needs_validation','scheduled','late','published','recyclable'] as DerivedStatus[]).map(s => (
          <button key={s} onClick={() => { setFilter(s); updateUrl(s, sourceFilter); }}
            className={`text-xs px-3 py-1.5 rounded-full ring-1 ring-inset transition ${filter === s ? 'bg-brand-50 text-brand-700 ring-brand-500/30' : 'bg-white text-ink-700 ring-ink-300/40 hover:bg-ink-50'}`}>
            {STATUS_LABEL[s]} <span className="text-ink-400">({counts[s]})</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-ink-500">Source :</span>
        {(['all','cadence','historique'] as const).map(s => (
          <button key={s} onClick={() => { setSourceFilter(s); updateUrl(filter, s); }}
            className={`text-xs px-3 py-1.5 rounded-full ring-1 ring-inset transition ${sourceFilter === s ? 'bg-brand-50 text-brand-700 ring-brand-500/30' : 'bg-white text-ink-700 ring-ink-300/40 hover:bg-ink-50'}`}>
            {s === 'all' ? 'Toutes' : s === 'cadence' ? 'Créé par Cadence' : 'Historique Notion'} <span className="text-ink-400">({sourceCounts[s]})</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher dans les titres…"
          className="px-3 py-2 rounded-lg ring-1 ring-ink-300 text-sm focus:ring-brand-500 focus:border-brand-500 flex-1 min-w-[200px]" />
        <select value={pilier} onChange={e => setPilier(e.target.value)} className="px-3 py-2 rounded-lg ring-1 ring-ink-300 text-sm">
          <option value="all">Tous piliers</option>
          {piliers.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <span className="text-xs text-ink-500 ml-auto">{filtered.length} / {enriched.length}</span>
      </div>

      {filtered.length === 0
        ? <EmptyState title="Aucun post" hint="Ajustez les filtres ou créez un nouveau post." />
        : <div className="grid gap-2">
            {filtered.map(p => (
              <Link key={p.id} href={`/posts/${p.id}/edit`} className="bg-white rounded-xl p-4 shadow-card ring-1 ring-inset ring-ink-300/20 hover:shadow-pop transition flex items-center gap-4">
                <StatusBadge variant={STATUS_VARIANT[p.primaryStatus as DerivedStatus]}>{STATUS_LABEL[p.primaryStatus as DerivedStatus]}</StatusBadge>
                {p.cadence_source && <span className="text-[10px] uppercase tracking-wide font-semibold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded">Cadence</span>}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-ink-900 truncate">{p.title}</div>
                  <div className="text-xs text-ink-500 flex items-center gap-2 mt-0.5 flex-wrap">
                    {p.pilier && <span>{p.pilier}</span>}
                    {p.scheduled_at && <span>· {new Date(p.scheduled_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })} {p.scheduled_time || ''}</span>}
                    {p.impressions ? <span>· {p.impressions.toLocaleString('fr-FR')} impressions</span> : null}
                  </div>
                </div>
                {p.derivedStatuses.includes('recyclable') && <Link href={`/posts/new?from=${p.id}&recycle=1`} onClick={e => e.stopPropagation()} className="text-xs px-2 py-1 rounded-lg bg-brand-500 text-white hover:bg-brand-600">Recycler</Link>}
                {p.linkedin_url && <a href={p.linkedin_url} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} className="text-xs text-brand-700 hover:text-brand-600 px-2 py-1">↗ LinkedIn</a>}
                <a href={p.notion_url} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} className="text-xs text-ink-500 hover:text-ink-700 px-2 py-1">↗ Notion</a>
              </Link>
            ))}
          </div>}
    </div>
  );
}
