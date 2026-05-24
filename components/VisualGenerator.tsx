'use client';

import { useEffect, useState, useCallback } from 'react';
import StatusBadge from './StatusBadge';

type Mode = 'claude-design' | 'openai';

// V12.7 — Claude Design en mode principal. DALL-E reste utile pour les
// illustrations métaphoriques mais ne doit plus être le réflexe.
// Heelio direction artistique : fond clair, bleu Cadence, hiérarchie nette,
// peu de texte, 1 idée centrale, grandes zones respirantes, style premium
// SaaS/fintech, formats LinkedIn carrés ou 1200x630.
const TEMPLATES: Record<string, { label: string; mode: Mode; example: string }> = {
  feature:      { label: 'Carte KPI',                    mode: 'claude-design', example: 'Carte KPI "DSO" : valeur 32 jours en grand (typo Inter 56px, bleu #2563EB), libellé "vs objectif 30 jours" en sous-texte ink-500, fond #FAFAF9, 1200x630, beaucoup d\'air autour du chiffre, pas de gradient.' },
  schema:       { label: 'Schéma pédagogique',           mode: 'claude-design', example: 'Schéma 3 étapes du closing mensuel (Réconciliation > Provisions > Reporting). 3 cartes alignées horizontalement, fond clair #FAFAF9, accents bleu #2563EB sur les numéros, flèches fines ink-400, espace généreux. Style éditorial premium.' },
  capture:      { label: 'Capture annotée',              mode: 'claude-design', example: 'Capture stylisée du dashboard Heelio avec 3 annotations numérotées (1, 2, 3) en cercles bleus #2563EB. Fond #FAFAF9, ombre subtile sous la capture, libellés courts en Inter 12px ink-700.' },
  opinion:      { label: 'Visuel opinion minimal',       mode: 'claude-design', example: 'Visuel opinion : une seule phrase forte centrée en typo serif (Georgia 36px) sur fond clair #FAFAF9. Aucun ornement. Filet bleu #2563EB de 2px sous la phrase. Format carré 1080x1080.' },
  illustration: { label: 'Illustration métaphorique',    mode: 'openai',        example: 'Illustration plate, ton sobre, fond clair : un dirigeant de PME devant un tableau de bord financier, style éditorial corporate moderne. Réservée aux métaphores : préférez Claude Design pour les visuels produit ou pédagogiques.' }
};

type Variant = {
  id: string;
  format: 'svg' | 'png';
  svg?: string;
  url?: string;
  model?: string;
  template: keyof typeof TEMPLATES;
  prompt: string;
  createdAt: number;
};

export default function VisualGenerator({
  defaultPrompt = '',
  notionPageId,
  onPick,
  pilier: pilierProp,
}: {
  defaultPrompt?: string;
  notionPageId?: string;
  onPick?: (urlOrSvg: string | null) => void;
  pilier?: string;
}) {
  const [template, setTemplate] = useState<keyof typeof TEMPLATES>('feature');
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [briefLoading, setBriefLoading] = useState(false);

  // V12.2 — Mémoire visuelle : Cadence lit son historique au mount et affiche
  // discrètement ce qui a marché. Aucun cliquable, juste une présence.
  const [memorySnippet, setMemorySnippet] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/visual-memory?limit=1')
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        const meaningful = (d?.patterns || []).filter((p: any) => p.kind !== 'low_data');
        if (meaningful.length > 0) setMemorySnippet(meaningful[0].message);
      })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, []);

  const mode = TEMPLATES[template].mode;
  const selected = variants.find(v => v.id === selectedId) || null;

  // When selection changes, propagate to parent
  useEffect(() => {
    if (!onPick) return;
    if (!selected) { onPick(null); return; }
    onPick(selected.svg || selected.url || null);
  }, [selected, onPick]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true); setError(null);
    try {
      // V12.2 — Transmet template + pilier pour tracing dans visual_items
      const r = await fetch('/api/generate-visual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode, notion_page_id: notionPageId, template, pilier: pilierProp || null })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `Erreur ${r.status}`);
      const v: Variant = {
        id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        format: data.format,
        svg: data.svg,
        url: data.url,
        model: data.model,
        template,
        prompt,
        createdAt: Date.now()
      };
      setVariants(list => [v, ...list].slice(0, 8)); // keep last 8
      setSelectedId(v.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [prompt, mode, notionPageId, template]);

  async function suggestBrief() {
    if (briefLoading) return;
    setBriefLoading(true);
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notion_page_id: notionPageId || 'visual-brief',
          draft: prompt || '(brief vide)',
          instruction: 'Propose un brief visuel concis pour ce post (3-4 lignes max). Format de réponse : un paragraphe descriptif. Style sobre, design system Heelio bleu #2563EB, fond #F8FAFC. Pas d\'emoji.'
        })
      });
      const d = await r.json();
      if (r.ok && d.rewrite) setPrompt(d.rewrite);
    } catch {/* silent */}
    finally { setBriefLoading(false); }
  }

  function useTemplate(key: keyof typeof TEMPLATES) {
    setTemplate(key);
    if (!prompt || prompt === TEMPLATES[template].example) setPrompt(TEMPLATES[key].example);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const v: Variant = {
        id: `up_${Date.now()}`,
        format: 'png',
        url: dataUrl,
        template,
        prompt: '(upload manuel)',
        createdAt: Date.now()
      };
      setVariants(list => [v, ...list].slice(0, 8));
      setSelectedId(v.id);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-ink-900 text-sm">Visuel</h3>
        <StatusBadge variant={mode === 'claude-design' ? 'brand' : 'neutral'}>
          {mode === 'claude-design' ? 'Claude Design' : 'DALL-E (métaphore)'}
        </StatusBadge>
      </div>

      {/* V12.2 — Cadence se rappelle de ce qui a marché */}
      {memorySnippet && (
        <p className="text-2xs text-ink-500 italic leading-relaxed mb-3" aria-live="polite">
          {memorySnippet}
        </p>
      )}

      {/* V12.7 — Claude Design en premier (4 templates), DALL-E métaphore séparé */}
      <div className="grid grid-cols-2 gap-1.5 mb-2">
        {(Object.entries(TEMPLATES) as Array<[keyof typeof TEMPLATES, typeof TEMPLATES[keyof typeof TEMPLATES]]>)
          .filter(([, v]) => v.mode === 'claude-design')
          .map(([k, v]) => (
            <button
              key={k}
              onClick={() => useTemplate(k)}
              className={`text-left text-xs px-3 py-2 rounded-lg border transition ${template === k ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-ink-200 hover:bg-ink-50 text-ink-700'}`}
            >
              {v.label}
            </button>
          ))}
      </div>
      <div className="mb-3">
        {(Object.entries(TEMPLATES) as Array<[keyof typeof TEMPLATES, typeof TEMPLATES[keyof typeof TEMPLATES]]>)
          .filter(([, v]) => v.mode === 'openai')
          .map(([k, v]) => (
            <button
              key={k}
              onClick={() => useTemplate(k)}
              className={`text-left text-2xs px-3 py-1.5 rounded-md transition ${template === k ? 'bg-ink-100 text-ink-900 font-medium' : 'text-ink-500 hover:text-ink-900'}`}
              title="Pour les métaphores narratives uniquement. Préférez Claude Design pour les visuels produit et pédagogiques."
            >
              {v.label}
            </button>
          ))}
      </div>

      {/* Prompt + brief assist */}
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-ink-700">Brief visuel</label>
        <button onClick={suggestBrief} disabled={briefLoading} className="btn-ghost text-2xs">
          {briefLoading ? 'Réflexion…' : 'Suggérer un brief'}
        </button>
      </div>
      <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} placeholder={TEMPLATES[template].example} className="input text-sm" />

      {/* V12.7 — Bouton principal selon le moteur choisi */}
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <button onClick={handleGenerate} disabled={loading || !prompt.trim()} className="btn-primary">
          {loading
            ? 'Cadence dessine… (10-30 sec)'
            : mode === 'claude-design'
              ? 'Créer avec Claude Design'
              : 'Créer (DALL-E)'}
        </button>
        <label className="btn-secondary cursor-pointer" title="Upload manuel">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12"/></svg>
          <input type="file" accept="image/*" hidden onChange={e => {
            const f = e.target.files?.[0]; if (!f) return;
            const reader = new FileReader();
            reader.onload = ev => {
              const dataUrl = ev.target?.result as string;
              const v: Variant = { id: `up_${Date.now()}`, format: 'png', url: dataUrl, template, prompt: '(upload)', createdAt: Date.now() };
              setVariants(l => [v, ...l].slice(0, 8));
              setSelectedId(v.id);
            };
            reader.readAsDataURL(f);
          }} />
        </label>
      </div>

      {error && (
        <div className="mt-3 p-3 rounded-lg bg-danger-50 border border-danger-100 text-sm text-danger-700">
          <strong className="font-semibold">Erreur :</strong> {error}
        </div>
      )}

      {/* Drop zone (always visible when no variant yet) */}
      {variants.length === 0 && !loading && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`mt-3 rounded-xl border-2 border-dashed p-6 text-center transition ${dragOver ? 'border-brand-400 bg-brand-50' : 'border-ink-200 bg-ink-50/50'}`}
        >
          <svg className="w-8 h-8 mx-auto text-ink-400 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12"/></svg>
          <p className="text-sm text-ink-600">Glissez une image ici, ou cliquez sur Générer.</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="mt-4 rounded-xl border border-ink-200 overflow-hidden">
          <div className="skeleton aspect-[1200/630] w-full" />
          <div className="p-3 text-xs text-ink-500 animate-pulse-soft">Cadence dessine votre visuel…</div>
        </div>
      )}

      {/* Selected preview */}
      {selected && !loading && (
        <div className="mt-4">
          <div className="rounded-xl overflow-hidden border border-ink-200">
            {selected.format === 'svg' && selected.svg
              ? <div className="w-full bg-white" dangerouslySetInnerHTML={{ __html: selected.svg }} />
              : selected.url
                ? <img src={selected.url} alt="" className="w-full h-auto" />
                : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="chip chip-success"><span className="dot bg-success-500" /> Sélectionné</span>
            {selected.model && <span className="text-ink-500">{selected.model}</span>}
            <span className="ml-auto flex gap-1">
              {selected.url && <a href={selected.url} target="_blank" rel="noopener" className="btn-ghost text-2xs">Ouvrir ↗</a>}
              {selected.svg && <button onClick={() => navigator.clipboard?.writeText(selected.svg!)} className="btn-ghost text-2xs">Copier SVG</button>}
              <button onClick={handleGenerate} className="btn-ghost text-2xs">Régénérer</button>
              <button onClick={() => { setSelectedId(null); }} className="btn-ghost text-2xs text-danger-700">Retirer</button>
            </span>
          </div>
        </div>
      )}

      {/* Variants history */}
      {variants.length > 1 && (
        <div className="mt-5">
          <div className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-2">Historique ({variants.length})</div>
          <div className="grid grid-cols-4 gap-2">
            {variants.map(v => (
              <button
                key={v.id}
                onClick={() => setSelectedId(v.id)}
                className={`aspect-square rounded-lg overflow-hidden border-2 transition ${v.id === selectedId ? 'border-brand-500' : 'border-ink-200 hover:border-ink-300'}`}
                title={v.prompt.slice(0, 80)}
              >
                {v.format === 'svg' && v.svg
                  ? <div className="w-full h-full bg-white pointer-events-none" dangerouslySetInnerHTML={{ __html: v.svg.replace(/<svg/i, '<svg preserveAspectRatio="xMidYMid meet"') }} />
                  : v.url
                    ? <img src={v.url} alt="" className="w-full h-full object-cover" />
                    : null}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
