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
import { confirmDialog, toast } from '@/components/Dialog';

// V56 — Dimensions selectionnables par profil : ce que Cadence tire de CE profil.
const DIMS: { key: string; label: string; hint: string }[] = [
  { key: 'tone',      label: 'Ton & voix',        hint: 'registre, proximité, humour' },
  { key: 'structure', label: 'Structure & format', hint: 'hook, rythme, longueur' },
  { key: 'topics',    label: 'Sujets & angles',    hint: 'thèmes abordés' },
  { key: 'visual',    label: 'Style visuel',       hint: 'direction des illustrations' },
];
const DIM_LABEL: Record<string, string> = { tone: 'Ton', structure: 'Structure', topics: 'Sujets', visual: 'Visuel' };

export default function InspirationsClient({ initial, embedded = false }: { initial: any[]; embedded?: boolean }) {
  const [items, setItems] = useState(initial);
  const [restoring, setRestoring] = useState(false);

  async function restoreDefaults() {
    const ok = await confirmDialog({
      title: 'Restaurer les références Cadence ?',
      body: 'Cadence ajoutera uniquement les profils manquants. Vos inspirations actuelles ne seront pas modifiées.',
      confirmLabel: 'Restaurer',
    });
    if (!ok) return;
    setRestoring(true);
    try {
      const r = await fetch('/api/seed', { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const list = await fetch('/api/inspirations').then(x => x.json());
      setItems(list.items || []);
      toast.success('Inspirations restaurées');
    } catch (e: any) {
      toast.error('Restauration impossible : ' + e.message);
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
    if (!r.ok) { toast.error(d.error || 'Enregistrement impossible'); return; }
    setItems(isNew ? [...items, d.item] : items.map(i => i.id === d.item.id ? d.item : i));
    setEditing(null);
    toast.success(isNew ? 'Inspiration ajoutée' : 'Inspiration mise à jour');
  }

  async function remove(id: string) {
    const target = items.find(i => i.id === id);
    const ok = await confirmDialog({
      title: 'Supprimer cette inspiration ?',
      body: target?.name ? `« ${target.name} » sera retirée de votre liste.` : undefined,
      confirmLabel: 'Supprimer',
      destructive: true,
    });
    if (!ok) return;
    const r = await fetch(`/api/inspirations/${id}`, { method: 'DELETE' });
    if (r.ok) {
      setItems(items.filter(i => i.id !== id));
      toast.success('Inspiration supprimée');
    } else {
      toast.error('Suppression impossible');
    }
  }

  // V44 — Toggle actif/inactif : c'est CE qui décide si l'inspiration
  // nourrit la prochaine génération (cf. /posts/new V42). Optimistic.
  const [busyId, setBusyId] = useState<string | null>(null);
  async function toggleActive(item: any) {
    const next = !item.active;
    setBusyId(item.id);
    setItems(items.map(i => i.id === item.id ? { ...i, active: next } : i));
    try {
      const r = await fetch(`/api/inspirations/${item.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item, active: next }),
      });
      if (!r.ok) throw new Error();
      toast.success(next ? 'Activée pour la prochaine génération' : 'Désactivée');
    } catch {
      setItems(items.map(i => i.id === item.id ? { ...i, active: item.active } : i));
      toast.error('Action impossible');
    } finally { setBusyId(null); }
  }
  // V44 — Menu d'actions secondaires (modifier / supprimer), discret.
  const [menuId, setMenuId] = useState<string | null>(null);
  const activeCount = items.filter(i => i.active && i.style_notes).length;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          {embedded
            ? <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500">Profils qui vous inspirent</h2>
            : <h1 className="text-2xl font-semibold text-ink-900 tracking-tight">Inspirations</h1>}
          <p className={`${embedded ? 'mt-2' : 'mt-1'} text-sm text-ink-500 leading-relaxed`}>
            {activeCount > 0
              ? <>{activeCount} inspiration{activeCount > 1 ? 's' : ''} active{activeCount > 1 ? 's' : ''} nourri{activeCount > 1 ? 'ssent' : 't'} vos générations. <a href="/posts/new" className="text-brand-700 hover:text-brand-900">Écrire un post →</a></>
              : 'Activez une inspiration pour influencer le style de vos prochains posts.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing({ name: '', score: 3, category: '', active: true, dimensions: ['tone', 'structure'] })} className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600">+ Ajouter</button>
        </div>
      </header>

      {/* V44 — Comment ça marche, en clair. */}
      <div className="border-l-2 border-brand-300 pl-4 py-1 space-y-2">
        <p className="text-sm text-ink-800 leading-relaxed">
          Une inspiration <strong>active</strong> transmet ses <em>notes de style</em> à Cadence quand vous générez un post. Elle influence le <strong>rythme</strong>, le type de <strong>hook</strong>, le niveau de <strong>pédagogie</strong> et la <strong>narration</strong> — jamais le contenu.
        </p>
        <p className="text-xs text-ink-500 leading-relaxed">
          <strong className="text-ink-700">Inspiration ≠ copie.</strong> Cadence n&apos;envoie jamais le nom ni le texte d&apos;une inspiration à l&apos;IA, seulement vos notes de style. Aucun post généré ne doit permettre de deviner la source.
        </p>
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
        {items.map(i => {
          const usable = !!i.style_notes;
          const isActive = !!i.active && usable;
          return (
          <div key={i.id} className={`bg-white rounded-2xl p-5 ring-1 ring-inset transition ${isActive ? 'ring-brand-300 shadow-card' : 'ring-ink-300/20'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-brand-500' : 'bg-ink-300'}`} aria-hidden />
                  <span className="font-semibold text-ink-900 truncate">{i.name}</span>
                </div>
                {i.url && <a href={i.url} target="_blank" rel="noopener" className="text-xs text-brand-700 hover:text-brand-600 ml-3.5">Profil LinkedIn ↗</a>}
              </div>
              {/* V44 — Menu discret (modifier / supprimer), pas toujours visible */}
              <div className="relative shrink-0">
                <button onClick={() => setMenuId(menuId === i.id ? null : i.id)} className="w-8 h-8 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-50 transition" aria-label="Actions">⋯</button>
                {menuId === i.id && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setMenuId(null)} />
                    <div className="absolute right-0 top-full mt-1 z-40 bg-white rounded-lg shadow-pop ring-1 ring-ink-200 p-1 min-w-[150px]">
                      <button onClick={() => { setMenuId(null); setEditing(i); }} className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-ink-50">Modifier</button>
                      <button onClick={() => { setMenuId(null); remove(i.id); }} className="w-full text-left text-sm px-3 py-2 rounded-md text-danger-700 hover:bg-danger-50">Supprimer</button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* V44 — Impact concret : ce que cette inspiration pousse Cadence à faire */}
            {i.style_notes ? (
              <p className="mt-3 text-sm text-ink-700 leading-relaxed">
                <span className="text-2xs uppercase tracking-wider font-semibold text-ink-400">Influence</span><br />
                {i.style_notes}
              </p>
            ) : (
              <p className="mt-3 text-sm text-ink-400 italic leading-relaxed">
                Pas encore de notes de style. <button onClick={() => setEditing(i)} className="text-brand-700 hover:text-brand-900 not-italic underline decoration-dotted underline-offset-2">En ajouter</button> pour qu&apos;elle puisse influencer vos posts.
              </p>
            )}
            {i.do_not_copy && <p className="mt-2 text-xs text-danger-700"><span className="text-danger-700/70">Interdit à la copie : </span>{i.do_not_copy}</p>}

            {/* V56 — Ce que CE profil transmet (dimensions choisies) */}
            {i.dimensions && i.dimensions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {i.dimensions.map((d: string) => (
                  <span key={d} className="text-2xs px-1.5 py-0.5 rounded bg-ink-50 text-ink-600 ring-1 ring-inset ring-ink-200">{DIM_LABEL[d] || d}</span>
                ))}
              </div>
            )}

            {/* V44 — Action principale : activer / désactiver */}
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => toggleActive(i)}
                disabled={busyId === i.id || !usable}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-50 ${isActive ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-300' : 'bg-brand-500 text-white hover:bg-brand-600'}`}
                title={usable ? '' : 'Ajoutez des notes de style pour pouvoir activer'}
              >
                {busyId === i.id ? '…' : isActive ? 'Active · désactiver' : 'Utiliser dans la prochaine génération'}
              </button>
              {i.category && <span className="text-2xs text-ink-400">{i.category}</span>}
            </div>
          </div>
          );
        })}
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

            {/* V56 — Ce que Cadence tire de CE profil. Coché par profil. */}
            <Field label="Ce que Cadence tire de ce profil">
              <div className="space-y-1.5 rounded-lg ring-1 ring-ink-200 p-3">
                {DIMS.map(d => {
                  const dims: string[] = editing.dimensions || ['tone', 'structure'];
                  const checked = dims.includes(d.key);
                  return (
                    <label key={d.key} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => {
                          const cur = new Set<string>(editing.dimensions || ['tone', 'structure']);
                          if (e.target.checked) cur.add(d.key); else cur.delete(d.key);
                          setEditing({ ...editing, dimensions: Array.from(cur) });
                        }}
                        className="mt-0.5 w-3.5 h-3.5 rounded border-ink-300 text-brand-500 shrink-0"
                      />
                      <span className="text-sm text-ink-800 leading-snug">
                        {d.label}<span className="text-ink-400"> — {d.hint}</span>
                        {d.key === 'topics' && checked && (
                          <span className="block text-2xs text-amber-700 mt-0.5">⚠ T&apos;inspirer de leurs thèmes, jamais de leurs formulations. S&apos;écarte du « style seul ».</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </Field>
            {(editing.dimensions || []).includes('visual') && (
              <Field label="Style visuel à retenir">
                <textarea value={editing.visual_notes || ''} onChange={e => setEditing({ ...editing, visual_notes: e.target.value })} rows={2} placeholder="Sobre, fond clair, une couleur d'accent, schémas épurés, beaucoup d'air…" className="w-full px-3 py-2 rounded-lg ring-1 ring-ink-300 text-sm" />
              </Field>
            )}

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
