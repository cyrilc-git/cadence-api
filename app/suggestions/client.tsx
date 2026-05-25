'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { sanitizeForBrandVoice } from '@/lib/brand-config';

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

// V10.3 — Type insights radar (synchro avec /api/insights)
type RadarSignal = {
  kind: 'pilier_silence' | 'topic_recyclable' | 'topic_saturated' | 'topic_never' | 'angle_winning' | 'low_data';
  message: string;
};

export default function SuggestionsClient() {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [signals, setSignals] = useState<RadarSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'score' | 'recent'>('score');
  const [showAll, setShowAll] = useState(false);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [sugRes, sigRes] = await Promise.all([
        fetch('/api/suggestions?status=pending', { cache: 'no-store' }),
        fetch('/api/insights', { cache: 'no-store' }).catch(() => null),
      ]);
      const d = await sugRes.json();
      if (!sugRes.ok) throw new Error(d.error || 'Erreur chargement');
      // V14.8 — Sanitize les anti-patterns visibles (em-dash, etc.) qui
      // peuvent traîner dans les suggestions générées avant le ban.
      // Sécurité affichage uniquement, n'altère pas la DB.
      const sanitized = (d.suggestions || []).map((s: Suggestion) => ({
        ...s,
        title: sanitizeForBrandVoice(s.title),
        hook: s.hook ? sanitizeForBrandVoice(s.hook) : s.hook,
      }));
      setItems(sanitized);
      if (sigRes && sigRes.ok) {
        const sd = await sigRes.json();
        setSignals((sd.insights || []) as RadarSignal[]);
      }
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

      {/* V10.3 — Pourquoi Cadence pense à ces idées (signaux amont du radar) */}
      {signals.length > 0 && signals.filter(s => s.kind !== 'low_data').length > 0 && (
        <section>
          <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-2">Pourquoi maintenant</h2>
          <ul className="space-y-1.5">
            {signals
              .filter(s => s.kind !== 'low_data')
              .slice(0, 3)
              .map((s, i) => {
                const dot = s.kind === 'topic_saturated' ? 'bg-amber-500' : s.kind === 'pilier_silence' ? 'bg-warn-500' : s.kind === 'angle_winning' ? 'bg-emerald-500' : 'bg-brand-500';
                return (
                  <li key={i} className="flex items-start gap-3">
                    <span className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${dot}`} aria-hidden />
                    <p className="text-sm text-ink-800 leading-relaxed">{s.message}</p>
                  </li>
                );
              })}
          </ul>
        </section>
      )}

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
        <div className="py-12 max-w-md">
          <p className="text-sm text-ink-700 leading-relaxed">
            Cadence n&apos;a rien de neuf à proposer pour l&apos;instant. Le radar lit vos brouillons Notion, vos commits GitHub et la mémoire éditoriale.
            {' '}
            <button onClick={refresh} disabled={refreshing} className="text-brand-700 hover:text-brand-900 underline decoration-dotted underline-offset-2 transition">
              {refreshing ? 'Cadence cherche…' : 'Cherchez maintenant'}
            </button>
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {(showAll ? filtered : filtered.slice(0, 3)).map(s => (
            <article key={s.id} className="card card-hover p-5 animate-slide-up">
              <div className="flex items-start gap-4">
                <ScoreRing score={s.score} />
                <div className="flex-1 min-w-0">
                  {/* V11.4 §4 — Header allégé : source + pilier seulement, le reste passe en details */}
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <SourceBadge source={s.source} />
                    {s.pilier && <span className="chip chip-neutral">{s.pilier.replace(' · ', ' ')}</span>}
                    {s.created_at && <span className="ml-auto text-2xs text-ink-400">{timeAgo(s.created_at)}</span>}
                  </div>
                  <h3 className="font-semibold text-ink-900 text-base leading-snug">{s.title}</h3>
                  {s.hook && (
                    <div className="mt-2 px-3 py-2 rounded-lg bg-ink-50 border-l-2 border-brand-400 text-sm text-ink-800 italic">
                      « {s.hook} »
                    </div>
                  )}
                  {s.why && (
                    <p className="mt-2 text-xs text-ink-500 leading-relaxed">{s.why}</p>
                  )}
                  {/* V11.4 §4 — Détails repliés par défaut : meta + visuel + risque répétition */}
                  {(() => {
                    const fmt = (s.format || s.payload?.format) as string | undefined;
                    const eff = fmt ? FORMAT_EFFORT[fmt] : null;
                    const conf = radarConfidence(s);
                    const hasNovelty = s.payload?.novelty != null;
                    const hasSaturationDetail = s.payload?.saturation > 2 && s.payload?.nearest_title;
                    const hasVisual = !!(s.visual_idea || s.payload?.visual_idea);
                    const hasAnyDetail = eff || hasNovelty || hasSaturationDetail || hasVisual || fmt;
                    if (!hasAnyDetail) return null;
                    return (
                      <details className="mt-3 text-xs text-ink-500 group/details">
                        <summary className="inline-flex items-center gap-1.5 cursor-pointer hover:text-ink-700 transition select-none">
                          <span className={`w-1.5 h-1.5 rounded-full ${conf.tone === 'high' ? 'bg-emerald-500' : conf.tone === 'medium' ? 'bg-ink-500' : 'bg-amber-500'}`} aria-hidden />
                          <span>{conf.label}</span>
                          {eff && <span className="text-ink-400">· {eff.label}</span>}
                          {hasSaturationDetail && <span className="text-amber-600">· risque de répétition</span>}
                          <span className="text-ink-300 ml-1">détail</span>
                        </summary>
                        <div className="mt-2 pl-3 space-y-1.5 leading-relaxed">
                          {fmt && FORMAT_LABELS[fmt] && <p>Format : {FORMAT_LABELS[fmt]}.</p>}
                          {hasNovelty && <p>Nouveauté du sujet vs vos archives : {Math.round(s.payload.novelty * 100)}%.</p>}
                          {hasSaturationDetail && (
                            <p className="text-amber-700">
                              Sujet déjà traité ({s.payload.saturation} posts similaires). Le plus proche : « {s.payload.nearest_title.slice(0, 80)} ». Préférez un angle opinion ou contre-exemple.
                            </p>
                          )}
                          {hasVisual && <p>Visuel suggéré : {(s.visual_idea || s.payload?.visual_idea)}</p>}
                        </div>
                      </details>
                    );
                  })()}
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
