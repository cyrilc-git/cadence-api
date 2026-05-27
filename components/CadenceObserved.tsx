'use client';

// V8.9 §4 — Bloc "Cadence a remarqué…" pour le dashboard.
// Affiche 1 insight prioritaire avec CTA. Non anxiogène, actionnable.
// Données réelles uniquement (/api/insights). Si rien : on n'affiche rien (pas de bloc fantôme).

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Insight = {
  kind:
    | 'pilier_silence' | 'topic_recyclable' | 'topic_saturated' | 'topic_never'
    | 'angle_winning' | 'weekday_opportunity' | 'low_data'
    // V34.1 — Rhythm engine kinds (merged dans CadenceObserved)
    | 'pilier_gap' | 'narrative_gap' | 'fatigue' | 'overconcentration'
    | 'rotation_healthy' | 'no_concrete_scene' | 'no_proof';
  message: string;
  cta_label?: string;
  cta_href?: string;
  data?: any;
};

const KIND_TONE: Record<Insight['kind'], { dot: string; icon: string }> = {
  weekday_opportunity: { dot: 'bg-brand-500',   icon: '▶' },
  pilier_silence:      { dot: 'bg-amber-500',   icon: '◷' },
  topic_recyclable:    { dot: 'bg-violet-500',  icon: '↻' },
  topic_saturated:     { dot: 'bg-pink-500',    icon: '⌃' },
  topic_never:         { dot: 'bg-emerald-500', icon: '✦' },
  angle_winning:       { dot: 'bg-brand-500',   icon: '▲' },
  // V34.1 — Rhythm signals : ambre pour les manques, emerald pour positif
  pilier_gap:          { dot: 'bg-amber-500',   icon: '◷' },
  narrative_gap:       { dot: 'bg-ink-400',     icon: '~' },
  fatigue:             { dot: 'bg-amber-500',   icon: '⌃' },
  overconcentration:   { dot: 'bg-amber-500',   icon: '⌃' },
  rotation_healthy:    { dot: 'bg-emerald-500', icon: '✓' },
  no_concrete_scene:   { dot: 'bg-amber-500',   icon: '◷' },
  no_proof:            { dot: 'bg-amber-500',   icon: '◷' },
  low_data:            { dot: 'bg-ink-400',     icon: '◌' }
};

// V11.4 §7 — weekday_opportunity (anticipation calendaire) prioritaire.
// V34.1 — Insertion des kinds rhythm dans la file de priorité. fatigue
// (3 derniers posts identiques) passe avant pilier_silence (manque générique).
const PRIORITY: Record<Insight['kind'], number> = {
  weekday_opportunity: 0,
  fatigue: 1,
  topic_never: 2,
  pilier_gap: 3,
  pilier_silence: 4,
  no_concrete_scene: 5,
  no_proof: 6,
  overconcentration: 7,
  topic_saturated: 8,
  topic_recyclable: 9,
  narrative_gap: 10,
  angle_winning: 11,
  rotation_healthy: 12,
  low_data: 99,
};

export default function CadenceObserved() {
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // V34.1 — On fusionne insights radar + rhythm pour donner UNE vue
    // unique. Le tri PRIORITY décide laquelle est mise en avant.
    Promise.all([
      fetch('/api/insights').then(r => r.json()).catch(() => ({ insights: [] })),
      fetch('/api/editorial-rhythm').then(r => r.json()).catch(() => ({ insights: [] })),
    ])
      .then(([r1, r2]) => {
        if (cancelled) return;
        const merged: Insight[] = [
          ...(r1.insights || []),
          // Les rhythm insights ne portent pas de cta_label/cta_href, on les
          // laisse vides pour qu'aucun CTA n'apparaisse — c'est une observation,
          // pas un appel à action.
          ...(r2.insights || []).filter((i: any) => i.kind !== 'low_data'),
        ];
        setInsights(merged);
      })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  if (error || insights === null) return null;
  if (!insights.length) return null;

  const sorted = [...insights].sort((a, b) => (PRIORITY[a.kind] || 99) - (PRIORITY[b.kind] || 99));
  const top = sorted[0];
  const others = sorted.slice(1, 4);
  const tone = KIND_TONE[top.kind] || KIND_TONE.low_data;

  return (
    <section className="card p-5 animate-fade-in">
      <div className="flex items-start gap-3">
        <span className={`w-2 h-2 rounded-full ${tone.dot} mt-2 shrink-0`} aria-hidden />
        <div className="flex-1 min-w-0">
          <div className="text-2xs uppercase tracking-wider font-semibold text-ink-500">Cadence a remarqué</div>
          <p className="mt-1 text-sm text-ink-800 leading-relaxed">{top.message}</p>
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            {top.cta_label && top.cta_href && (
              <Link href={top.cta_href} className="btn-primary text-xs">{top.cta_label} →</Link>
            )}
            {others.length > 0 && (
              <details className="text-xs text-ink-500 hover:text-ink-700 cursor-pointer">
                <summary className="select-none">+{others.length} autre{others.length > 1 ? 's' : ''} observation{others.length > 1 ? 's' : ''}</summary>
                <ul className="mt-2 space-y-1.5 pl-3">
                  {others.map((o, i) => {
                    const t = KIND_TONE[o.kind] || KIND_TONE.low_data;
                    return (
                      <li key={i} className="flex items-start gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${t.dot} mt-1.5 shrink-0`} aria-hidden />
                        <span className="flex-1">
                          {o.message}
                          {o.cta_href && o.cta_label && (
                            <Link href={o.cta_href} className="ml-2 text-brand-700 hover:underline">{o.cta_label}</Link>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
