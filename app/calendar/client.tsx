'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

// Pilier color tokens — one base color per editorial day
const PILIER_TONES: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
  'Lundi':    { bg: 'bg-blue-50',   text: 'text-blue-700',   ring: 'border-blue-200',   dot: 'bg-blue-500'   },
  'Mardi':    { bg: 'bg-emerald-50',text: 'text-emerald-700',ring: 'border-emerald-200',dot: 'bg-emerald-500'},
  'Mercredi': { bg: 'bg-violet-50', text: 'text-violet-700', ring: 'border-violet-200', dot: 'bg-violet-500' },
  'Jeudi':    { bg: 'bg-amber-50',  text: 'text-amber-700',  ring: 'border-amber-200',  dot: 'bg-amber-500'  },
  'Vendredi': { bg: 'bg-pink-50',   text: 'text-pink-700',   ring: 'border-pink-200',   dot: 'bg-pink-500'   },
};
function tone(pilier?: string) {
  if (!pilier) return { bg: 'bg-ink-100', text: 'text-ink-700', ring: 'border-ink-200', dot: 'bg-ink-400' };
  const day = pilier.split(/[\s·]/)[0];
  return PILIER_TONES[day] || PILIER_TONES['Lundi'];
}

const MONTH_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function ymd(d: Date): string {
  // Use local date components (avoid TZ shifts that break grouping)
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function statusOf(p: any): 'published' | 'scheduled' | 'needs_validation' | 'late' | 'draft' {
  if (p.status === 'published') return 'published';
  if (p.late) return 'late';
  if (p.scheduled_at) return p.validated ? 'scheduled' : 'needs_validation';
  return 'draft';
}

export default function CalendarClient({ initialPosts }: { initialPosts: any[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState<Date>(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; });
  const [view, setView] = useState<'month' | 'week'>('month');
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<{ created: number; pilierList: string[] } | null>(null);
  const [hover, setHover] = useState<{ key: string; items: any[] } | null>(null);

  const byDate = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const p of posts) {
      if (!p.scheduled_at) continue;
      const k = p.scheduled_at.slice(0, 10);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    return m;
  }, [posts]);

  async function refresh() {
    try {
      const r = await fetch('/api/notion/posts?limit=200');
      if (r.ok) { const d = await r.json(); if (Array.isArray(d.posts)) setPosts(d.posts); }
    } catch {/* silent */}
  }

  async function generateWeek() {
    if (!confirm('Générer 5 brouillons (lundi → vendredi) pour la semaine prochaine ? Drafts NON validés.')) return;
    setGenerating(true); setGenResult(null);
    try {
      const r = await fetch('/api/generate-week', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const created = (d.results || []).filter((x: any) => x.status === 'created');
      setGenResult({ created: created.length, pilierList: created.map((c: any) => c.pilier) });
      // Live refresh
      setTimeout(refresh, 1200);
    } catch (e: any) { alert('Erreur : ' + e.message); }
    finally { setGenerating(false); }
  }

  const grid: Date[][] = useMemo(() => {
    if (view === 'week') {
      const today = cursor;
      const dow = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((dow + 6) % 7));
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) { const x = new Date(monday); x.setDate(monday.getDate() + i); week.push(x); }
      return [week];
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    const weeks: Date[][] = [];
    const d = new Date(start);
    while (d <= last || d.getDay() !== 1) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) { week.push(new Date(d)); d.setDate(d.getDate() + 1); }
      weeks.push(week);
      if (weeks.length > 6) break;
    }
    return weeks;
  }, [cursor, view]);

  // KPIs : count by status for the current month/week
  const stats = useMemo(() => {
    const counts = { draft: 0, needs_validation: 0, scheduled: 0, published: 0, late: 0 };
    const start = grid[0]?.[0]; const end = grid[grid.length-1]?.[6];
    if (!start || !end) return counts;
    for (const p of posts) {
      if (!p.scheduled_at) continue;
      const d = new Date(p.scheduled_at);
      if (d < start || d > end) continue;
      const st = statusOf(p);
      counts[st as keyof typeof counts]++;
    }
    return counts;
  }, [posts, grid]);

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900 tracking-tight">Calendrier</h1>
          <p className="mt-1 text-sm text-ink-500">{view === 'month' ? `${MONTH_FR[cursor.getMonth()]} ${cursor.getFullYear()}` : `Semaine du ${grid[0]?.[0]?.toLocaleDateString('fr-FR')}`}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex bg-ink-100 rounded-lg p-0.5 gap-0.5">
            <button onClick={() => setView('month')} className={`px-3 py-1 rounded-md text-xs font-medium transition ${view === 'month' ? 'bg-white text-ink-900 shadow-xs' : 'text-ink-600'}`}>Mois</button>
            <button onClick={() => setView('week')}  className={`px-3 py-1 rounded-md text-xs font-medium transition ${view === 'week'  ? 'bg-white text-ink-900 shadow-xs' : 'text-ink-600'}`}>Semaine</button>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => { const d = new Date(cursor); d.setMonth(d.getMonth() - 1); setCursor(d); }} className="btn-secondary w-9 h-9 p-0" aria-label="Mois précédent">‹</button>
            <button onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="btn-secondary text-xs">Aujourd'hui</button>
            <button onClick={() => { const d = new Date(cursor); d.setMonth(d.getMonth() + 1); setCursor(d); }} className="btn-secondary w-9 h-9 p-0" aria-label="Mois suivant">›</button>
          </div>
          <button onClick={generateWeek} disabled={generating} className="btn-primary">
            {generating ? (
              <><span className="dot bg-white animate-pulse-soft" /> Génération…</>
            ) : (
              <><span aria-hidden>✨</span> Générer la semaine</>
            )}
          </button>
        </div>
      </header>

      {/* KPI strip */}
      <div className="card p-3 grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
        <KPI label="Brouillons"  value={stats.draft}            tone="ink"     />
        <KPI label="À valider"   value={stats.needs_validation} tone="warn"    />
        <KPI label="Programmés"  value={stats.scheduled}        tone="brand"   />
        <KPI label="En retard"   value={stats.late}             tone="danger"  />
        <KPI label="Publiés"     value={stats.published}        tone="success" />
      </div>

      {/* Generate result toast */}
      {genResult && (
        <div className="card p-4 animate-slide-up flex items-center gap-3 border-success-200 bg-success-50/50">
          <span className="w-10 h-10 rounded-full bg-success-500 text-white flex items-center justify-center font-bold">{genResult.created}</span>
          <div className="flex-1">
            <div className="font-semibold text-success-700">{genResult.created} brouillon(s) créé(s)</div>
            <div className="text-xs text-ink-500">Tous en NON validé. Ouvrez chacun pour relire, ajuster, et valider pour publication.</div>
          </div>
          <button onClick={() => setGenResult(null)} className="btn-ghost">Fermer</button>
        </div>
      )}

      {/* Header row */}
      <div className="grid grid-cols-7 gap-2 text-2xs font-semibold text-ink-500 uppercase tracking-wider px-2">
        {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d => <div key={d} className="text-center">{d}</div>)}
      </div>

      {/* Grid */}
      <div className="space-y-2">
        {grid.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-2">
            {week.map(d => {
              const k = ymd(d);
              const items = byDate.get(k) || [];
              const isToday = k === ymd(new Date());
              const isOtherMonth = view === 'month' && d.getMonth() !== cursor.getMonth();
              const isPast = d < new Date(new Date().setHours(0,0,0,0));
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div
                  key={k}
                  onMouseEnter={() => items.length > 0 && setHover({ key: k, items })}
                  onMouseLeave={() => setHover(null)}
                  className={`relative rounded-xl p-2 min-h-[124px] border transition ${isToday ? 'border-brand-400 bg-brand-50/30 shadow-elev' : isWeekend ? 'border-ink-100 bg-ink-50/40' : 'border-ink-200 bg-white'} ${isOtherMonth ? 'opacity-40' : ''} ${isPast && !isToday ? 'opacity-75' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-semibold ${isToday ? 'text-brand-700' : isWeekend ? 'text-ink-400' : 'text-ink-700'}`}>{d.getDate()}</span>
                    {!isPast && !isWeekend && (
                      <Link href={`/posts/new?date=${k}`} className="w-5 h-5 rounded-md flex items-center justify-center text-ink-400 hover:text-brand-600 hover:bg-brand-50 transition text-sm" title="Créer un post">+</Link>
                    )}
                  </div>
                  <div className="space-y-1">
                    {items.slice(0, 3).map((p: any) => {
                      const t = tone(p.pilier);
                      const st = statusOf(p);
                      return (
                        <Link key={p.id} href={`/posts/${p.id}/edit`} className={`block text-2xs px-1.5 py-1 rounded-md border ${t.bg} ${t.text} ${t.ring} truncate hover:shadow-xs transition`}>
                          <span className="flex items-center gap-1">
                            {st === 'published' && <span title="Publié" className="text-success-700">✓</span>}
                            {st === 'late' && <span title="En retard" className="text-danger-500">⚠</span>}
                            {st === 'scheduled' && <span title="Programmé" className="dot bg-brand-500" />}
                            {st === 'needs_validation' && <span title="À valider" className="dot bg-warn-500" />}
                            <span className="font-medium truncate">{p.scheduled_time?.slice(0,5) || ''}</span>
                            <span className="truncate flex-1 opacity-80">{p.title}</span>
                          </span>
                        </Link>
                      );
                    })}
                    {items.length > 3 && (
                      <div className="text-2xs text-ink-500 px-1">+{items.length - 3} autres</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Hover preview */}
      {hover && hover.items.length > 0 && (
        <div className="fixed bottom-4 right-4 z-30 card p-3 max-w-sm animate-slide-up pointer-events-none">
          <div className="text-2xs uppercase font-semibold text-ink-500 mb-1">{new Date(hover.key).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
          <div className="space-y-1.5">
            {hover.items.slice(0, 4).map((p: any) => (
              <div key={p.id} className="text-xs flex items-start gap-2">
                <span className={`dot mt-1.5 ${tone(p.pilier).dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-ink-900 truncate">{p.title}</div>
                  <div className="text-2xs text-ink-500">{p.pilier} · {p.scheduled_time || '—'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="card p-4 text-sm">
        <div className="flex items-center gap-5 flex-wrap text-xs">
          <span className="flex items-center gap-2"><span className="dot bg-warn-500" /> À valider <span className="text-ink-400">(cron ne publie pas)</span></span>
          <span className="flex items-center gap-2"><span className="dot bg-brand-500" /> Programmé <span className="text-ink-400">(validé pour cron)</span></span>
          <span className="flex items-center gap-2"><span className="text-success-700">✓</span> Publié</span>
          <span className="flex items-center gap-2"><span className="text-danger-500">⚠</span> En retard</span>
        </div>
        <p className="mt-2 text-xs text-ink-500">Le cron Vercel publie quotidiennement uniquement les drafts marqués « validés » via l'éditeur.</p>
      </div>
    </div>
  );
}

function KPI({ label, value, tone }: { label: string; value: number; tone: 'ink'|'warn'|'brand'|'danger'|'success' }) {
  const color = { ink: 'text-ink-900', warn: 'text-warn-700', brand: 'text-brand-700', danger: 'text-danger-700', success: 'text-success-700' }[tone];
  return (
    <div className="flex items-baseline gap-2">
      <span className={`text-xl font-semibold tabular-nums ${color}`}>{value}</span>
      <span className="text-xs text-ink-500">{label}</span>
    </div>
  );
}
