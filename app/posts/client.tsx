'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';

const STATUS_OPTIONS = ['all','draft','scheduled','published'] as const;
const STATUS_LABEL: Record<typeof STATUS_OPTIONS[number], string> = {
  all: 'Tous', draft: 'Brouillons', scheduled: 'Programmés', published: 'Publiés'
};
const STATUS_VARIANT: Record<string, 'neutral' | 'brand' | 'success' | 'danger'> = {
  draft: 'neutral', scheduled: 'brand', published: 'success', error: 'danger'
};

export default function PostsLibraryClient({ initial }: { initial: any[] }) {
  const [filter, setFilter] = useState<typeof STATUS_OPTIONS[number]>('all');
  const [search, setSearch] = useState('');
  const [pilier, setPilier] = useState('all');

  const piliers = useMemo(() => {
    const s = new Set<string>();
    initial.forEach(p => { if (p.pilier) s.add(p.pilier); });
    return Array.from(s);
  }, [initial]);

  const filtered = initial.filter(p => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (pilier !== 'all' && p.pilier !== pilier) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher dans les titres…"
          className="px-3 py-2 rounded-lg ring-1 ring-ink-300 text-sm focus:ring-brand-500 focus:border-brand-500 flex-1 min-w-[200px]" />
        <select value={filter} onChange={e => setFilter(e.target.value as any)} className="px-3 py-2 rounded-lg ring-1 ring-ink-300 text-sm">
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select value={pilier} onChange={e => setPilier(e.target.value)} className="px-3 py-2 rounded-lg ring-1 ring-ink-300 text-sm">
          <option value="all">Tous piliers</option>
          {piliers.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <span className="text-xs text-ink-500 ml-auto">{filtered.length} / {initial.length}</span>
      </div>

      {filtered.length === 0
        ? <EmptyState title="Aucun post" hint="Ajustez les filtres ou créez un nouveau post." />
        : <div className="grid gap-2">
            {filtered.map(p => (
              <Link key={p.id} href={`/posts/${p.id}/edit`} className="bg-white rounded-xl p-4 shadow-card ring-1 ring-inset ring-ink-300/20 hover:shadow-pop transition flex items-center gap-4">
                <StatusBadge variant={STATUS_VARIANT[p.status] || 'neutral'}>{STATUS_LABEL[p.status as keyof typeof STATUS_LABEL] || p.status}</StatusBadge>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-ink-900 truncate">{p.title}</div>
                  <div className="text-xs text-ink-500 flex items-center gap-2 mt-0.5 flex-wrap">
                    {p.pilier && <span>{p.pilier}</span>}
                    {p.scheduled_at && <span>· {new Date(p.scheduled_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })} {p.scheduled_time || ''}</span>}
                    {p.impressions ? <span>· {p.impressions.toLocaleString('fr-FR')} impressions</span> : null}
                    {p.likes ? <span>· {p.likes} likes</span> : null}
                  </div>
                </div>
                {p.linkedin_url && <a href={p.linkedin_url} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} className="text-xs text-brand-700 hover:text-brand-600 px-2 py-1">↗ LinkedIn</a>}
                <a href={p.notion_url} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} className="text-xs text-ink-500 hover:text-ink-700 px-2 py-1">↗ Notion</a>
              </Link>
            ))}
          </div>}
    </div>
  );
}
