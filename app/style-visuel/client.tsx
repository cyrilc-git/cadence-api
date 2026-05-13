'use client';

import { useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';

const CATEGORY_LABELS: Record<string, string> = {
  brand: 'Logo & branding',
  color: 'Couleurs',
  typography: 'Typographies',
  layout: 'Cards & boutons',
  format: 'Formats visuels',
  style: 'Styles d\'illustration',
  prompt: 'Prompts visuels réutilisables',
  misc: 'Autres'
};

export default function StyleVisuelClient({ initial }: { initial: any[] }) {
  const [tokens, setTokens] = useState(initial);
  const [editing, setEditing] = useState<any | null>(null);
  const [figmaUrl, setFigmaUrl] = useState('');

  async function save() {
    if (!editing.key || !editing.value) return;
    const r = await fetch('/api/design-system', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
    const d = await r.json();
    if (!r.ok) { alert(d.error); return; }
    const existing = tokens.find(t => t.key === editing.key);
    if (existing) setTokens(tokens.map(t => t.key === editing.key ? d.item : t));
    else setTokens([...tokens, d.item]);
    setEditing(null);
  }
  async function remove(id: string) {
    if (!confirm('Supprimer ce token ?')) return;
    const r = await fetch(`/api/design-system/${id}`, { method: 'DELETE' });
    if (r.ok) setTokens(tokens.filter(t => t.id !== id));
  }
  async function saveFigma() {
    if (!figmaUrl) return;
    const r = await fetch('/api/design-system', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'figma.url', value: figmaUrl, category: 'brand' }) });
    const d = await r.json();
    if (r.ok) {
      const existing = tokens.find(t => t.key === 'figma.url');
      if (existing) setTokens(tokens.map(t => t.key === 'figma.url' ? d.item : t));
      else setTokens([...tokens, d.item]);
      setFigmaUrl('');
    }
  }

  const byCat: Record<string, any[]> = {};
  for (const t of tokens) {
    const c = t.category || 'misc';
    if (!byCat[c]) byCat[c] = [];
    byCat[c].push(t);
  }

  const currentFigma = tokens.find(t => t.key === 'figma.url');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-ink-900">Style visuel de la marque</h1>
        <p className="mt-1 text-ink-500">Cadence utilise ce style pour générer vos illustrations et schémas. Modifiez ici pour changer le rendu de tous vos visuels.</p>
      </header>

      {/* Mode banner */}
      <div className="bg-brand-50 ring-1 ring-inset ring-brand-500/20 rounded-2xl p-4 text-sm text-ink-700 flex items-start gap-3">
        <StatusBadge variant="brand">Mode actif</StatusBadge>
        <div>
          <strong className="block text-ink-900">Claude Sonnet 4.6 — génération SVG interne</strong>
          <span className="text-xs text-ink-500">L'API Claude Design externe n'est pas accessible publiquement. Cadence simule le rendu via le prompt système et vos tokens ci-dessous.</span>
        </div>
      </div>

      {/* Figma import (placeholder) */}
      <section className="bg-white rounded-2xl p-6 shadow-card ring-1 ring-inset ring-ink-300/20">
        <h2 className="font-semibold text-ink-900">Importer depuis Figma</h2>
        <p className="mt-1 text-xs text-ink-500">Collez le lien de votre fichier Figma. L'extraction automatique des tokens arrivera en V7.8. Pour l'instant Cadence garde le lien et son contexte pour le donner à Claude.</p>
        <div className="mt-3 flex gap-2">
          <input value={figmaUrl} onChange={e => setFigmaUrl(e.target.value)} placeholder="https://www.figma.com/file/…" className="flex-1 px-3 py-2 rounded-lg ring-1 ring-ink-300 text-sm" />
          <button onClick={saveFigma} disabled={!figmaUrl} className="px-3 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50">Enregistrer</button>
        </div>
        {currentFigma && <p className="mt-2 text-xs text-success-700">Lien actuel : <a href={currentFigma.value} target="_blank" rel="noopener" className="underline">{currentFigma.value}</a></p>}
      </section>

      {/* Tokens by category */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-500">Tous les paramètres ci-dessous sont injectés dans le prompt de Claude lors de la génération.</p>
        <button onClick={() => setEditing({ key: '', value: '', category: 'color' })} className="px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-medium hover:bg-brand-600">+ Ajouter un paramètre</button>
      </div>

      {Object.entries(byCat).map(([cat, list]) => (
        <section key={cat} className="bg-white rounded-2xl p-6 shadow-card ring-1 ring-inset ring-ink-300/20">
          <h2 className="font-semibold text-ink-900">{CATEGORY_LABELS[cat] || cat}</h2>
          <ul className="mt-3 space-y-2">
            {list.map(t => (
              <li key={t.id} className="flex items-start gap-3 p-2 rounded-lg ring-1 ring-ink-100">
                <div className="w-32 shrink-0">
                  <div className="text-xs font-medium text-ink-700">{t.key.split('.')[1] || t.key}</div>
                  <div className="text-[10px] text-ink-400 font-mono">{t.key}</div>
                </div>
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
            <h3 className="text-lg font-semibold text-ink-900">{editing.id ? 'Modifier' : 'Nouveau paramètre'}</h3>
            <div><label className="block text-xs font-medium text-ink-700 mb-1">Clé (ex : color.primary)</label><input value={editing.key} onChange={e => setEditing({ ...editing, key: e.target.value })} placeholder="color.primary" className="w-full px-3 py-2 rounded-lg ring-1 ring-ink-300 text-sm font-mono" /></div>
            <div><label className="block text-xs font-medium text-ink-700 mb-1">Catégorie</label><select value={editing.category || 'misc'} onChange={e => setEditing({ ...editing, category: e.target.value })} className="w-full px-3 py-2 rounded-lg ring-1 ring-ink-300 text-sm">{Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label className="block text-xs font-medium text-ink-700 mb-1">Valeur</label><textarea value={editing.value} onChange={e => setEditing({ ...editing, value: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg ring-1 ring-ink-300 text-sm font-mono" placeholder="#2563EB ou texte libre" /></div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg ring-1 ring-ink-300 text-sm">Annuler</button>
              <button onClick={save} className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600">Sauvegarder</button>
            </div>
          </div>
        </div>
      )}

      <div className="text-xs text-ink-500"><Link href="/settings" className="text-brand-700 hover:text-brand-600">← Retour aux paramètres</Link></div>
    </div>
  );
}
