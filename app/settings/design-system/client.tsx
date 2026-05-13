'use client';

import { useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';

const CATEGORY_LABELS: Record<string, string> = {
  color: 'Couleurs',
  typography: 'Typographies',
  layout: 'Cards & layout',
  brand: 'Logos & branding',
  format: 'Formats LinkedIn',
  style: 'Styles visuels',
  prompt: 'Prompts visuels réutilisables',
  misc: 'Autres'
};

export default function DesignSystemClient({ initial }: { initial: any[] }) {
  const [tokens, setTokens] = useState(initial);
  const [editing, setEditing] = useState<any | null>(null);

  async function save() {
    if (!editing.key || !editing.value) return;
    const r = await fetch('/api/design-system', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
    const d = await r.json();
    if (!r.ok) { alert(d.error); return; }
    const updated = tokens.find(t => t.key === editing.key);
    if (updated) setTokens(tokens.map(t => t.key === editing.key ? d.item : t));
    else setTokens([...tokens, d.item]);
    setEditing(null);
  }
  async function remove(id: string) {
    if (!confirm('Supprimer ce token ?')) return;
    const r = await fetch(`/api/design-system/${id}`, { method: 'DELETE' });
    if (r.ok) setTokens(tokens.filter(t => t.id !== id));
  }

  const byCat: Record<string, any[]> = {};
  for (const t of tokens) {
    const c = t.category || 'misc';
    if (!byCat[c]) byCat[c] = [];
    byCat[c].push(t);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-ink-900">Design system visuel</h1>
          <p className="mt-1 text-ink-500">Couleurs, polices, prompts. Utilisé par Claude lors de la génération de visuels SVG.</p>
        </div>
        <button onClick={() => setEditing({ key: '', value: '', category: 'color' })} className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600">+ Ajouter un token</button>
      </header>

      <div className="bg-brand-50/50 ring-1 ring-inset ring-brand-500/20 rounded-2xl p-4 text-sm text-ink-700 flex items-start gap-3">
        <StatusBadge variant="brand">Mode actif</StatusBadge>
        <div>
          <strong className="block">Claude SVG interne</strong>
          <span className="text-xs text-ink-500">Cadence utilise Claude Sonnet 4.6 pour générer des SVG à partir des tokens ci-dessous. L'API Claude Design externe n'est pas disponible publiquement aujourd'hui ; on simule via le system prompt ce qui en serait le rendu.</span>
        </div>
      </div>

      {Object.entries(byCat).map(([cat, list]) => (
        <section key={cat} className="bg-white rounded-2xl p-6 shadow-card ring-1 ring-inset ring-ink-300/20">
          <h2 className="font-semibold text-ink-900">{CATEGORY_LABELS[cat] || cat}</h2>
          <ul className="mt-3 space-y-2">
            {list.map(t => (
              <li key={t.id} className="flex items-start gap-3 p-2 rounded-lg ring-1 ring-ink-100">
                <code className="text-xs font-mono text-ink-700 w-48 shrink-0 break-all">{t.key}</code>
                <span className="flex-1 text-sm text-ink-700 break-words">
                  {cat === 'color' && /^#[0-9A-Fa-f]{6}$/.test(t.value) && <span className="inline-block w-4 h-4 rounded mr-2 align-middle" style={{ background: t.value }} />}
                  {t.value}
                </span>
                <button onClick={() => setEditing(t)} className="text-xs px-2 py-1 rounded ring-1 ring-ink-300 hover:bg-ink-50">Modifier</button>
                <button onClick={() => remove(t.id)} className="text-xs px-2 py-1 rounded text-danger-700 hover:bg-danger-50">Supprimer</button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-ink-900/40 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-pop w-full max-w-md p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-ink-900">{editing.id ? 'Modifier token' : 'Nouveau token'}</h3>
            <div><label className="block text-xs font-medium text-ink-700 mb-1">Clé</label><input value={editing.key} onChange={e => setEditing({ ...editing, key: e.target.value })} placeholder="color.primary" className="w-full px-3 py-2 rounded-lg ring-1 ring-ink-300 text-sm font-mono" /></div>
            <div><label className="block text-xs font-medium text-ink-700 mb-1">Catégorie</label><select value={editing.category || 'misc'} onChange={e => setEditing({ ...editing, category: e.target.value })} className="w-full px-3 py-2 rounded-lg ring-1 ring-ink-300 text-sm">{Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label className="block text-xs font-medium text-ink-700 mb-1">Valeur</label><textarea value={editing.value} onChange={e => setEditing({ ...editing, value: e.target.value })} rows={4} className="w-full px-3 py-2 rounded-lg ring-1 ring-ink-300 text-sm font-mono" placeholder="#6366F1 ou texte libre" /></div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg ring-1 ring-ink-300 text-sm">Annuler</button>
              <button onClick={save} className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600">Sauvegarder</button>
            </div>
          </div>
        </div>
      )}

      <div className="text-xs text-ink-500"><Link href="/settings" className="text-brand-700 hover:text-brand-600">← Retour aux connecteurs</Link></div>
    </div>
  );
}
