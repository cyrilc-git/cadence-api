'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

const PILIER_COLORS: Record<string, string> = {
  'Lundi · Cas client':                                        'bg-blue-50 text-blue-700 ring-blue-500/20',
  'Lundi · Cas dirigeant anonymisé':                          'bg-blue-50 text-blue-700 ring-blue-500/20',
  'Mardi · Pédagogie':                                        'bg-green-50 text-green-700 ring-green-500/20',
  'Mardi · Pédagogie sans jargon':                            'bg-green-50 text-green-700 ring-green-500/20',
  'Mercredi · Produit':                                       'bg-purple-50 text-purple-700 ring-purple-500/20',
  'Mercredi · Produit / démo / nouveauté / release note':     'bg-purple-50 text-purple-700 ring-purple-500/20',
  'Jeudi · Opinion':                                          'bg-orange-50 text-orange-700 ring-orange-500/20',
  'Jeudi · Opinion / hot take mesuré':                        'bg-orange-50 text-orange-700 ring-orange-500/20',
  'Vendredi · Build in public':                               'bg-pink-50 text-pink-700 ring-pink-500/20'
};

const MONTH_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function ymd(d: Date): string { return d.toISOString().slice(0,10); }

export default function CalendarClient({ initialPosts }: { initialPosts: any[] }) {
  const [cursor, setCursor] = useState<Date>(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; });
  const [view, setView] = useState<'month' | 'week'>('month');
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const p of initialPosts) {
      if (!p.scheduled_at) continue;
      const k = p.scheduled_at.slice(0, 10);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    return m;
  }, [initialPosts]);

  async function generateWeek() {
    if (!confirm('Générer 5 brouillons (lundi → vendredi) pour la semaine prochaine ? Aucune publication, juste des drafts NON validés.')) return;
    setGenerating(true); setMsg(null);
    try {
      const r = await fetch('/api/generate-week', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const created = (d.results || []).filter((x: any) => x.status === 'created').length;
      setMsg(`${created} brouillon(s) créé(s) en NON validé. Rechargez pour voir.`);
    } catch (e: any) {
      setMsg('Erreur : ' + e.message);
    } finally { setGenerating(false); }
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

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold text-ink-900">Calendrier</h1>
          <p className="mt-1 text-ink-500">{view === 'month' ? `${MONTH_FR[cursor.getMonth()]} ${cursor.getFullYear()}` : `Semaine du ${grid[0]?.[0]?.toLocaleDateString('fr-FR')}`}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg ring-1 ring-ink-300 overflow-hidden">
            <button onClick={() => setView('month')} className={`px-3 py-1.5 text-xs font-medium ${view === 'month' ? 'bg-brand-500 text-white' : 'bg-white text-ink-700 hover:bg-ink-50'}`}>Mois</button>
            <button onClick={() => setView('week')}  className={`px-3 py-1.5 text-xs font-medium ${view === 'week'  ? 'bg-brand-500 text-white' : 'bg-white text-ink-700 hover:bg-ink-50'}`}>Semaine</button>
          </div>
          <button onClick={() => { const d = new Date(cursor); d.setMonth(d.getMonth() - 1); setCursor(d); }} className="px-3 py-1.5 rounded-lg ring-1 ring-ink-300 text-sm hover:bg-ink-50">←</button>
          <button onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="px-3 py-1.5 rounded-lg ring-1 ring-ink-300 text-sm hover:bg-ink-50">Aujourd'hui</button>
          <button onClick={() => { const d = new Date(cursor); d.setMonth(d.getMonth() + 1); setCursor(d); }} className="px-3 py-1.5 rounded-lg ring-1 ring-ink-300 text-sm hover:bg-ink-50">→</button>
          <button onClick={generateWeek} disabled={generating} className="px-3 py-1.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50">{generating ? 'Génération…' : '✨ Générer la semaine'}</button>
        </div>
      </header>

      {msg && <div className="bg-ink-50 ring-1 ring-inset ring-ink-300/40 rounded-lg p-3 text-sm text-ink-700">{msg}</div>}

      <div className="grid grid-cols-7 gap-2 text-xs font-medium text-ink-500 uppercase tracking-wide px-1">
        {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d => <div key={d}>{d}</div>)}
      </div>

      <div className="space-y-2">
        {grid.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-2">
            {week.map(d => {
              const k = ymd(d);
              const items = byDate.get(k) || [];
              const isToday = k === ymd(new Date());
              const isOtherMonth = view === 'month' && d.getMonth() !== cursor.getMonth();
              const isPast = d < new Date(new Date().setHours(0,0,0,0));
              return (
                <div key={k} className={`rounded-xl p-2 min-h-[120px] ring-1 ring-inset ${isToday ? 'ring-brand-500 bg-brand-50/40' : 'ring-ink-300/30 bg-white'} ${isOtherMonth ? 'opacity-40' : ''} ${isPast && !isToday ? 'opacity-70' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-semibold ${isToday ? 'text-brand-700' : 'text-ink-700'}`}>{d.getDate()}</span>
                    {!isPast && <Link href={`/posts/new?date=${k}`} className="text-ink-400 hover:text-brand-500 text-xs leading-none" title="Créer un post">+</Link>}
                  </div>
                  <div className="space-y-1">
                    {items.map((p: any) => (
                      <Link key={p.id} href={`/posts/${p.id}/edit`}
                        className={`block text-[11px] px-1.5 py-1 rounded ring-1 ring-inset truncate ${p.pilier ? PILIER_COLORS[p.pilier] || 'bg-ink-100 text-ink-700 ring-ink-300/40' : 'bg-ink-100 text-ink-700 ring-ink-300/40'}`}>
                        <span className="flex items-center gap-1">
                          {p.status === 'published' && <span title="Publié">✓</span>}
                          {p.status !== 'published' && p.validated && <span title="Validé pour cron" className="text-success-700">●</span>}
                          {p.status !== 'published' && !p.validated && <span title="À valider" className="text-warn-700">⚠</span>}
                          <span className="truncate">{p.scheduled_time || ''} {p.title}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20 text-sm text-ink-700">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-2"><span className="text-warn-700">⚠</span> À valider (cron ne publie PAS)</span>
          <span className="flex items-center gap-2"><span className="text-success-700">●</span> Validé (cron publiera à 7h30)</span>
          <span className="flex items-center gap-2"><span>✓</span> Publié</span>
        </div>
        <p className="mt-3 text-xs text-ink-500">Le cron Vercel ne publie QUE les drafts marqués comme validés via la page d'édition. Aucune publication automatique d'un draft non validé.</p>
      </div>
    </div>
  );
}
