'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ProvenanceBadge from '@/components/ProvenanceBadge';
import { inferFromNotion, type Provenance, type SourceType } from '@/lib/provenance';

// V9.2 §2.4 — Bibliothèque alignée sur la provenance réelle.
// Règle clé : un post Notion publié SANS URL LinkedIn est "Archive Notion", pas "Publié".

type DerivedStatus = 'all' | 'draft' | 'needs_validation' | 'scheduled' | 'late' | 'published' | 'archive' | 'recyclable';
const STATUS_LABEL: Record<DerivedStatus, string> = {
  all: 'Tous',
  draft: 'Brouillons',
  needs_validation: 'À valider',
  scheduled: 'Programmés',
  late: 'En retard',
  published: 'Publiés LinkedIn',
  archive: 'Archives Notion',
  recyclable: 'À recycler',
};
const STATUS_CHIP: Record<DerivedStatus, string> = {
  all: 'chip-neutral', draft: 'chip-neutral', needs_validation: 'chip-warn',
  scheduled: 'chip-brand', late: 'chip-danger', published: 'chip-success',
  archive: 'chip-neutral', recyclable: 'chip-brand',
};
const STATUS_DOT: Record<DerivedStatus, string> = {
  all: 'bg-ink-400', draft: 'bg-ink-400', needs_validation: 'bg-warn-500',
  scheduled: 'bg-brand-500', late: 'bg-danger-500', published: 'bg-success-500',
  archive: 'bg-amber-500', recyclable: 'bg-brand-500',
};

type ProvenanceFilter = 'all' | SourceType;
const PROVENANCE_FILTERS: { key: ProvenanceFilter; label: string }[] = [
  { key: 'all', label: 'Toutes provenances' },
  { key: 'linkedin_published', label: 'Publiés LinkedIn' },
  { key: 'linkedin_import_zip', label: 'Imports LinkedIn' },
  { key: 'notion_draft', label: 'Brouillons Notion' },
  { key: 'notion_archive', label: 'Archives Notion' },
  { key: 'cadence_generated', label: 'Créés par Cadence' },
];

function derive(p: any, prov: Provenance): DerivedStatus[] {
  const out: DerivedStatus[] = [];
  // "Publiés" devient strictement "publié confirmé sur LinkedIn".
  if (prov.source_type === 'linkedin_published' || prov.source_type === 'linkedin_import_zip') {
    out.push('published');
    if (p.scheduled_at && new Date(p.scheduled_at).getTime() < Date.now() - 1000 * 60 * 60 * 24 * 180) {
      out.push('recyclable');
    }
  } else if (prov.source_type === 'notion_archive') {
    out.push('archive');
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
function primary(statuses: DerivedStatus[]): DerivedStatus { return statuses[0]; }

export default function PostsLibraryClient({ initial }: { initial: any[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const initialFilter = (params.get('status') as DerivedStatus) || 'all';
  const initialProvenance = (params.get('provenance') as ProvenanceFilter) || 'all';
  const [filter, setFilter] = useState<DerivedStatus>(initialFilter);
  const [provFilter, setProvFilter] = useState<ProvenanceFilter>(initialProvenance);
  const [search, setSearch] = useState('');
  const [pilier, setPilier] = useState('all');

  useEffect(() => {
    const f = (params.get('status') as DerivedStatus) || 'all';
    if (f !== filter) setFilter(f);
    const pf = (params.get('provenance') as ProvenanceFilter) || 'all';
    if (pf !== provFilter) setProvFilter(pf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const piliers = useMemo(() => {
    const s = new Set<string>();
    initial.forEach(p => { if (p.pilier) s.add(p.pilier); });
    return Array.from(s);
  }, [initial]);

  const enriched = useMemo(() => initial.map(p => {
    const provenance = inferFromNotion({
      id: p.id,
      title: p.title,
      status: p.status,
      linkedin_url: p.linkedin_url,
      notion_url: p.notion_url,
      scheduled_at: p.scheduled_at,
      validated: p.validated,
      cadence_source: p.cadence_source,
    });
    const derivedStatuses = derive(p, provenance);
    return { ...p, provenance, derivedStatuses, primaryStatus: primary(derivedStatuses) };
  }), [initial]);

  const counts: Record<DerivedStatus, number> = useMemo(() => {
    const c: any = { all: enriched.length, draft: 0, needs_validation: 0, scheduled: 0, late: 0, published: 0, archive: 0, recyclable: 0 };
    for (const p of enriched) { for (const s of p.derivedStatuses) c[s]++; }
    return c;
  }, [enriched]);

  const provCounts: Record<ProvenanceFilter, number> = useMemo(() => {
    const c: any = { all: enriched.length };
    for (const f of PROVENANCE_FILTERS) {
      if (f.key === 'all') continue;
      c[f.key] = enriched.filter(p => p.provenance?.source_type === f.key).length;
    }
    return c;
  }, [enriched]);

  const filtered = enriched.filter(p => {
    if (filter !== 'all' && !p.derivedStatuses.includes(filter)) return false;
    if (provFilter !== 'all' && p.provenance?.source_type !== provFilter) return false;
    if (pilier !== 'all' && p.pilier !== pilier) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (filter === 'published') {
      list.sort((a, b) => (b.impressions || 0) - (a.impressions || 0));
    } else {
      list.sort((a, b) => (b.scheduled_at || '').localeCompare(a.scheduled_at || ''));
    }
    return list;
  }, [filtered, filter]);

  const grouped = useMemo(() => {
    if (filter === 'published') return null;
    const groups: { key: string; label: string; items: typeof sorted }[] = [];
    for (const p of sorted) {
      let key = 'no-date', label = 'Sans date';
      if (p.scheduled_at) {
        const d = new Date(p.scheduled_at);
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        label = label.charAt(0).toUpperCase() + label.slice(1);
      }
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.items.push(p);
      else groups.push({ key, label, items: [p] });
    }
    return groups;
  }, [sorted, filter]);

  function updateUrl(s: DerivedStatus, prov: ProvenanceFilter) {
    const usp = new URLSearchParams();
    if (s !== 'all') usp.set('status', s);
    if (prov !== 'all') usp.set('provenance', prov);
    router.replace(`/posts${usp.toString() ? '?' + usp.toString() : ''}`);
  }

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900 tracking-tight">Bibliothèque</h1>
          <p className="mt-1 text-sm text-ink-500 lead">Tous vos posts, regroupés par provenance réelle. Un post Notion sans URL LinkedIn reste une archive, pas une publication confirmée.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/posts/new" className="btn-primary">+ Nouveau post</Link>
        </div>
      </header>

      {/* Status filter chips */}
      <div className="card p-3 flex items-center gap-1.5 flex-wrap overflow-x-auto">
        {(['all', 'draft', 'needs_validation', 'scheduled', 'late', 'published', 'archive', 'recyclable'] as DerivedStatus[]).map(s => (
          <button
            key={s}
            onClick={() => { setFilter(s); updateUrl(s, provFilter); }}
            className={`text-xs px-3 py-1.5 rounded-full border transition flex items-center gap-1.5 ${filter === s ? 'bg-brand-50 text-brand-700 border-brand-300 font-semibold' : 'bg-white text-ink-700 border-ink-200 hover:bg-ink-50'}`}
          >
            <span className={`dot ${STATUS_DOT[s]}`} />
            {STATUS_LABEL[s]}
            <span className={filter === s ? 'text-brand-600' : 'text-ink-400'}>{counts[s]}</span>
          </button>
        ))}
      </div>

      {/* Provenance filter + search + pilier */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex bg-ink-100 rounded-lg p-0.5 gap-0.5 flex-wrap">
          {PROVENANCE_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => { setProvFilter(f.key); updateUrl(filter, f.key); }}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition ${provFilter === f.key ? 'bg-white text-ink-900 shadow-xs' : 'text-ink-500 hover:text-ink-700'}`}
            >
              {f.label}
              <span className="ml-1 text-ink-400">{provCounts[f.key]}</span>
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[200px] relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.3-4.3" /></svg>
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
        <div className="py-12 max-w-md">
          <p className="text-sm text-ink-700 leading-relaxed">
            Rien ne correspond à ces filtres pour le moment.{' '}
            <Link href="/posts/new" className="text-brand-700 hover:text-brand-900 underline decoration-dotted underline-offset-2 transition">Écrire un nouveau post</Link>
            {' '}ou relâchez un filtre pour élargir.
          </p>
        </div>
      ) : grouped ? (
        <div className="space-y-5">
          {grouped.map(g => (
            <div key={g.key}>
              <div className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-2 px-1">{g.label} <span className="text-ink-400 normal-case font-normal">· {g.items.length}</span></div>
              <div className="space-y-1.5">
                {g.items.map(p => (<PostRow key={p.id} p={p} />))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {sorted.map(p => (<PostRow key={p.id} p={p} />))}
        </div>
      )}
    </div>
  );
}

function PostRow({ p }: { p: any }) {
  return (
    <Link href={`/posts/${p.id}/edit`} className="card card-hover p-4 flex items-center gap-3 group">
      <span className={`chip ${STATUS_CHIP[p.primaryStatus as DerivedStatus]} shrink-0`}>
        <span className={`dot ${STATUS_DOT[p.primaryStatus as DerivedStatus]}`} />
        {STATUS_LABEL[p.primaryStatus as DerivedStatus]}
      </span>
      <ProvenanceBadge provenance={p.provenance} size="xs" className="shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-ink-900 truncate group-hover:text-brand-700 transition">{p.title}</div>
        <div className="text-xs text-ink-500 flex items-center gap-2 mt-0.5 flex-wrap">
          {p.pilier && <span>{p.pilier.split('·')[1]?.trim() || p.pilier}</span>}
          {p.scheduled_at && <span>· {new Date(p.scheduled_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} {p.scheduled_time?.slice(0, 5) || ''}</span>}
          {p.impressions ? <span className="text-success-700">· {p.impressions.toLocaleString('fr-FR')} impressions</span> : null}
        </div>
      </div>
      {p.derivedStatuses.includes('recyclable') && (
        <span onClick={e => { e.stopPropagation(); e.preventDefault(); window.location.href = `/posts/new?from=${p.id}&recycle=1`; }} className="btn-secondary text-xs cursor-pointer">Recycler</span>
      )}
      {p.linkedin_url && <a href={p.linkedin_url} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} className="opacity-0 group-hover:opacity-100 btn-ghost text-2xs transition">↗</a>}
    </Link>
  );
}
