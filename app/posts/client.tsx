'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type DerivedStatus = 'all' | 'draft' | 'needs_validation' | 'scheduled' | 'late' | 'published' | 'recyclable';
const STATUS_LABEL: Record<DerivedStatus, string> = {
  all: 'Tous', draft: 'Brouillons', needs_validation: 'À valider',
  scheduled: 'Programmés', late: 'En retard', published: 'Publiés', recyclable: 'À recycler'
};
const STATUS_CHIP: Record<DerivedStatus, string> = {
  all: 'chip-neutral', draft: 'chip-neutral', needs_validation: 'chip-warn',
  scheduled: 'chip-brand', late: 'chip-danger', published: 'chip-success', recyclable: 'chip-brand'
};
const STATUS_DOT: Record<DerivedStatus, string> = {
  all: 'bg-ink-400', draft: 'bg-ink-400', needs_validation: 'bg-warn-500',
  scheduled: 'bg-brand-500', late: 'bg-danger-500', published: 'bg-success-500', recyclable: 'bg-brand-500'
};
function derive(p: any): DerivedStatus[] {
  const out: DerivedStatus[] = [];
  if (p.status === 'published') {
    out.push('published');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const piliers = useMemo(() => {
    const s = new Set<string>();
    initial.forEach(p => { if (p.pilier) s.add(p.pilier); });
    return Array.from(s);
  }, [initial]);

  const enriched = useMemo(() => initial.map(p => ({ ...p, derivedStatuses: derive(p), primaryStatus: primary(p) })), [initial]);

  const counts: Record<DerivedStatus, number> = useMemo(() => {
    const c: any = { all: enriched.length, draft: 0, needs_validation: 0, scheduled: 0, late: 0, published: 0, recyclable: 0 };
    for (const p of enriched) { for (const s of p.derivedStatuses) c[s]++; }
    return c;
  }, [enriched]);

  const sourceCounts = useMemo(() => ({
    all: enriched.length,
    cadence: enriched.filter(p => p.cadence_source).length,
    historique: enriched.filter(p => !p.cadence_source).length
  }), [enriched]);

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
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900 tracking-tight">Bibliothèque</h1>
          <p className="mt-1 text-sm text-ink-500 lead">Tous vos posts Notion, filtrables. Cliquez pour éditer.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/posts/new" className="btn-primary">+ Nouveau post</Link>
        </div>
      </header>

      {/* Status filter chips */}
      <div className="card p-3 flex items-center gap-1.5 flex-wrap overflow-x-auto">
        {(['all','draft','needs_validation','scheduled','late','published','recyclable'] as DerivedStatus[]).map(s => (
          <button
            key={s}
            onClick={() => { setFilter(s); updateUrl(s, sourceFilter); }}
            className={`text-xs px-3 py-1.5 rounded-full border transition flex items-center gap-1.5 ${filter === s ? 'bg-brand-50 text-brand-700 border-brand-300 font-semibold' : 'bg-white text-ink-700 border-ink-200 hover:bg-ink-50'}`}
          >
            <span className={`dot ${STATUS_DOT[s]}`} />
            {STATUS_LABEL[s]}
            <span className={filter === s ? 'text-brand-600' : 'text-ink-400'}>{counts[s]}</span>
          </button>
        ))}
      </div>

      {/* Source + search + pilier */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex bg-ink-100 rounded-lg p-0.5 gap-0.5">
          {(['all','cadence','historique'] as const).map(s => (
            <button key={s} onClick={() => { setSourceFilter(s); updateUrl(filter, s); }} className={`text-xs px-2.5 py-1 rounded-md font-medium transition ${sourceFilter === s ? 'bg-white text-ink-900 shadow-xs' : 'text-ink-500 hover:text-ink-700'}`}>
              {s === 'all' ? 'Toutes' : s === 'cadence' ? 'Créés par Cadence' : 'Historique Notion'}
              <span className="ml-1 text-ink-400">{sourceCounts[s]}</span>
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[200px] relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.3-4.3"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher dans les titres…" className="input text-sm pl-9" />
        </div>
        <select value={pilier} onChange={e => setPilier(e.target.value)} className="input text-sm w-auto">
          <option value="all">Tous piliers</option>
          {piliers.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <span className="text-xs text-ink-500 ml-auto whitespace-nowrap">{filtered.length} / {enriched.length}</span>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="card p-10 text-center text-sm text-ink-500">
          <p className="font-medium text-ink-700">Aucun post.</p>
          <p className="mt-1">Ajustez les filtres ou créez un nouveau post.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <Link key={p.id} href={`/posts/${p.id}/edit`} className="card card-hover p-4 flex items-center gap-3 group">
              <span className={`chip ${STATUS_CHIP[p.primaryStatus as DerivedStatus]} shrink-0`}>
                <span className={`dot ${STATUS_DOT[p.primaryStatus as DerivedStatus]}`} />
                {STATUS_LABEL[p.primaryStatus as DerivedStatus]}
              </span>
              {p.cadence_source && <span className="chip chip-brand shrink-0 text-2xs">✨ Cadence</span>}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-ink-900 truncate group-hover:text-brand-700 transition">{p.title}</div>
                <div className="text-xs text-ink-500 flex items-center gap-2 mt-0.5 flex-wrap">
                  {p.pilier && <span>{p.pilier}</span>}
                  {p.scheduled_at && <span>· {new Date(p.scheduled_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })} {p.scheduled_time?.slice(0,5) || ''}</span>}
                  {p.impressions ? <span>· {p.impressions.toLocaleString('fr-FR')} impressions</span> : null}
                </div>
              </div>
              {p.derivedStatuses.includes('recyclable') && (
                <Link href={`/posts/new?from=${p.id}&recycle=1`} onClick={e => e.stopPropagation()} className="btn-secondary text-xs">Recycler</Link>
              )}
              {p.linkedin_url && <a href={p.linkedin_url} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} className="btn-ghost text-2xs">LinkedIn ↗</a>}
              <a href={p.notion_url} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} className="btn-ghost text-2xs">Notion ↗</a>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
