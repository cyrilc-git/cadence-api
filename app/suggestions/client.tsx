'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const SOURCE_META: Record<string, { label: string; icon: string; color: string }> = {
  notion:    { label: 'Notion',     icon: 'N', color: '#000000' },
  github:    { label: 'GitHub',     icon: 'G', color: '#181717' },
  heuristic: { label: 'Heuristique', icon: '★', color: '#2563EB' },
  gmail:     { label: 'Gmail',      icon: 'M', color: '#EA4335' },
  gdrive:    { label: 'Drive',      icon: 'D', color: '#1FA463' },
  linkedin:  { label: 'LinkedIn',   icon: 'in', color: '#0A66C2' }
};

const FORMAT_LABELS: Record<string, string> = {
  cas: 'Cas client', pedagogie: 'Pédagogie', produit: 'Produit', opinion: 'Opinion', build: 'Build in public',
  carousel: 'Carrousel', list: 'Liste', text: 'Texte court'
};

// V9.6 — Effort estimé selon format (court / standard / long-form)
const FORMAT_EFFORT: Record<string, { label: string; tone: 'easy' | 'medium' | 'hard' }> = {
  text:       { label: 'Effort faible',  tone: 'easy' },
  opinion:    { label: 'Effort faible',  tone: 'easy' },
  list:       { label: 'Effort moyen',   tone: 'medium' },
  pedagogie:  { label: 'Effort moyen',   tone: 'medium' },
  produit:    { label: 'Effort moyen',   tone: 'medium' },
  cas:        { label: 'Effort fort',    tone: 'hard' },
  carousel:   { label: 'Effort fort',    tone: 'hard' },
  build:      { label: 'Effort moyen',   tone: 'medium' },
};

// V9.6 — Confidence du radar : score haut = confiance, bas = exploratoire.
function radarConfidence(s: { score: number; payload?: any }): { label: string; tone: 'high' | 'medium' | 'low' } {
  const novelty = s.payload?.novelty;
  if (s.score >= 75 && novelty != null && novelty > 0.5) return { label: 'Forte confiance', tone: 'high' };
  if (s.score >= 50) return { label: 'Confiance moyenne', tone: 'medium' };
  return { label: 'Exploration', tone: 'low' };
}

type Suggestion = {
  id: string;
  source: string;
  title: string;
  hook?: string;
  why?: string;
  pilier?: string;
  score: number;
  payload?: any;
  format?: string;
  visual_idea?: string;
  created_at?: string;
};

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "à l'instant";
  if (d < 3600) { const m = Math.floor(d/60); return `il y a ${m} minute${m > 1 ? 's' : ''}`; }
  if (d < 86400) { const h = Math.floor(d/3600); return `il y a ${h} heure${h > 1 ? 's' : ''}`; }
  const j = Math.floor(d/86400);
  if (j < 7) return `il y a ${j} jour${j > 1 ? 's' : ''}`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function ScoreRing({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const dash = (pct / 100) * 113;
  const color = pct >= 75 ? '#10B981' : pct >= 50 ? '#2563EB' : '#94A3B8';
  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="18" fill="none" stroke="#E2E8F0" strokeWidth="3.5" />
        <circle cx="20" cy="20" r="18" fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${dash} 200`} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold" style={{ color }}>{pct}</div>
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  const m = SOURCE_META[source] || SOURCE_META.heuristic;
  return (
    <span className="inline-flex items-center gap-1.5 chip chip-neutral">
      <span className="w-4 h-4 rounded-sm flex items-center justify-center text-white text-2xs font-bold" style={{ backgroundColor: m.color }}>{m.icon}</span>
      {m.label}
    </span>
  );
}

export default function SuggestionsClient() {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'score' | 'recent'>('score');
  const [showAll, setShowAll] = useState(false);

  async function load() {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/suggestions?status=pending', { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erreur chargement');
      setItems(d.suggestions || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function refresh() {
    setRefreshing(true); setError(null);
    try {
      const r = await fetch('/api/suggestions/refresh', { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Échec du radar');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }

  async function setStatus(id: string, status: 'used' | 'ignored' | 'saved') {
    setItems(items.filter(i => i.id !== id));
    await fetch(`/api/suggestions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }).catch(() => {});
  }

  const sources = useMemo(() => {
    const set = new Set(items.map(i => i.source));
    return ['all', ...Array.from(set)];
  }, [items]);

  const filtered = useMemo(() => {
    let l = filter === 'all' ? items : items.filter(i => i.source === filter);
    l = [...l].sort((a, b) => sortBy === 'score' ? b.score - a.score : (new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
    return l;
  }, [items, filter, sortBy]);

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900 tracking-tight flex items-center gap-2">
            <svg className="w-6 h-6 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>
            Radar
          </h1>
          <p className="mt-1 text-sm text-ink-500 lead">Top 3 idées par défaut, avec angle, effort et raison du moment. Cadence affiche peu pour ne pas saturer.</p>
        </div>
        <button onClick={refresh} disabled={refreshing} className="btn-primary">
          {refreshing ? (
            <><span className="dot bg-white animate-pulse-soft" /> Scan en cours…</>
          ) : (
            <><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M21 12a9 9 0 11-3-6.7L21 8 M21 3v5h-5"/></svg> Rafraîchir le radar</>
          )}
        </button>
      </header>

      {error && <div className="card p-3 text-sm text-danger-700 border-danger-100 bg-danger-50/40">{error}</div>}

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {sources.map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`text-xs px-3 py-1.5 rounded-full border transition ${filter === f ? 'bg-brand-50 text-brand-700 border-brand-300' : 'bg-white text-ink-700 border-ink-200 hover:bg-ink-50'}`}>
            {f === 'all' ? 'Toutes' : SOURCE_META[f]?.label || f}
            {f !== 'all' && <span className="ml-1.5 text-ink-400">{items.filter(i => i.source === f).length}</span>}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className="text-ink-500">Trier :</span>
          <div className="inline-flex bg-ink-100 rounded-md p-0.5">
            <button onClick={() => setSortBy('score')} className={`px-2 py-1 rounded text-xs font-medium ${sortBy === 'score' ? 'bg-white text-ink-900 shadow-xs' : 'text-ink-500'}`}>Score</button>
            <button onClick={() => setSortBy('recent')} className={`px-2 py-1 rounded text-xs font-medium ${sortBy === 'recent' ? 'bg-white text-ink-900 shadow-xs' : 'text-ink-500'}`}>Récent</button>
          </div>
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="card p-5 space-y-3"><div className="skeleton h-4 w-3/4" /><div className="skeleton h-3 w-1/2" /><div className="skeleton h-12 w-full" /></div>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" d="M12 3v4M12 17v4M3 12h4M17 12h4"/></svg>
          </div>
          <p className="text-ink-900 font-semibold">Aucune idée pour l'instant.</p>
          <p className="mt-1 text-sm text-ink-500">Cliquez « Rafraîchir le radar » pour scanner vos sources. Cadence détecte les drafts Notion, les commits GitHub, les schémas récurrents dans vos posts publiés.</p>
          <button onClick={refresh} disabled={refreshing} className="btn-primary mt-4">Lancer un scan</button>
        </div>
      ) : (
        <div className="grid gap-3">
          {(showAll ? filtered : filtered.slice(0, 3)).map(s => (
            <article key={s.id} className="card card-hover p-5 animate-slide-up">
              <div className="flex items-start gap-4">
                <ScoreRing score={s.score} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <SourceBadge source={s.source} />
                    {s.pilier && <span className="chip chip-brand">{s.pilier}</span>}
                    {(s.format || s.payload?.format) && FORMAT_LABELS[(s.format || s.payload?.format) as string] && <span className="chip chip-neutral">{FORMAT_LABELS[(s.format || s.payload?.format) as string]}</span>}
                    {/* V8.1 — novelty / saturation chips */}
                    {s.payload?.novelty != null && s.payload.novelty > 0.7 && <span className="chip chip-success" title={`Score nouveauté ${Math.round(s.payload.novelty * 100)}%`}>✨ Nouveau</span>}
                    {s.payload?.saturation > 2 && <span className="chip chip-warn" title={`${s.payload.saturation} posts récents similaires`}>⚠ Déjà couvert</span>}
                    {s.created_at && <span className="ml-auto text-2xs text-ink-400">{timeAgo(s.created_at)}</span>}
                  </div>
                  <h3 className="font-semibold text-ink-900 text-base leading-snug">{s.title}</h3>
                  {s.hook && (
                    <div className="mt-2 px-3 py-2 rounded-lg bg-ink-50 border-l-2 border-brand-400 text-sm text-ink-800 italic">
                      « {s.hook} »
                    </div>
                  )}
                  {s.why && (
                    <p className="mt-2 text-xs text-ink-500">
                      <span className="font-semibold text-ink-600">Pourquoi maintenant : </span>{s.why}
                    </p>
                  )}
                  {s.payload?.saturation > 2 && s.payload?.nearest_title && (
                    <p className="mt-1.5 text-xs text-warn-700">
                      <span className="font-semibold">Risque de répétition :</span> sujet déjà traité récemment ({s.payload.saturation} posts similaires). Le plus proche : « {s.payload.nearest_title.slice(0, 80)} ». Préférez un angle opinion ou contre-exemple.
                    </p>
                  )}
                  {(s.visual_idea || s.payload?.visual_idea) && (
                    <p className="mt-1.5 text-xs text-ink-500">
                      <span className="font-semibold text-ink-600">Visuel : </span>{(s.visual_idea || s.payload?.visual_idea)}
                    </p>
                  )}
                  {/* V9.6 — Méta stratégique : confidence + effort */}
                  <div className="mt-3 flex items-center gap-3 flex-wrap text-2xs text-ink-500">
                    {(() => {
                      const conf = radarConfidence(s);
                      const toneClass = conf.tone === 'high' ? 'text-emerald-700' : conf.tone === 'medium' ? 'text-ink-700' : 'text-amber-700';
                      const dotClass = conf.tone === 'high' ? 'bg-emerald-500' : conf.tone === 'medium' ? 'bg-ink-500' : 'bg-amber-500';
                      return (
                        <span className={`inline-flex items-center gap-1 ${toneClass}`} title="Confiance du radar (score + nouveauté)">
                          <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} aria-hidden />
                          {conf.label}
                        </span>
                      );
                    })()}
                    {(() => {
                      const fmt = (s.format || s.payload?.format) as string | undefined;
                      const eff = fmt ? FORMAT_EFFORT[fmt] : null;
                      if (!eff) return null;
                      const toneClass = eff.tone === 'easy' ? 'text-emerald-700' : eff.tone === 'medium' ? 'text-ink-700' : 'text-amber-700';
                      return <span className={`inline-flex items-center gap-1 ${toneClass}`} title="Effort de rédaction estimé">{eff.label}</span>;
                    })()}
                    {s.payload?.novelty != null && (
                      <span className="text-ink-500" title="Nouveauté du sujet vs vos archives">Nouveauté {Math.round(s.payload.novelty * 100)}%</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 flex-wrap pl-16">
                <Link
                  href={`/posts/new?suggest=${s.id}&pilier=${encodeURIComponent(s.pilier || '')}&hook=${encodeURIComponent(s.hook || '')}&brief=${encodeURIComponent(s.title)}`}
                  onClick={() => setStatus(s.id, 'used')}
                  className="btn-primary"
                >
                  Écrire cette idée →
                </Link>
                <button onClick={() => setStatus(s.id, 'saved')} className="btn-secondary">Sauvegarder</button>
                <button onClick={() => setStatus(s.id, 'ignored')} className="btn-ghost">Ignorer</button>
                {s.payload?.notion_url && <a href={s.payload.notion_url} target="_blank" rel="noopener" className="ml-auto text-xs text-brand-700 hover:text-brand-600 font-medium">Notion ↗</a>}
                {s.payload?.url && <a href={s.payload.url} target="_blank" rel="noopener" className="ml-auto text-xs text-brand-700 hover:text-brand-600 font-medium">Source ↗</a>}
              </div>
            </article>
          ))}
          {!showAll && filtered.length > 3 && (
            <button onClick={() => setShowAll(true)} className="card card-hover p-4 text-center text-sm text-ink-600 hover:text-brand-700 transition border-dashed">
              Voir {filtered.length - 3} autre{filtered.length - 3 > 1 ? 's' : ''} idée{filtered.length - 3 > 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
