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

export default function CalendarClient({
  initialPosts,
  showNotion = false,
  initialDate = null,
  initialSource = null,
}: {
  initialPosts: any[];
  showNotion?: boolean;
  // V37.1 — Position de départ optionnelle (depuis ?d=YYYY-MM-DD)
  initialDate?: string | null;
  // V37.1 — Filtre source de départ optionnel (depuis ?source=linkedin)
  initialSource?: 'linkedin' | 'notion' | 'all' | null;
}) {
  const [posts, setPosts] = useState(() => enrichWithProvenance(initialPosts));
  // V12.9 §3 + V18 §calendar-clean — Filtre source :
  // 'all' / 'linkedin' / 'notion'. Par défaut 'linkedin' (= LinkedIn +
  // Cadence) pour masquer les brouillons Notion bruts. L'utilisateur peut
  // réactiver l'affichage Notion via le toggle dans /settings/notion qui
  // remonte ici en prop showNotion.
  // V37.1 — initialSource du query param ?source=… écrase la valeur par défaut.
  const [sourceFilter, setSourceFilter] = useState<'all' | 'linkedin' | 'notion'>(
    initialSource || (showNotion ? 'all' : 'linkedin')
  );
  // V14.6 — Cursor init à aujourd'hui plutôt que le 1er du mois. En vue
  // semaine, partir du 1er affichait la semaine contenant le 1er, jamais
  // la semaine en cours. Maintenant on landait toujours sur la semaine de
  // today, cohérent avec "voici ce qui se passe maintenant".
  // V37.1 — Si l'URL fournit ?d=YYYY-MM-DD, on positionne le calendrier dessus.
  // Sinon : date du jour. V37.2 (plus bas, useEffect) repositionne automatiquement
  // si la fenêtre est vide alors qu'il y a des posts LinkedIn ailleurs.
  const [cursor, setCursor] = useState<Date>(() => {
    if (initialDate) {
      const d = new Date(initialDate + 'T00:00:00');
      if (Number.isFinite(d.getTime())) return d;
    }
    const d = new Date(); d.setHours(0,0,0,0); return d;
  });
  // V37.2 — Flag pour ne pas re-jump automatiquement à chaque render :
  // l'auto-position ne se déclenche qu'UNE SEULE FOIS au mount.
  const [autoPositioned, setAutoPositioned] = useState<boolean>(!!initialDate);
  // V9.1 §2 — vue semaine par défaut (Notion Calendar / Linear style)
  // V36.2 — Vue mois par défaut. La vue semaine était trop étroite pour
  // visualiser le rythme éditorial réel, et restait sur la semaine courante
  // ce qui rendait les posts importés (souvent datés sur plusieurs années)
  // invisibles par défaut.
  const [view, setView] = useState<'month' | 'week'>('month');
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<{ created: number; pilierList: string[] } | null>(null);
  const [genStage, setGenStage] = useState<string | null>(null);
  const [hover, setHover] = useState<{ key: string; items: any[] } | null>(null);
  // V8.9 §5 — drag/drop natif (HTML5 D&D, sans dep). Mobile : MoveMenu déjà.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [dragToast, setDragToast] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);
  const [justMovedId, setJustMovedId] = useState<string | null>(null);
  // V38.4 — Day picker : clic sur un jour ouvre un sélecteur de brouillons
  // à programmer sur ce jour (plus besoin de viser le petit "+").
  const [dayPicker, setDayPicker] = useState<{ key: string } | null>(null);

  // V38.4 — Programme un brouillon (non daté ou ailleurs) sur un jour précis.
  // Réutilise l'endpoint move. Optimistic. Heure par défaut 07:30.
  async function scheduleDraftOnDay(postId: string, dateKey: string) {
    const before = posts;
    const p = posts.find(x => x.id === postId);
    if (!p) return;
    const time = p.scheduled_time?.slice(0, 5) || '07:30';
    setPosts(prev => prev.map(x => x.id === postId ? { ...x, scheduled_at: dateKey + 'T' + time + ':00.000Z' } : x));
    setJustMovedId(postId);
    setDayPicker(null);
    setTimeout(() => setJustMovedId(prev => prev === postId ? null : prev), 1200);
    try {
      const r = await fetch(`/api/notion/post/${postId}/move`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateKey, time }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Erreur programmation'); }
      const dayLabel = new Date(dateKey + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'short' });
      setDragToast({ kind: 'success', msg: 'Programmé le ' + dayLabel });
      setTimeout(() => setDragToast(null), 2400);
    } catch (e: any) {
      setPosts(before);
      setJustMovedId(null);
      setDragToast({ kind: 'error', msg: 'Impossible : ' + e.message });
      setTimeout(() => setDragToast(null), 3600);
    }
  }

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

  // V36.3 — Range complet des posts (min / max scheduled_at) pour
  // construire un hint "vos N posts s'étalent de X à Y" quand la fenêtre
  // active est vide. Critique pour les imports LinkedIn datés sur plusieurs
  // années : sans ce hint, on croit que rien n'a été importé.
  const fullRange = useMemo(() => {
    let min: Date | null = null;
    let max: Date | null = null;
    let total = 0;
    for (const p of postsForView) {
      if (!p.scheduled_at) continue;
      const d = new Date(p.scheduled_at);
      if (!Number.isFinite(d.getTime())) continue;
      total++;
      if (!min || d < min) min = d;
      if (!max || d > max) max = d;
    }
    return { min, max, total };
  }, [postsForView]);

  // V36.3 — Fenêtre actuelle vide alors qu'il y a des posts ailleurs ?
  const totalInWindow = statsFiltered.published + statsFiltered.scheduled +
    statsFiltered.needs_validation + statsFiltered.late +
    statsFiltered.archive + statsFiltered.draft;
  const isWindowEmpty = totalInWindow === 0 && fullRange.total > 0;

  // V37.2 — Auto-position au mount : si la fenêtre courante est vide pour
  // le filtre sélectionné MAIS qu'il y a des posts ailleurs, on saute
  // directement sur le mois du post le plus récent. Évite à l'utilisateur
  // d'avoir à naviguer manuellement pour retrouver ses imports.
  useEffect(() => {
    if (autoPositioned) return;
    if (!isWindowEmpty) { setAutoPositioned(true); return; }
    if (!fullRange.max) return;
    const target = new Date(fullRange.max);
    target.setHours(0, 0, 0, 0);
    setCursor(target);
    setAutoPositioned(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // V37.4 — Mini timeline historique : densité mois par mois sur toute
  // la période où il y a des posts. Permet de comprendre visuellement
  // OÙ se trouve l'historique et de naviguer en 1 clic. Discret : barres
  // verticales 4px de large, hauteur proportionnelle (max 28px).
  const historyTimeline = useMemo(() => {
    if (!fullRange.min || !fullRange.max || fullRange.total === 0) return null;
    // Buckets : 1 par mois entre min et max (inclus). On clamp à 84 mois
    // (7 ans) max pour ne pas exploser la barre sur des archives plus longues.
    const start = new Date(fullRange.min.getFullYear(), fullRange.min.getMonth(), 1);
    const end = new Date(fullRange.max.getFullYear(), fullRange.max.getMonth(), 1);
    const months: Array<{ ym: string; year: number; month: number; count: number; label: string }> = [];
    const d = new Date(start);
    while (d <= end && months.length < 84) {
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({
        ym, year: d.getFullYear(), month: d.getMonth(), count: 0,
        label: `${MONTH_FR[d.getMonth()]} ${d.getFullYear()}`,
      });
      d.setMonth(d.getMonth() + 1);
    }
    // Compte les posts par mois
    for (const p of postsForView) {
      if (!p.scheduled_at) continue;
      const pd = new Date(p.scheduled_at);
      if (!Number.isFinite(pd.getTime())) continue;
      const ym = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, '0')}`;
      const bucket = months.find(m => m.ym === ym);
      if (bucket) bucket.count++;
    }
    const max = Math.max(1, ...months.map(m => m.count));
    return { months, max };
  }, [postsForView, fullRange.min, fullRange.max, fullRange.total]);

  // V37.3 — Décompte par SOURCE sur la fenêtre courante (LinkedIn confirmé
  // vs brouillon Notion vs archive Notion). Affiché sous le H1 pour donner
  // la photo claire de ce que la période contient.
  const sourceBreakdown = useMemo(() => {
    const counts = { linkedin: 0, notion_draft: 0, notion_archive: 0 };
    const start = grid[0]?.[0]; const end = grid[grid.length - 1]?.[6];
    if (!start || !end) return counts;
    for (const p of posts) {
      if (!p.scheduled_at) continue;
      const d = new Date(p.scheduled_at);
      if (d < start || d > end) continue;
      const cs = (p as any).provenance?.canonical_source;
      const st = (p as any).provenance?.source_type;
      if (cs === 'linkedin' || cs === 'cadence') counts.linkedin++;
      else if (st === 'notion_archive') counts.notion_archive++;
      else if (cs === 'notion') counts.notion_draft++;
    }
    return counts;
  }, [posts, grid]);

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-2xs uppercase tracking-wider font-semibold text-ink-400">Réalité éditoriale LinkedIn</p>
          {/* V36.3 — Titre intègre la période active (mois ou semaine).
              En vue mois : "Mai 2026". En vue semaine : "Semaine du 25 mai
              · Mai 2026". On rend la période visible AU NIVEAU DU H1,
              plus seulement en sous-titre. */}
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-ink-900 tracking-tight">
            {view === 'month'
              ? `${MONTH_FR[cursor.getMonth()]} ${cursor.getFullYear()}`
              : (() => {
                  const start = grid[0]?.[0];
                  const end = grid[0]?.[6];
                  if (!start || !end) return 'Calendrier';
                  const sameMonth = start.getMonth() === end.getMonth();
                  const startStr = start.toLocaleDateString('fr-FR', { day: 'numeric', month: sameMonth ? undefined : 'short' });
                  const endStr = end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                  return `Semaine du ${startStr} → ${endStr}`;
                })()
            }
          </h1>
          {view === 'week' && (
            <p className="mt-1 text-sm text-ink-600 leading-relaxed">
              {MONTH_FR[cursor.getMonth()]} {cursor.getFullYear()}
            </p>
          )}
          {/* V37.3 — Décompte par source sur la fenêtre courante :
              "0 publication LinkedIn · 4 brouillons Notion". Si la fenêtre
              est totalement vide ET qu'on ne montre pas le hint plus bas,
              on dit explicitement "Aucun post sur cette période". */}
          <p className="mt-1 text-sm text-ink-600 leading-relaxed">
            {(() => {
              const parts: string[] = [];
              if (sourceBreakdown.linkedin > 0) parts.push(`${sourceBreakdown.linkedin} publication${sourceBreakdown.linkedin > 1 ? 's' : ''} LinkedIn`);
              if (sourceBreakdown.notion_draft > 0) parts.push(`${sourceBreakdown.notion_draft} brouillon${sourceBreakdown.notion_draft > 1 ? 's' : ''} Notion`);
              if (sourceBreakdown.notion_archive > 0) parts.push(`${sourceBreakdown.notion_archive} archive${sourceBreakdown.notion_archive > 1 ? 's' : ''} Notion`);
              if (parts.length === 0) return 'Aucun post sur cette période.';
              return parts.join(' · ');
            })()}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex bg-ink-100 rounded-lg p-0.5 gap-0.5">
            <button onClick={() => setView('month')} className={`px-3 py-1 rounded-md text-xs font-medium transition ${view === 'month' ? 'bg-white text-ink-900 shadow-xs' : 'text-ink-600'}`}>Mois</button>
            <button onClick={() => setView('week')}  className={`px-3 py-1 rounded-md text-xs font-medium transition ${view === 'week'  ? 'bg-white text-ink-900 shadow-xs' : 'text-ink-600'}`}>Semaine</button>
          </div>
          <div className="flex items-center gap-1">
            {/* V36.3 — En vue semaine, la navigation prev/next bouge d'une
                semaine (pas d'un mois). En vue mois, on reste à -/+ 1 mois. */}
            <button
              onClick={() => {
                const d = new Date(cursor);
                if (view === 'week') d.setDate(d.getDate() - 7); else d.setMonth(d.getMonth() - 1);
                setCursor(d);
              }}
              className="btn-secondary w-9 h-9 p-0"
              aria-label={view === 'week' ? 'Semaine précédente' : 'Mois précédent'}
            >‹</button>
            <button onClick={() => { const d = new Date(); d.setHours(0,0,0,0); setCursor(d); }} className="btn-secondary text-xs">Aujourd&apos;hui</button>
            <button
              onClick={() => {
                const d = new Date(cursor);
                if (view === 'week') d.setDate(d.getDate() + 7); else d.setMonth(d.getMonth() + 1);
                setCursor(d);
              }}
              className="btn-secondary w-9 h-9 p-0"
              aria-label={view === 'week' ? 'Semaine suivante' : 'Mois suivant'}
            >›</button>
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

      {/* V37.4 — Mini timeline historique. Affichée seulement si > 6 mois
          de range pour éviter le bruit visuel sur un usage courant. */}
      {historyTimeline && historyTimeline.months.length > 6 && (
        <div className="flex items-end gap-px h-8 overflow-x-auto">
          {historyTimeline.months.map(m => {
            const isActive = view === 'month'
              ? (m.year === cursor.getFullYear() && m.month === cursor.getMonth())
              : (m.year === grid[0]?.[0]?.getFullYear() && m.month === grid[0]?.[0]?.getMonth());
            const h = m.count === 0 ? 3 : Math.max(4, Math.round((m.count / historyTimeline.max) * 28));
            const isYearBoundary = m.month === 0;
            return (
              <button
                key={m.ym}
                onClick={() => {
                  const d = new Date(m.year, m.month, 1);
                  setCursor(d);
                  if (view === 'week') setView('month');
                }}
                className={`flex-shrink-0 w-1.5 rounded-sm transition-colors ${
                  m.count === 0
                    ? 'bg-ink-100 hover:bg-ink-200'
                    : isActive
                      ? 'bg-brand-700'
                      : 'bg-brand-300 hover:bg-brand-500'
                } ${isYearBoundary ? 'ml-1.5 sm:ml-2' : ''}`}
                style={{ height: `${h}px` }}
                title={`${m.label} — ${m.count} post${m.count > 1 ? 's' : ''}`}
                aria-label={`${m.label}, ${m.count} post${m.count > 1 ? 's' : ''}`}
              />
            );
          })}
        </div>
      )}

      {/* V36.3 — Bandeau "vos posts existent ailleurs" quand la fenêtre
          active est vide mais que postsForView en contient. Critique pour
          les imports LinkedIn datés sur plusieurs années : sans ce hint, on
          croit que l'import a échoué. */}
      {isWindowEmpty && fullRange.min && fullRange.max && (
        <div className="border-l-2 border-amber-300 pl-4 py-2 animate-fade-in">
          <p className="text-sm text-ink-800 leading-relaxed">
            {fullRange.total} post{fullRange.total > 1 ? 's' : ''} en mémoire, du{' '}
            <span className="font-medium">
              {fullRange.min.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
            </span>{' '}
            au{' '}
            <span className="font-medium">
              {fullRange.max.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
            </span>
            . Rien sur la {view === 'week' ? 'semaine' : 'période'} affichée.
          </p>
          <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
            <button
              onClick={() => {
                const d = new Date(fullRange.max!);
                d.setHours(0, 0, 0, 0);
                setCursor(d);
              }}
              className="text-brand-700 hover:text-brand-900 transition underline decoration-dotted underline-offset-2"
            >
              Aller au plus récent ({fullRange.max.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}) →
            </button>
            <span className="text-ink-300">·</span>
            <button
              onClick={() => {
                const d = new Date(fullRange.min!);
                d.setHours(0, 0, 0, 0);
                setCursor(d);
              }}
              className="text-ink-500 hover:text-ink-900 transition"
            >
              Aller au plus ancien
            </button>
          </div>
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
          {/* V18 §calendar-clean — bouton "Brouillons" caché par défaut.
              Visible uniquement si l'utilisateur a explicitement activé
              "Afficher Notion dans le calendrier" depuis /settings/notion.
              Le bouton "Tout" est conservé même quand Notion est masqué,
              mais en pratique il aura le même contenu que "Publié". */}
          {showNotion && (
            <button onClick={() => setSourceFilter('all')} className={`px-2.5 py-1 rounded-md text-2xs font-medium transition ${sourceFilter === 'all' ? 'bg-white text-ink-900 shadow-xs' : 'text-ink-500 hover:text-ink-700'}`}>Tout</button>
          )}
          <button onClick={() => setSourceFilter('linkedin')} className={`px-2.5 py-1 rounded-md text-2xs font-medium transition ${sourceFilter === 'linkedin' ? 'bg-white text-[#0A66C2] shadow-xs' : 'text-ink-500 hover:text-ink-700'}`} title="Posts publiés ou en route vers LinkedIn">LinkedIn{showNotion ? '' : ' & Cadence'}</button>
          {showNotion && (
            <button onClick={() => setSourceFilter('notion')} className={`px-2.5 py-1 rounded-md text-2xs font-medium transition ${sourceFilter === 'notion' ? 'bg-white text-ink-900 shadow-xs' : 'text-ink-500 hover:text-ink-700'}`} title="Brouillons et archives qui vivent uniquement dans Notion">Brouillons Notion</button>
          )}
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
                  {/* V38.4 — Couche cliquable de fond : un clic n'importe où sur
                      le jour (zone vide) ouvre le sélecteur de brouillons.
                      z-0, sous le contenu (z-10) pour ne pas bloquer les posts.
                      Désactivée sur les jours passés (pas de programmation). */}
                  {!isPast && (
                    <button
                      type="button"
                      onClick={() => setDayPicker({ key: k })}
                      className="absolute inset-0 z-0 rounded-xl cursor-pointer"
                      aria-label={`Programmer un post le ${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`}
                      title="Cliquez pour programmer un brouillon ce jour"
                    />
                  )}
                  <div className="relative z-10 flex items-center justify-between mb-1.5 pointer-events-none">
                    <span className={`text-xs font-semibold ${isToday ? 'text-brand-700' : isWeekend ? 'text-ink-400' : 'text-ink-700'}`}>{d.getDate()}</span>
                    {!isPast && !isWeekend && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDayPicker({ key: k }); }}
                        className={`pointer-events-auto w-5 h-5 rounded-md flex items-center justify-center text-ink-300 hover:text-brand-600 hover:bg-brand-50 transition text-sm ${hasItems ? 'opacity-0 group-hover:opacity-100' : ''}`}
                        title="Programmer un post"
                      >+</button>
                    )}
                  </div>
                  <div className="relative z-10 space-y-1">
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
                              <div className="relative h-10 bg-cover bg-center" style={{ backgroundImage: `url(${p.cover_url})` }}>
                                {p.is_carousel && (
                                  <span className="absolute bottom-0.5 right-0.5 inline-flex items-center rounded bg-ink-900/75 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white" title="Carrousel">Carrousel</span>
                                )}
                              </div>
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

      {/* V38.4 — Day picker : clic sur un jour → choisir un brouillon à
          programmer, ou créer un nouveau post pour ce jour. */}
      {dayPicker && (() => {
        const dayLabel = new Date(dayPicker.key + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        // Brouillons programmables : non datés ou datés un autre jour, statut draft / à valider.
        const schedulable = posts.filter(p => {
          const st = statusOf(p);
          if (st !== 'draft' && st !== 'needs_validation') return false;
          const cur = p.scheduled_at?.slice(0, 10);
          return cur !== dayPicker.key;
        }).slice(0, 12);
        // Posts déjà sur ce jour
        const alreadyHere = posts.filter(p => p.scheduled_at?.slice(0, 10) === dayPicker.key);
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 bg-ink-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setDayPicker(null)}>
            <div className="bg-white rounded-2xl shadow-pop w-full max-w-md max-h-[80vh] overflow-y-auto p-5 animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="flex items-baseline justify-between mb-1">
                <h3 className="text-lg font-semibold text-ink-900 capitalize">{dayLabel}</h3>
                <button onClick={() => setDayPicker(null)} className="text-ink-400 hover:text-ink-900 transition text-xl leading-none">×</button>
              </div>

              {alreadyHere.length > 0 && (
                <p className="text-xs text-ink-500 mb-3">
                  {alreadyHere.length} post{alreadyHere.length > 1 ? 's' : ''} déjà programmé{alreadyHere.length > 1 ? 's' : ''} ce jour.
                </p>
              )}

              {/* Action principale : nouveau post pour ce jour */}
              <Link
                href={`/posts/new?date=${dayPicker.key}`}
                className="btn-primary text-sm w-full justify-center mb-4 inline-flex"
              >
                Écrire un nouveau post pour ce jour →
              </Link>

              {/* Brouillons existants à programmer ici */}
              {schedulable.length > 0 ? (
                <div>
                  <p className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-2">Programmer un brouillon ici</p>
                  <ul className="space-y-1">
                    {schedulable.map(p => (
                      <li key={p.id}>
                        <button
                          onClick={() => scheduleDraftOnDay(p.id, dayPicker.key)}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-ink-50 transition flex items-center gap-2.5 group/d"
                        >
                          <span className={`dot ${tone(p.pilier).dot} shrink-0`} />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm text-ink-800 truncate group-hover/d:text-ink-900">{p.title || 'Brouillon sans titre'}</span>
                            <span className="block text-2xs text-ink-400">
                              {p.pilier ? p.pilier.split('·')[1]?.trim() || p.pilier : 'Sans pilier'}
                              {p.scheduled_at ? ` · actuellement ${new Date(p.scheduled_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}` : ' · non daté'}
                            </span>
                          </span>
                          <span className="text-2xs text-brand-700 opacity-0 group-hover/d:opacity-100 transition shrink-0">Programmer →</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-ink-500 leading-relaxed">
                  Aucun brouillon en attente. <Link href={`/posts/new?date=${dayPicker.key}`} className="text-brand-700 hover:text-brand-900 underline decoration-dotted underline-offset-2">Écrivez-en un</Link> pour ce jour.
                </p>
              )}
            </div>
          </div>
        );
      })()}

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

