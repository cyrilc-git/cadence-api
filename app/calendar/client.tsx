'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import MoveMenu from '@/components/MoveMenu';
import ProvenanceBadge from '@/components/ProvenanceBadge';
import { inferFromNotion, type Provenance } from '@/lib/provenance';
import { confirmDialog, toast } from '@/components/Dialog';

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
// V9.2 §2.5 — Provenance prime status : un post Notion publié sans URL LinkedIn = "archive", pas "publié".
function statusOf(p: any): 'published' | 'archive' | 'scheduled' | 'needs_validation' | 'late' | 'draft' {
  const prov: Provenance | undefined = p.provenance;
  if (prov?.source_type === 'linkedin_published' || prov?.source_type === 'linkedin_import_zip') return 'published';
  if (prov?.source_type === 'notion_archive') return 'archive';
  if (p.late) return 'late';
  if (p.scheduled_at) return p.validated ? 'scheduled' : 'needs_validation';
  return 'draft';
}

function enrichWithProvenance(list: any[]): any[] {
  return list.map(p => ({
    ...p,
    provenance: inferFromNotion({
      id: p.id, title: p.title, status: p.status, linkedin_url: p.linkedin_url,
      notion_url: p.notion_url, scheduled_at: p.scheduled_at, validated: p.validated,
      cadence_source: p.cadence_source,
    }),
  }));
}

export default function CalendarClient({ initialPosts }: { initialPosts: any[] }) {
  const [posts, setPosts] = useState(() => enrichWithProvenance(initialPosts));
  // V12.9 §3 — Filtre source : 'all' / 'linkedin' / 'notion'.
  // L'utilisateur peut isoler ce qui est réellement publié sur LinkedIn vs
  // les drafts Notion. Cadence n'utilise plus Notion comme source de vérité
  // de ce qui est publié.
  const [sourceFilter, setSourceFilter] = useState<'all' | 'linkedin' | 'notion'>('all');
  // V14.6 — Cursor init à aujourd'hui plutôt que le 1er du mois. En vue
  // semaine, partir du 1er affichait la semaine contenant le 1er, jamais
  // la semaine en cours. Maintenant on landait toujours sur la semaine de
  // today, cohérent avec "voici ce qui se passe maintenant".
  const [cursor, setCursor] = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  // V9.1 §2 — vue semaine par défaut (Notion Calendar / Linear style)
  const [view, setView] = useState<'month' | 'week'>('week');
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<{ created: number; pilierList: string[] } | null>(null);
  const [genStage, setGenStage] = useState<string | null>(null);
  const [hover, setHover] = useState<{ key: string; items: any[] } | null>(null);
  // V8.9 §5 — drag/drop natif (HTML5 D&D, sans dep). Mobile : MoveMenu déjà.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [dragToast, setDragToast] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);
  const [justMovedId, setJustMovedId] = useState<string | null>(null);

  async function moveByDrag(postId: string, newDateKey: string) {
    const before = posts;
    const before_post = posts.find(p => p.id === postId);
    if (!before_post) return;
    const oldKey = before_post.scheduled_at?.slice(0, 10);
    if (oldKey === newDateKey) return;
    const time = before_post.scheduled_time?.slice(0,5) || '07:30';
    // Optimistic + highlight target card briefly
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, scheduled_at: newDateKey + 'T' + time + ':00.000Z' } : p));
    setJustMovedId(postId);
    setTimeout(() => setJustMovedId(prev => prev === postId ? null : prev), 1200);
    try {
      const r = await fetch(`/api/notion/post/${postId}/move`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: newDateKey, time })
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || 'Erreur déplacement');
      }
      const dayLabel = new Date(newDateKey + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'short' });
      setDragToast({ kind: 'success', msg: 'Déplacé vers ' + dayLabel });
      setTimeout(() => setDragToast(null), 2400);
    } catch (e: any) {
      setPosts(before);
      setJustMovedId(null);
      setDragToast({ kind: 'error', msg: 'Impossible : ' + e.message });
      setTimeout(() => setDragToast(null), 3600);
    }
  }

  // V9.1 §2 — Heatmap perf : impressions moyennes par jour de semaine
  const weekdayPerf = useMemo(() => {
    const sum: Record<number, { total: number; count: number }> = {};
    for (const p of posts) {
      if (p.status !== 'published' || !p.impressions || !p.scheduled_at) continue;
      const dow = new Date(p.scheduled_at).getDay();
      if (!sum[dow]) sum[dow] = { total: 0, count: 0 };
      sum[dow].total += p.impressions;
      sum[dow].count++;
    }
    const avgs: Record<number, number> = {};
    let max = 0;
    for (const [k, v] of Object.entries(sum)) {
      const a = v.total / v.count;
      avgs[parseInt(k)] = a;
      if (a > max) max = a;
    }
    return { avgs, max };
  }, [posts]);

  function perfTint(d: Date): string {
    const avg = weekdayPerf.avgs[d.getDay()];
    if (!avg || !weekdayPerf.max) return '';
    const intensity = avg / weekdayPerf.max;
    if (intensity > 0.8) return 'bg-emerald-50/60';
    if (intensity > 0.5) return 'bg-emerald-50/30';
    return '';
  }

  // V12.9 §3 — Filtre source : LinkedIn confirmé vs brouillons Notion.
  const postsForView = useMemo(() => {
    if (sourceFilter === 'all') return posts;
    return posts.filter((p: any) => {
      const cs = p.provenance?.canonical_source;
      if (sourceFilter === 'linkedin') return cs === 'linkedin' || cs === 'cadence';
      if (sourceFilter === 'notion') return cs === 'notion';
      return true;
    });
  }, [posts, sourceFilter]);

  const byDate = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const p of postsForView) {
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
      if (r.ok) { const d = await r.json(); if (Array.isArray(d.posts)) setPosts(enrichWithProvenance(d.posts)); }
    } catch {/* silent */}
  }

  async function generateWeek() {
    const ok = await confirmDialog({
      title: 'Préparer la semaine prochaine ?',
      body: 'Cadence va rédiger 5 brouillons (lundi à vendredi) en s\'appuyant sur votre ligne éditoriale et le radar. Tous arrivent en NON validé. Rien ne part sur LinkedIn sans votre validation.',
      confirmLabel: 'Préparer',
    });
    if (!ok) return;
    setGenerating(true); setGenResult(null);

    // V8.8 — orchestration visible : 4 étapes que Cadence traverse
    setGenStage('Analyse de votre ligne éditoriale…');
    await new Promise(r => setTimeout(r, 600));
    setGenStage('Recherche dans le Radar (sujets et angles)…');
    await new Promise(r => setTimeout(r, 600));
    setGenStage('Rédaction des 5 drafts par Claude (Sonnet 4.6)…');

    try {
      const r = await fetch('/api/generate-week', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const created = (d.results || []).filter((x: any) => x.status === 'created');

      setGenStage(`Ajout au calendrier (${created.length} cards)…`);
      // Optimistic staged insert : show each card appearing one by one
      for (let i = 0; i < created.length; i++) {
        const c = created[i];
        const optimistic = {
          id: c.id || `optimistic-${Date.now()}-${i}`,
          title: c.title || c.label,
          pilier: c.pilier,
          scheduled_at: c.date ? new Date(c.date + 'T07:30:00').toISOString() : null,
          scheduled_time: '07:30',
          status: 'scheduled',
          validated: false,
          late: false,
          cadence_source: 'cadence',
          cover_url: null
        };
        const optimisticEnriched = enrichWithProvenance([optimistic])[0];
        setPosts(prev => prev.find(p => p.id === optimisticEnriched.id) ? prev : [...prev, optimisticEnriched]);
        await new Promise(res => setTimeout(res, 300));
      }
      setGenStage(null);
      setGenResult({ created: created.length, pilierList: created.map((c: any) => c.pilier) });
      setTimeout(refresh, 800);
    } catch (e: any) { toast.error('Génération impossible : ' + e.message); setGenStage(null); }
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
    const counts = { draft: 0, needs_validation: 0, scheduled: 0, published: 0, archive: 0, late: 0 };
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

  // Stats sur la fenêtre courante mais filtrées par sourceFilter
  const statsFiltered = useMemo(() => {
    const counts = { draft: 0, needs_validation: 0, scheduled: 0, published: 0, archive: 0, late: 0 };
    const start = grid[0]?.[0]; const end = grid[grid.length-1]?.[6];
    if (!start || !end) return counts;
    for (const p of postsForView) {
      if (!p.scheduled_at) continue;
      const d = new Date(p.scheduled_at);
      if (d < start || d > end) continue;
      const st = statusOf(p);
      counts[st as keyof typeof counts]++;
    }
    return counts;
  }, [postsForView, grid]);

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-2xs uppercase tracking-wider font-semibold text-ink-400">Réalité éditoriale LinkedIn</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink-900 tracking-tight">Calendrier</h1>
          <p className="mt-1 text-sm text-ink-500 leading-relaxed">
            {view === 'month' ? `${MONTH_FR[cursor.getMonth()]} ${cursor.getFullYear()}` : `Semaine du ${grid[0]?.[0]?.toLocaleDateString('fr-FR')}`}
            <span className="text-ink-400"> · Source de vérité : LinkedIn. Notion sert de workspace de brouillons.</span>
          </p>
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
          <button
            onClick={generateWeek}
            disabled={generating}
            className="text-xs text-ink-500 hover:text-ink-900 transition px-2 py-1 rounded-md hover:bg-ink-50 inline-flex items-center gap-1.5"
            title="Cadence prépare 5 brouillons non validés pour la semaine prochaine"
          >
            {generating ? (
              <><span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse-soft" /> Cadence prépare la semaine</>
            ) : (
              <>Préparer la semaine</>
            )}
          </button>
        </div>
      </header>

      {genStage && (
        <div className="card p-3 flex items-center gap-3 border-brand-200 bg-brand-50/40 animate-fade-in">
          <span className="dot bg-brand-500 animate-pulse-soft" />
          <span className="text-sm text-ink-700 flex-1">{genStage}</span>
        </div>
      )}

      {/* V12.9 §3 — État éditorial + filtre source */}
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-sm text-ink-600 leading-relaxed flex-1 min-w-[280px]">
          {(() => {
            const parts: string[] = [];
            if (statsFiltered.published > 0) parts.push(`${statsFiltered.published} publié${statsFiltered.published > 1 ? 's' : ''} sur LinkedIn`);
            if (statsFiltered.scheduled > 0) parts.push(`${statsFiltered.scheduled} programmé${statsFiltered.scheduled > 1 ? 's' : ''}`);
            if (statsFiltered.needs_validation > 0) parts.push(`${statsFiltered.needs_validation} à valider`);
            if (statsFiltered.late > 0) parts.push(`${statsFiltered.late} en retard`);
            if (statsFiltered.archive > 0) parts.push(`${statsFiltered.archive} archive${statsFiltered.archive > 1 ? 's' : ''} Notion`);
            if (statsFiltered.draft > 0) parts.push(`${statsFiltered.draft} brouillon${statsFiltered.draft > 1 ? 's' : ''}`);
            if (parts.length === 0) return 'Rien sur cette fenêtre.';
            return parts.join(' · ');
          })()}
        </p>
        <div className="inline-flex bg-ink-100 rounded-lg p-0.5 gap-0.5" role="group" aria-label="Filtre source">
          <button onClick={() => setSourceFilter('all')} className={`px-2.5 py-1 rounded-md text-2xs font-medium transition ${sourceFilter === 'all' ? 'bg-white text-ink-900 shadow-xs' : 'text-ink-500 hover:text-ink-700'}`}>Tout</button>
          <button onClick={() => setSourceFilter('linkedin')} className={`px-2.5 py-1 rounded-md text-2xs font-medium transition ${sourceFilter === 'linkedin' ? 'bg-white text-[#0A66C2] shadow-xs' : 'text-ink-500 hover:text-ink-700'}`} title="Posts publiés ou en route vers LinkedIn">Publié</button>
          <button onClick={() => setSourceFilter('notion')} className={`px-2.5 py-1 rounded-md text-2xs font-medium transition ${sourceFilter === 'notion' ? 'bg-white text-ink-900 shadow-xs' : 'text-ink-500 hover:text-ink-700'}`} title="Brouillons et archives qui vivent uniquement dans Notion">Brouillons</button>
        </div>
      </div>

      {/* Generate result toast — V8.8 with 'Voir les drafts créés' CTA */}
      {genResult && (
        <div className="card p-4 animate-slide-up flex items-center gap-3 border-success-200 bg-success-50/50">
          <span className="w-10 h-10 rounded-full bg-success-500 text-white flex items-center justify-center font-bold">{genResult.created}</span>
          <div className="flex-1">
            <div className="font-semibold text-success-700">{genResult.created} brouillon{genResult.created > 1 ? 's' : ''} créé{genResult.created > 1 ? 's' : ''}</div>
            <div className="text-xs text-ink-500">Tous en non validé. Ouvrez chacun pour relire, ajuster et valider pour publication automatique.</div>
          </div>
          <Link href="/posts?status=needs_validation" className="btn-primary text-xs">Voir les drafts →</Link>
          <button onClick={() => setGenResult(null)} className="btn-ghost">×</button>
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
              const hasItems = items.length > 0;
              return (
                <div
                  key={k}
                  onMouseEnter={() => hasItems && setHover({ key: k, items })}
                  onMouseLeave={() => setHover(null)}
                  onDragOver={(e) => {
                    if (!draggingId) return;
                    e.preventDefault();
                    if (dragOverKey !== k) setDragOverKey(k);
                  }}
                  onDragLeave={() => { if (dragOverKey === k) setDragOverKey(null); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData('text/plain') || draggingId;
                    if (id) moveByDrag(id, k);
                    setDragOverKey(null);
                    setDraggingId(null);
                  }}
                  className={`group relative rounded-xl p-2 min-h-[124px] border transition-all duration-200 ${isToday ? 'border-brand-400 bg-brand-50/30 shadow-elev' : isWeekend ? 'border-ink-100 bg-ink-50/40' : `border-ink-200 ${perfTint(d) || 'bg-white'} hover:border-ink-300 hover:shadow-xs`} ${isOtherMonth ? 'opacity-40' : ''} ${isPast && !isToday ? 'opacity-75' : ''} ${dragOverKey === k && draggingId ? 'ring-2 ring-brand-500 ring-offset-2 bg-brand-50/80' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-semibold ${isToday ? 'text-brand-700' : isWeekend ? 'text-ink-400' : 'text-ink-700'}`}>{d.getDate()}</span>
                    {!isPast && !isWeekend && (
                      <Link href={`/posts/new?date=${k}`} className={`w-5 h-5 rounded-md flex items-center justify-center text-ink-300 hover:text-brand-600 hover:bg-brand-50 transition text-sm ${hasItems ? 'opacity-0 group-hover:opacity-100' : ''}`} title="Créer un post">+</Link>
                    )}
                  </div>
                  <div className="space-y-1">
                    {items.slice(0, 3).map((p: any) => {
                      const t = tone(p.pilier);
                      const st = statusOf(p);
                      // V13.2 — hiérarchie visuelle source-aware. Réalité LinkedIn
                      // (published / scheduled validé) en pleine opacité. Drafts
                      // Notion à 80%. Archives Notion à 60% pour les visuellement
                      // démoter sans les cacher.
                      const sourceOpacity =
                        st === 'archive' ? 'opacity-60' :
                        st === 'draft' || st === 'needs_validation' ? 'opacity-80' :
                        '';
                      return (
                        <div
                          key={p.id}
                          className={`group relative ${draggingId === p.id ? 'opacity-40' : sourceOpacity} ${justMovedId === p.id ? 'ring-2 ring-success-500 ring-offset-1 rounded-lg' : ''} transition-all duration-200`}
                          draggable={!isPast}
                          onDragStart={(e) => { setDraggingId(p.id); try { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; } catch {} }}
                          onDragEnd={() => { setDraggingId(null); setDragOverKey(null); }}
                        >
                          <Link href={`/posts/${p.id}/edit`} draggable={false} className={`block text-2xs rounded-md border ${t.bg} ${t.text} ${t.ring} hover:shadow-xs transition overflow-hidden cursor-grab active:cursor-grabbing`}>
                            {p.cover_url ? (
                              <div className="h-10 bg-cover bg-center" style={{ backgroundImage: `url(${p.cover_url})` }} />
                            ) : (
                              // V8.8 — fallback miniature : gradient subtil par pilier + dot
                              <div className={`h-8 ${t.bg} flex items-center px-1.5`}>
                                <span className={`dot ${t.dot}`} />
                                <span className={`ml-1.5 text-2xs uppercase tracking-wider font-semibold ${t.text} truncate`}>{p.pilier?.split('·')[0]?.trim() || ''}</span>
                              </div>
                            )}
                            <span className="flex items-center gap-1 px-1.5 py-1 truncate">
                              {st === 'published' && <span title="Publié sur LinkedIn" className="text-success-700">✓</span>}
                              {st === 'archive' && <span title="Archive Notion" className="dot bg-amber-500" />}
                              {st === 'late' && <span title="En retard" className="text-danger-500">⚠</span>}
                              {st === 'scheduled' && <span title="Programmé" className="dot bg-brand-500" />}
                              {st === 'needs_validation' && <span title="À valider" className="dot bg-warn-500" />}
                              <ProvenanceBadge provenance={p.provenance} variant="dot" />
                              <span className="font-medium truncate">{p.scheduled_time?.slice(0,5) || ''}</span>
                              <span className="truncate flex-1 opacity-80">{p.title}</span>
                            </span>
                          </Link>
                          <div className="absolute top-0.5 right-0.5">
                            <MoveMenu postId={p.id} currentDate={p.scheduled_at?.slice(0,10)} onMoved={(newIso) => {
                              // Optimistic : update post in state
                              setPosts(prev => prev.map(x => x.id === p.id ? { ...x, scheduled_at: newIso + 'T' + (x.scheduled_time?.slice(0,5) || '07:30') + ':00.000Z' } : x));
                            }} compact />
                          </div>
                        </div>
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
                  <div className="text-2xs text-ink-500">{p.pilier} · {p.scheduled_time || '00:00'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* V8.9.1 §D — Drag toast */}
      {dragToast && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2.5 rounded-xl text-sm font-medium shadow-pop animate-slide-up flex items-center gap-2 ${dragToast.kind === 'success' ? 'bg-success-50 text-success-700 border border-success-100' : 'bg-danger-50 text-danger-700 border border-danger-100'}`}>
          <span>{dragToast.kind === 'success' ? '✓' : '⚠'}</span>
          <span>{dragToast.msg}</span>
        </div>
      )}

      {/* Legend — V13.2 : séparation explicite "Réalité LinkedIn" / "Workspace Notion" */}
      <div className="pt-3 border-t border-ink-100 space-y-2 text-xs text-ink-500">
        <div className="flex items-center gap-5 flex-wrap">
          <span className="text-2xs uppercase tracking-wider font-semibold text-[#0A66C2]">Réalité LinkedIn</span>
          <span className="flex items-center gap-1.5"><span className="text-success-700">✓</span> publié</span>
          <span className="flex items-center gap-1.5"><span className="dot bg-brand-500" /> programmé validé</span>
          <span className="flex items-center gap-1.5"><span className="dot bg-warn-500" /> à valider</span>
          <span className="flex items-center gap-1.5"><span className="text-danger-500">⚠</span> en retard</span>
        </div>
        <div className="flex items-center gap-5 flex-wrap">
          <span className="text-2xs uppercase tracking-wider font-semibold text-ink-500">Workspace Notion</span>
          <span className="flex items-center gap-1.5"><span className="dot bg-amber-500" /> archive non certifiée</span>
          <span className="flex items-center gap-1.5"><span className="dot bg-ink-300" /> brouillon</span>
          {weekdayPerf.max > 0 && (
            <span className="flex items-center gap-1.5 ml-auto">
              <span className="inline-block w-3 h-3 rounded bg-emerald-50/60 border border-emerald-100" />
              jours forts en moyenne
            </span>
          )}
        </div>
        <p className="text-2xs text-ink-400 italic">Aucune publication sans validation explicite.</p>
      </div>
    </div>
  );
}

