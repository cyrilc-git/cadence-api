'use client';

import { useState } from 'react';
import { confirmDialog, toast } from '@/components/Dialog';

const KIND_META: Record<string, { label: string; hint: string; icon: string; tone: 'brand'|'success'|'warn'|'danger'|'neutral' }> = {
  pilier:       { label: 'Piliers éditoriaux', hint: 'Un pilier par jour de la semaine, ou par thème.', icon: '◆', tone: 'brand' },
  audience:     { label: 'Audiences',          hint: 'DAF, fondateurs PME, etc.',                       icon: '☉', tone: 'brand' },
  rule:         { label: 'Règles de voix',     hint: 'Vouvoiement, founder voice, tonalité…',           icon: '✓', tone: 'success' },
  anti_pattern: { label: 'Interdictions',      hint: 'Tiret long, mots creux, formules à bannir.',     icon: '✗', tone: 'danger' },
  hook:         { label: 'Hooks favoris',      hint: 'Premières phrases qui marchent.',                 icon: '↑', tone: 'brand' },
  cta:          { label: 'CTAs favoris',       hint: "Phrases d'appel à action récurrentes.",          icon: '→', tone: 'neutral' },
  format:       { label: 'Formats',            hint: 'Cas client, pédagogie, opinion, build in public.', icon: '▢', tone: 'neutral' },
  hashtag:      { label: 'Hashtags favoris',   hint: 'Hashtags ciblés à privilégier.',                 icon: '#', tone: 'neutral' }
};
const KINDS = Object.keys(KIND_META);

const DAY_TONES: Record<number, { bg: string; text: string; ring: string; dot: string }> = {
  1: { bg: 'bg-blue-50',    text: 'text-blue-700',    ring: 'border-blue-200',    dot: 'bg-blue-500' },
  2: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'border-emerald-200', dot: 'bg-emerald-500' },
  3: { bg: 'bg-violet-50',  text: 'text-violet-700',  ring: 'border-violet-200',  dot: 'bg-violet-500' },
  4: { bg: 'bg-amber-50',   text: 'text-amber-700',   ring: 'border-amber-200',   dot: 'bg-amber-500' },
  5: { bg: 'bg-pink-50',    text: 'text-pink-700',    ring: 'border-pink-200',    dot: 'bg-pink-500' },
};
const DAY_LABELS: Record<number, string> = { 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi', 5: 'Vendredi' };

export default function BrandDnaClient({ initial, initialPlan = [] }: { initial: any[]; initialPlan?: any[] }) {
  const [items, setItems] = useState(initial);
  const [adding, setAdding] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [generating, setGenerating] = useState<'day' | 'week' | 'month' | null>(null);
  const [genResult, setGenResult] = useState<any | null>(null);

  async function add(kind: string) {
    if (!newLabel.trim()) return;
    const r = await fetch('/api/brand-dna', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, label: newLabel.trim() }) });
    const d = await r.json();
    if (r.ok) { setItems([...items, d.item]); setNewLabel(''); setAdding(null); toast.success('Élément ajouté'); }
    else toast.error(d.error || 'Ajout impossible');
  }
  async function remove(id: string) {
    const target = items.find(i => i.id === id);
    const ok = await confirmDialog({
      title: 'Supprimer cet élément ?',
      body: target?.label ? `« ${target.label} » sera retiré de votre ligne éditoriale.` : undefined,
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (!ok) return;
    const r = await fetch(`/api/brand-dna/${id}`, { method: 'DELETE' });
    if (r.ok) { setItems(items.filter(i => i.id !== id)); toast.success('Élément supprimé'); }
    else toast.error('Suppression impossible');
  }
  async function restoreDefaults() {
    const ok = await confirmDialog({
      title: 'Restaurer les défauts Cadence ?',
      body: 'Cadence ajoutera uniquement les éléments manquants. Vos personnalisations actuelles ne seront pas touchées.',
      confirmLabel: 'Restaurer',
    });
    if (!ok) return;
    setRestoring(true);
    try {
      const r = await fetch('/api/seed', { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const list = await fetch('/api/brand-dna').then(x => x.json());
      setItems(list.items || []);
      toast.success('Défauts restaurés');
    } catch (e: any) { toast.error('Restauration impossible : ' + e.message); }
    finally { setRestoring(false); }
  }
  async function generate(period: 'day' | 'week' | 'month') {
    const labels = { day: '1 brouillon pour le prochain jour de pilier', week: '5 brouillons pour la semaine prochaine (lundi à vendredi)', month: 'jusqu\'à 20 brouillons pour les 4 prochaines semaines' };
    const ok = await confirmDialog({
      title: `Générer ${labels[period]} ?`,
      body: 'Tous arrivent en NON validé dans la bibliothèque. Aucune publication tant que vous ne validez pas chaque post.',
      confirmLabel: 'Générer',
    });
    if (!ok) return;
    setGenerating(period); setGenResult(null);
    try {
      const r = await fetch('/api/generate-week', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ period }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setGenResult(d);
      toast.success(`${d.created || ''} brouillon${d.created > 1 ? 's' : ''} prêt${d.created > 1 ? 's' : ''} à relire`);
    } catch (e: any) { toast.error('Génération impossible : ' + e.message); }
    finally { setGenerating(null); }
  }

  const weekdayItems = (initialPlan || []).filter((s: any) => s.weekday >= 1 && s.weekday <= 5);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900 tracking-tight">Ligne éditoriale</h1>
          <p className="mt-1 text-sm text-ink-500 lead">Votre voix, vos règles, vos interdits, votre planning hebdo. Cadence respecte tout ce qui est ici lors de chaque génération.</p>
        </div>
        <button onClick={restoreDefaults} disabled={restoring} className="btn-secondary">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M21 12a9 9 0 11-3-6.7L21 8 M21 3v5h-5"/></svg>
          {restoring ? 'Restauration…' : 'Restaurer défauts Cadence'}
        </button>
      </header>

      {/* Weekly planner */}
      <section className="card p-6 bg-gradient-to-br from-brand-50/30 to-white border-brand-100">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div>
            <h2 className="font-semibold text-ink-900 flex items-center gap-2">
              <svg className="w-4 h-4 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path strokeLinecap="round" d="M3 9h18 M8 3v4 M16 3v4"/></svg>
              Planner hebdomadaire
            </h2>
            <p className="text-xs text-ink-500 mt-0.5">5 jours, 5 piliers. Cadence génère un draft équilibré pour chaque jour.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => generate('day')}   disabled={!!generating} className="btn-secondary text-xs">{generating === 'day' ? 'Gén…' : 'Générer 1 jour'}</button>
            <button onClick={() => generate('week')}  disabled={!!generating} className="btn-primary text-xs">
              {generating === 'week' ? (<><span className="dot bg-white animate-pulse-soft" /> Génération…</>) : (<>Générer ma semaine</>)}
            </button>
            <button onClick={() => generate('month')} disabled={!!generating} className="btn-secondary text-xs">{generating === 'month' ? 'Gén…' : 'Générer 1 mois'}</button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {weekdayItems.map((slot: any) => {
            const t = DAY_TONES[slot.weekday] || DAY_TONES[1];
            return (
              <div key={slot.weekday} className={`rounded-xl p-4 border ${t.bg} ${t.ring} hover:shadow-elev transition relative overflow-hidden`}>
                <span className={`dot ${t.dot} absolute top-3 right-3`} />
                <div className={`text-2xs uppercase font-bold tracking-wider ${t.text}`}>{DAY_LABELS[slot.weekday] || slot.label}</div>
                <div className="mt-1.5 text-sm font-semibold text-ink-900 leading-tight min-h-[2.4em]">
                  {slot.pilier ? (slot.pilier.split('· ')[1] || slot.pilier) : <span className="text-ink-400 italic font-normal">Non défini</span>}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-xs text-ink-500">Chaque brouillon généré reste <strong className="text-ink-700">non validé</strong> jusqu'à votre validation explicite. Le cron quotidien ne publie que les drafts validés.</p>
      </section>

      {/* Categories */}
      {KINDS.map(kind => {
        const list = items.filter(i => i.kind === kind);
        const meta = KIND_META[kind];
        return (
          <section key={kind} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0 chip-${meta.tone}`}>{meta.icon}</div>
                <div>
                  <h2 className="font-semibold text-ink-900">{meta.label}</h2>
                  <p className="text-xs text-ink-500 mt-0.5">{meta.hint}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xs font-semibold text-ink-500">{list.length}</span>
                <button onClick={() => setAdding(adding === kind ? null : kind)} className="btn-ghost text-xs">
                  {adding === kind ? '× Annuler' : '+ Ajouter'}
                </button>
              </div>
            </div>
            {adding === kind && (
              <div className="mt-3 flex gap-2">
                <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder={`Nouveau ${meta.label.toLowerCase()}…`} className="input text-sm flex-1" autoFocus onKeyDown={e => e.key === 'Enter' && add(kind)} />
                <button onClick={() => add(kind)} className="btn-primary text-sm">Ajouter</button>
              </div>
            )}
            {list.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {list.map(i => (
                  <span key={i.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-ink-200 bg-white text-xs text-ink-800 group hover:border-ink-300 transition">
                    {i.label}
                    <button onClick={() => remove(i.id)} className="text-ink-400 hover:text-danger-700 transition opacity-0 group-hover:opacity-100" title="Supprimer">×</button>
                  </span>
                ))}
              </div>
            )}
            {list.length === 0 && !adding && (
              <p className="mt-3 text-xs text-ink-400 italic">Aucun élément. Ajoutez-en pour enrichir le contexte de génération.</p>
            )}
          </section>
        );
      })}

      {/* Generation result modal */}
      {genResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-ink-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setGenResult(null)}>
          <div className="card max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-2">
              <span className="w-10 h-10 rounded-full bg-success-500 text-white flex items-center justify-center font-bold">{genResult.created_count}</span>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-ink-900">{genResult.created_count} brouillon(s) créé(s)</h3>
                <p className="text-sm text-ink-500">{genResult.note}</p>
              </div>
              <button onClick={() => setGenResult(null)} className="btn-ghost">×</button>
            </div>
            <div className="mt-4 space-y-2">
              {genResult.results.map((r: any, i: number) => (
                <div key={i} className="card p-3 border-ink-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`chip ${r.status === 'created' ? 'chip-success' : 'chip-warn'} text-2xs`}>{r.status}</span>
                    <span className="text-xs text-ink-500">{r.label} · {r.date}</span>
                    {r.pilier && <span className="text-xs text-ink-500 truncate">· {r.pilier}</span>}
                  </div>
                  {r.title && <div className="mt-1 text-sm font-medium text-ink-900">{r.title}</div>}
                  {r.excerpt && <div className="mt-1 text-xs text-ink-500 line-clamp-2">{r.excerpt}</div>}
                  {r.error && <div className="mt-1 text-xs text-danger-700">{r.error}</div>}
                  {r.status === 'created' && (
                    <div className="mt-2 flex gap-2">
                      {r.notion_url && <a href={r.notion_url} target="_blank" rel="noopener" className="btn-ghost text-2xs">Notion ↗</a>}
                      <a href={r.edit_url} className="btn-primary text-2xs">Éditer</a>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-5 flex gap-2 justify-end pt-3 border-t border-ink-100">
              <a href="/calendar" className="btn-secondary">Voir dans le calendrier</a>
              <button onClick={() => setGenResult(null)} className="btn-primary">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
