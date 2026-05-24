'use client';


function safeExternal(url: string | undefined | null): string | null {
  if (!url) return null;
  const t = String(url).trim();
  if (!t) return null;
  let normalized = t;
  if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized.replace(/^\/+/, '');
  try { const u = new URL(normalized); u.protocol = 'https:'; return u.toString(); } catch { return null; }
}

import { useState } from 'react';
import StatusBadge from '@/components/StatusBadge';

export default function InspirationsClient({ initial }: { initial: any[] }) {
  const [items, setItems] = useState(initial);
  const [restoring, setRestoring] = useState(false);

  async function restoreDefaults() {
    if (!confirm('Restaurer les inspirations par défaut Cadence ? Cela ajoute uniquement les profils manquants.')) return;
    setRestoring(true);
    try {
      const r = await fetch('/api/seed', { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const list = await fetch('/api/inspirations').then(x => x.json());
      setItems(list.items || []);
    } catch (e: any) {
      alert('Erreur restauration : ' + e.message);
    } finally {
      setRestoring(false);
    }
  }

  const [editing, setEditing] = useState<any | null>(null);

  async function save() {
    if (!editing.name) return;
    const isNew = !editing.id;
    const url = isNew ? '/api/inspirations' : `/api/inspirations/${editing.id}`;
    const r = await fetch(url, { method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
    const d = await r.json();
    if (!r.ok) { alert(d.error); return; }
    setItems(isNew ? [...items, d.item] : items.map(i => i.id === d.item.id ? d.item : i));
    setEditing(null);
  }

  async function remove(id: string) {
    if (!confirm('Supprimer cette inspiration ?')) return;
    const r = await fetch(`/api/inspirations/${id}`, { method: 'DELETE' });
    if (r.ok) setItems(items.filter(i => i.id !== id));
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900 tracking-tight">Inspirations</h1>
          <p className="mt-1 text-sm text-ink-500 leading-relaxed">Comptes LinkedIn qui inspirent. Jamais à copier.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={restoreDefaults} disabled={restoring} className="px-4 py-2 rounded-lg ring-1 ring-ink-300 text-sm font-medium hover:bg-ink-50 disabled:opacity-50">
            {restoring ? 'Restauration…' : '↺ Restaurer défauts Cadence'}
          </button>
          <button onClick={() => setEditing({ name: '', score: 3, category: '' })} className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600">+ Ajouter</button>
        </div>
      </header>

      <div className="bg-warn-50 ring-1 ring-inset ring-warn-500/20 rounded-2xl p-4 text-sm text-warn-700">
        <strong className="font-semibold">Règle anti-plagiat.</strong> Les inspirations servent à comprendre rythme, densité, structure, angle. Cadence n'enverra jamais le nom ou le contenu d'une inspiration à l'IA — seulement les "notes de style". Toute génération suspecte sera bloquée.
      </div>

      {items.length === 0 ? (
        <div className="border-l-2 border-ink-200 pl-4 py-2 max-w-xl">
          <p className="text-sm text-ink-700 leading-relaxed">
            Aucune inspiration suivie pour le moment.{' '}
            <button onClick={restoreDefaults} disabled={restoring} className="text-brand-700 hover:text-brand-900 transition disabled:opacity-50">
              {restoring ? 'Restauration…' : 'Restaurer les 5 références Cadence'}
            </button>
            {' '}ou ajoutez un compte LinkedIn qui vous inspire pour commencer.
          </p>
        </div>
      ) : (
      <div className="grid sm:grid-cols-2 gap-3">
        {items.map(i => (
          <div key={i.id} className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-ink-900 truncate">{i.name}</div>
                {i.url && <a href={i.url} target="_blank" rel="noopener" className="text-xs text-brand-700 hover:text-brand-600">Profil LinkedIn ↗</a>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge variant="neutral">{i.category || '—'}</StatusBadge>
                <span className="text-xs text-ink-500">★ {i.score}/5</span>
              </div>
            </div>
            {i.style_notes && <p className="mt-3 text-sm text-ink-700"><span className="text-ink-500 text-xs">À retenir : </span>{i.style_notes}</p>}
            {i.do_not_copy && <p className="mt-2 text-sm text-danger-700"><span className="text-xs text-danger-700/70">Ne pas copier : </span>{i.do_not_copy}</p>}
            <div className="mt-3 flex gap-2 justify-end">
              <button onClick={() => setEditing(i)} className="text-xs px-3 py-1 rounded-lg ring-1 ring-ink-300 hover:bg-ink-50">Modifier</button>
              <button onClick={() => remove(i.id)} className="text-xs px-3 py-1 rounded-lg text-danger-700 hover:bg-danger-50">Supprimer</button>
            </div>
          </div>
        ))}
      </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-ink-900/40 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-pop w-full max-w-lg p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-ink-900">{editing.id ? 'Modifier' : 'Nouvelle'} inspiration</h3>
            <Field label="Nom"><input value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} className="w-full px-3 py-2 rounded-lg ring-1 ring-ink-300 text-sm" autoFocus /></Field>
            <Field label="URL LinkedIn">
              <input value={editing.url || ''} onChange={e => setEditing({ ...editing, url: e.target.value })} placeholder="https://linkedin.com/in/…" className="w-full px-3 py-2 rounded-lg ring-1 ring-ink-300 text-sm" />
              {editing.url && safeExternal(editing.url) && <div className="mt-1 text-xs text-ink-500 break-all">{safeExternal(editing.url)}</div>}
              {editing.url && !safeExternal(editing.url) && <div className="mt-1 text-xs text-danger-700">URL invalide. Préfixez par https:// (ex: https://www.linkedin.com/in/votre-id/).</div>}
            </Field>
            <Field label="Catégorie"><input value={editing.category || ''} onChange={e => setEditing({ ...editing, category: e.target.value })} placeholder="Build in public, Opinion, Cas client…" className="w-full px-3 py-2 rounded-lg ring-1 ring-ink-300 text-sm" /></Field>
            <Field label={`Score (★ ${editing.score || 3} / 5)`}><input type="range" min={1} max={5} value={editing.score || 3} onChange={e => setEditing({ ...editing, score: +e.target.value })} className="w-full" /></Field>
            <Field label="Style à retenir"><textarea value={editing.style_notes || ''} onChange={e => setEditing({ ...editing, style_notes: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg ring-1 ring-ink-300 text-sm" /></Field>
            <Field label="Ne PAS copier"><textarea value={editing.do_not_copy || ''} onChange={e => setEditing({ ...editing, do_not_copy: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg ring-1 ring-ink-300 text-sm" placeholder="Anecdotes perso, signatures, formules récurrentes…" /></Field>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg ring-1 ring-ink-300 text-sm hover:bg-ink-50">Annuler</button>
              <button onClick={save} className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600">Sauvegarder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-ink-700 mb-1">{label}</label>{children}</div>;
}
