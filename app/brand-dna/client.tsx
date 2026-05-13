'use client';

import { useState } from 'react';

const KIND_LABEL = {
  pilier:       { label: 'Piliers éditoriaux', hint: 'Un pilier par jour de la semaine, ou par thème.' },
  rule:         { label: 'Règles de voix',     hint: 'Vouvoiement, founder voice, tonalité…' },
  anti_pattern: { label: 'Interdictions',      hint: 'Tiret long, mots creux, formules à bannir.' },
  hashtag:      { label: 'Hashtags favoris',   hint: 'Hashtags ciblés à privilégier.' },
  cta:          { label: 'CTAs favoris',       hint: "Phrases d'appel à action récurrentes." },
  hook:         { label: 'Hooks favoris',      hint: 'Premières phrases qui marchent.' },
  audience:     { label: 'Audiences',          hint: 'DAF, fondateurs PME, etc.' },
  format:       { label: 'Formats',            hint: 'Cas client, pédagogie, opinion, build in public.' }
} as Record<string, { label: string; hint: string }>;
const KINDS = Object.keys(KIND_LABEL);

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
    if (r.ok) { setItems([...items, d.item]); setNewLabel(''); setAdding(null); } else alert(d.error);
  }
  async function remove(id: string) {
    if (!confirm('Supprimer cet élément ?')) return;
    const r = await fetch(`/api/brand-dna/${id}`, { method: 'DELETE' });
    if (r.ok) setItems(items.filter(i => i.id !== id));
  }
  async function restoreDefaults() {
    if (!confirm('Restaurer les valeurs par défaut Cadence ? Cela ajoute uniquement les éléments manquants.')) return;
    setRestoring(true);
    try {
      const r = await fetch('/api/seed', { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const list = await fetch('/api/brand-dna').then(x => x.json());
      setItems(list.items || []);
    } catch (e: any) { alert('Erreur restauration : ' + e.message); }
    finally { setRestoring(false); }
  }
  async function generate(period: 'day' | 'week' | 'month') {
    const labels = { day: '1 brouillon (prochain jour de pilier)', week: '5 brouillons (lundi → vendredi)', month: 'jusqu\'à 20 brouillons (4 semaines)' };
    if (!confirm(`Générer ${labels[period]} ? Tous en NON validé. Aucune publication.`)) return;
    setGenerating(period); setGenResult(null);
    try {
      const r = await fetch('/api/generate-week', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ period }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setGenResult(d);
    } catch (e: any) { alert('Erreur : ' + e.message); }
    finally { setGenerating(null); }
  }

  const weekdayItems = (initialPlan || []).filter((s: any) => s.weekday >= 1 && s.weekday <= 5);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold text-ink-900">Brand DNA</h1>
          <p className="mt-1 text-ink-500">Votre voix, vos règles, vos interdits. Modifiable, persistant.</p>
        </div>
        <button onClick={restoreDefaults} disabled={restoring} className="px-4 py-2 rounded-lg ring-1 ring-ink-300 text-sm font-medium hover:bg-ink-50 disabled:opacity-50">
          {restoring ? 'Restauration…' : '↺ Restaurer les valeurs par défaut Cadence'}
        </button>
      </header>

      <section className="bg-white rounded-2xl p-6 shadow-card ring-1 ring-inset ring-ink-300/20">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div>
            <h2 className="font-semibold text-ink-900">Plan éditorial de la semaine</h2>
            <p className="text-xs text-ink-500 mt-0.5">Chaque jour correspond à un pilier. Modifiable dans la section Piliers ci-dessous.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => generate('day')}   disabled={!!generating} className="px-3 py-1.5 rounded-lg ring-1 ring-brand-500 text-brand-700 text-xs font-medium hover:bg-brand-50 disabled:opacity-50">{generating === 'day' ? 'Gén…' : 'Générer 1 jour'}</button>
            <button onClick={() => generate('week')}  disabled={!!generating} className="px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-medium hover:bg-brand-600 disabled:opacity-50">{generating === 'week' ? 'Génération…' : '✨ Générer ma semaine'}</button>
            <button onClick={() => generate('month')} disabled={!!generating} className="px-3 py-1.5 rounded-lg ring-1 ring-brand-500 text-brand-700 text-xs font-medium hover:bg-brand-50 disabled:opacity-50">{generating === 'month' ? 'Gén…' : 'Générer 1 mois'}</button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {weekdayItems.map((slot: any) => (
            <div key={slot.weekday} className={`rounded-xl p-4 ring-1 ring-inset ${slot.pilier ? 'ring-brand-500/30 bg-brand-50/30' : 'ring-ink-300/30 bg-ink-50'}`}>
              <div className="text-xs font-semibold text-ink-500 uppercase tracking-wide">{slot.label}</div>
              <div className="mt-1 text-sm font-medium text-ink-900 leading-tight">
                {slot.pilier ? (slot.pilier.split('· ')[1] || slot.pilier) : <span className="text-ink-400 italic">Non défini</span>}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-500">Chaque brouillon créé reste <strong>non validé</strong> jusqu'à votre validation explicite. Le cron quotidien ne publie que les drafts validés.</p>
      </section>

      {genResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-ink-900/40 backdrop-blur-sm" onClick={() => setGenResult(null)}>
          <div className="bg-white rounded-2xl shadow-pop w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-ink-900">{genResult.created_count} brouillon(s) créé(s)</h3>
            <p className="text-sm text-ink-500 mt-1">{genResult.note}</p>
            <div className="mt-4 space-y-2">
              {genResult.results.map((r: any, i: number) => (
                <div key={i} className="p-3 rounded-lg ring-1 ring-ink-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded ${r.status === 'created' ? 'bg-success-50 text-success-700' : 'bg-warn-50 text-warn-700'}`}>{r.status}</span>
                    <span className="text-xs text-ink-500">{r.label} · {r.date}</span>
                    {r.pilier && <span className="text-xs text-ink-500">· {r.pilier}</span>}
                  </div>
                  {r.title && <div className="mt-1 text-sm font-medium text-ink-900">{r.title}</div>}
                  {r.excerpt && <div className="mt-1 text-xs text-ink-500 line-clamp-2">{r.excerpt}</div>}
                  {r.error && <div className="mt-1 text-xs text-danger-700">{r.error}</div>}
                  {r.status === 'created' && (
                    <div className="mt-2 flex gap-2">
                      {r.notion_url && <a href={r.notion_url} target="_blank" rel="noopener" className="text-xs px-2 py-1 rounded ring-1 ring-ink-300 hover:bg-ink-50">↗ Notion</a>}
                      <a href={r.edit_url} className="text-xs px-2 py-1 rounded bg-brand-500 text-white hover:bg-brand-600">Éditer dans Cadence</a>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-5 flex gap-2 justify-end">
              <a href="/calendar" className="px-4 py-2 rounded-lg ring-1 ring-ink-300 text-sm hover:bg-ink-50">Voir dans le calendrier</a>
              <button onClick={() => setGenResult(null)} className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {KINDS.map(kind => {
        const list = items.filter(i => i.kind === kind);
        const meta = KIND_LABEL[kind];
        return (
          <section key={kind} className="bg-white rounded-2xl p-6 shadow-card ring-1 ring-inset ring-ink-300/20">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-ink-900">{meta.label}</h2>
                <p className="text-xs text-ink-500 mt-0.5">{meta.hint}</p>
              </div>
              <button onClick={() => setAdding(adding === kind ? null : kind)} className="text-xs px-3 py-1.5 rounded-lg ring-1 ring-ink-300 hover:bg-ink-50">
                {adding === kind ? '× Annuler' : '+ Ajouter'}
              </button>
            </div>
            {adding === kind && (
              <div className="mt-3 flex gap-2">
                <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder={`Nouveau ${meta.label.toLowerCase()}…`} className="flex-1 px-3 py-2 rounded-lg ring-1 ring-ink-300 text-sm" autoFocus onKeyDown={e => e.key === 'Enter' && add(kind)} />
                <button onClick={() => add(kind)} className="px-3 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600">Ajouter</button>
              </div>
            )}
            <ul className="mt-4 space-y-2">
              {list.length === 0 && <li className="text-sm text-ink-500 italic">Aucun élément.</li>}
              {list.map(i => (
                <li key={i.id} className="flex items-center gap-2 p-2 rounded-lg ring-1 ring-ink-100">
                  <span className="text-sm text-ink-700 flex-1">{i.label}</span>
                  <button onClick={() => remove(i.id)} className="text-xs text-danger-700 hover:text-danger-700 px-2 py-1 rounded hover:bg-danger-50">Supprimer</button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
