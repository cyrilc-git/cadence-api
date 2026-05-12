'use client';

import { useState } from 'react';
import StatusBadge from '@/components/StatusBadge';

const KIND_LABEL: Record<string, { label: string; hint: string }> = {
  pilier:       { label: 'Piliers éditoriaux', hint: 'Un pilier par jour de la semaine, ou par thème.' },
  rule:         { label: 'Règles de voix',     hint: 'Vouvoiement, founder voice, tonalité…' },
  anti_pattern: { label: 'Interdictions',      hint: 'Tiret long, mots creux, formules à bannir.' },
  hashtag:      { label: 'Hashtags favoris',   hint: 'Hashtags ciblés à privilégier.' },
  cta:          { label: 'CTAs favoris',       hint: 'Phrases d\'appel à action récurrentes.' },
  hook:         { label: 'Hooks favoris',      hint: 'Premières phrases qui marchent.' },
  audience:     { label: 'Audiences',          hint: 'DAF, fondateurs PME, etc.' },
  format:       { label: 'Formats',            hint: 'Cas client, pédagogie, opinion, build in public.' }
};

const KINDS = Object.keys(KIND_LABEL);

export default function BrandDnaClient({ initial }: { initial: any[] }) {
  const [items, setItems] = useState(initial);
  const [adding, setAdding] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');

  async function add(kind: string) {
    if (!newLabel.trim()) return;
    const r = await fetch('/api/brand-dna', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, label: newLabel.trim() }) });
    const d = await r.json();
    if (r.ok) {
      setItems([...items, d.item]);
      setNewLabel(''); setAdding(null);
    } else {
      alert(d.error);
    }
  }

  async function remove(id: string) {
    if (!confirm('Supprimer cet élément ?')) return;
    const r = await fetch(`/api/brand-dna/${id}`, { method: 'DELETE' });
    if (r.ok) setItems(items.filter(i => i.id !== id));
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-ink-900">Brand DNA</h1>
        <p className="mt-1 text-ink-500">Votre voix, vos règles, vos interdits. Modifiable, persistant.</p>
      </header>

      {items.length === 0 && (
        <div className="bg-warn-50 ring-1 ring-inset ring-warn-500/20 rounded-2xl p-4 text-sm text-warn-700">
          <strong className="font-semibold">Initialisation requise.</strong> Vous n'avez encore aucun élément Brand DNA en DB. Les garde-fous IA continueront à utiliser les défauts hardcodés tant que vous n'ajoutez rien ici. Ajoutez vos piliers, règles et interdictions ci-dessous.
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
              {list.length === 0 && <li className="text-sm text-ink-500 italic">Aucun élément. Cliquez "+ Ajouter".</li>}
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
