'use client';

import { useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';

const SOURCE_LABEL: Record<string, { label: string; variant: 'brand' | 'success' | 'warn' | 'neutral' }> = {
  notion:    { label: 'Notion',     variant: 'brand'   },
  github:    { label: 'GitHub',     variant: 'success' },
  heuristic: { label: 'Heuristique', variant: 'neutral' },
  gmail:     { label: 'Gmail',      variant: 'warn'    },
  gdrive:    { label: 'Drive',      variant: 'warn'    }
};

export default function SuggestionsClient({ initial }: { initial: any[] }) {
  const [items, setItems] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'notion' | 'github' | 'heuristic'>('all');

  async function refresh() {
    setRefreshing(true);
    try {
      const r = await fetch('/api/suggestions/refresh', { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const list = await fetch('/api/suggestions').then(x => x.json());
      setItems(list.suggestions || []);
    } catch (e: any) {
      alert('Erreur radar : ' + e.message);
    } finally {
      setRefreshing(false);
    }
  }

  async function setStatus(id: string, status: 'used' | 'ignored' | 'saved') {
    await fetch(`/api/suggestions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    setItems(items.filter(i => i.id !== id));
  }

  const filtered = filter === 'all' ? items : items.filter(i => i.source === filter);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold text-ink-900">Suggestions IA</h1>
          <p className="mt-1 text-ink-500">Ce que vous pourriez publier aujourd'hui, à partir de vos sources.</p>
        </div>
        <button onClick={refresh} disabled={refreshing} className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50">
          {refreshing ? 'Scan en cours…' : '⟳ Rafraîchir le radar'}
        </button>
      </header>

      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'notion', 'github', 'heuristic'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full ring-1 ring-inset ${filter === f ? 'bg-brand-50 text-brand-700 ring-brand-500/30' : 'bg-white text-ink-700 ring-ink-300/40 hover:bg-ink-50'}`}>
            {f === 'all' ? 'Toutes' : SOURCE_LABEL[f]?.label || f}
          </button>
        ))}
        <span className="ml-auto text-xs text-ink-500">{filtered.length} idée{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-card ring-1 ring-inset ring-ink-300/20">
          <p className="text-ink-700 font-medium">Pas d'idée pour l'instant.</p>
          <p className="mt-1 text-sm text-ink-500">Cliquez "Rafraîchir le radar" pour scanner vos sources.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(s => {
            const meta = SOURCE_LABEL[s.source] || SOURCE_LABEL.heuristic;
            return (
              <article key={s.id} className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20 hover:shadow-pop transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <StatusBadge variant={meta.variant}>{meta.label}</StatusBadge>
                      {s.pilier && <span className="text-xs text-ink-500">· {s.pilier}</span>}
                      <span className="text-xs text-ink-500 ml-auto">Score {s.score}/100</span>
                    </div>
                    <h3 className="font-semibold text-ink-900">{s.title}</h3>
                    {s.hook && <p className="mt-1 text-sm text-ink-700"><span className="text-ink-500">Hook :</span> "{s.hook}"</p>}
                    {s.why && <p className="mt-2 text-xs text-ink-500">{s.why}</p>}
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  <Link href={`/posts/new?suggest=${s.id}&pilier=${encodeURIComponent(s.pilier || '')}&hook=${encodeURIComponent(s.hook || '')}&brief=${encodeURIComponent(s.title)}`}
                    onClick={() => setStatus(s.id, 'used')}
                    className="px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-medium hover:bg-brand-600">
                    ✨ Générer un post
                  </Link>
                  <button onClick={() => setStatus(s.id, 'saved')} className="px-3 py-1.5 rounded-lg ring-1 ring-ink-300 text-xs font-medium hover:bg-ink-50">Sauvegarder</button>
                  <button onClick={() => setStatus(s.id, 'ignored')} className="px-3 py-1.5 rounded-lg ring-1 ring-ink-300 text-ink-500 text-xs hover:bg-ink-50">Ignorer</button>
                  {s.payload?.notion_url && <a href={s.payload.notion_url} target="_blank" rel="noopener" className="ml-auto text-xs text-brand-700 hover:text-brand-600">Voir dans Notion ↗</a>}
                  {s.payload?.url && <a href={s.payload.url} target="_blank" rel="noopener" className="ml-auto text-xs text-brand-700 hover:text-brand-600">Voir source ↗</a>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
