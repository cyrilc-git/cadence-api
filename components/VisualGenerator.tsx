'use client';

import { useState } from 'react';
import StatusBadge from './StatusBadge';

type Mode = 'claude-design' | 'openai';

const TEMPLATES: Record<string, { label: string; mode: Mode; example: string }> = {
  feature:      { label: 'Nouveauté produit (Heelio)',   mode: 'claude-design', example: 'Mockup d\'une carte KPI "DSO" Heelio avec valeur 32 jours, barre de progression, libellé "vs objectif 30 jours", style design system Heelio.' },
  schema:       { label: 'Schéma pédagogique',           mode: 'claude-design', example: 'Schéma : 3 étapes du closing mensuel (Réconciliation → Provisions → Reporting). Flèches entre les blocs, durées indicatives.' },
  capture:      { label: 'Capture annotée',              mode: 'claude-design', example: 'Capture stylisée du dashboard Heelio avec 3 annotations numérotées : 1) KPI cash, 2) Prévision, 3) Alertes.' },
  illustration: { label: 'Illustration éditoriale (ads)', mode: 'openai',        example: 'Illustration plate, ton sobre, fond clair : un dirigeant de PME devant un tableau de bord financier, style éditorial corporate moderne.' }
};

export default function VisualGenerator({ defaultPrompt = '', notionPageId }: { defaultPrompt?: string; notionPageId?: string }) {
  const [template, setTemplate] = useState<keyof typeof TEMPLATES>('feature');
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ svg?: string; url?: string; format: string; model?: string; mode: Mode } | null>(null);

  const mode = TEMPLATES[template].mode;

  async function handleGenerate() {
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await fetch('/api/generate-visual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode, notion_page_id: notionPageId })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `Erreur ${r.status}`);
      setResult({ svg: data.svg, url: data.url, format: data.format, model: data.model, mode });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function useTemplate(key: keyof typeof TEMPLATES) {
    setTemplate(key);
    if (!prompt || prompt === TEMPLATES[template].example) setPrompt(TEMPLATES[key].example);
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink-900 text-sm">Générer un visuel</h3>
        <StatusBadge variant={mode === 'claude-design' ? 'brand' : 'neutral'}>
          {mode === 'claude-design' ? 'Claude Design (SVG)' : 'OpenAI DALL-E 3 (PNG)'}
        </StatusBadge>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {Object.entries(TEMPLATES).map(([k, v]) => (
          <button key={k} onClick={() => useTemplate(k as any)}
            className={`text-left text-xs px-3 py-2 rounded-lg ring-1 ring-inset transition ${template === k ? 'ring-brand-500 bg-brand-50 text-brand-700' : 'ring-ink-300 hover:bg-ink-50 text-ink-700'}`}>
            {v.label}
          </button>
        ))}
      </div>

      <label className="block text-xs font-medium text-ink-700 mt-4">Prompt</label>
      <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} placeholder={TEMPLATES[template].example}
        className="mt-1 w-full rounded-lg border-ink-300 px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
      <p className="mt-1 text-xs text-ink-500">
        {mode === 'claude-design'
          ? 'SVG inline, respecte le design system Heelio. Idéal pour démos produit, schémas, captures annotées.'
          : 'PNG photoréaliste / illustration. Idéal pour ads, métaphores visuelles, ambiance éditoriale.'}
      </p>

      <button onClick={handleGenerate} disabled={loading || !prompt.trim()}
        className="mt-3 w-full px-4 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50">
        {loading ? 'Génération en cours… (10-30 sec)' : '🎨 Générer le visuel'}
      </button>

      {error && (
        <div className="mt-3 p-3 rounded-lg bg-danger-50 ring-1 ring-inset ring-danger-500/20 text-sm text-danger-700">
          <strong className="font-semibold">Erreur :</strong> {error}
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <StatusBadge variant="success">Généré</StatusBadge>
            {result.model && <span className="text-xs text-ink-500">{result.model}</span>}
            {result.mode === 'claude-design' && <span className="text-xs text-ink-500">· SVG · {result.svg?.length || 0} chars</span>}
          </div>
          <div className="rounded-xl overflow-hidden ring-1 ring-ink-300/30 bg-ink-50">
            {result.mode === 'claude-design' && result.svg
              ? <div className="w-full" dangerouslySetInnerHTML={{ __html: result.svg }} />
              : result.url
                ? <img src={result.url} alt="" className="w-full h-auto" />
                : null}
          </div>
          <div className="flex gap-2">
            {result.url && <a href={result.url} target="_blank" rel="noopener" className="text-xs px-3 py-1.5 rounded-lg ring-1 ring-ink-300 hover:bg-ink-50">Ouvrir l'URL</a>}
            {result.svg && (
              <button onClick={() => navigator.clipboard?.writeText(result.svg!)} className="text-xs px-3 py-1.5 rounded-lg ring-1 ring-ink-300 hover:bg-ink-50">
                Copier le SVG
              </button>
            )}
            <button onClick={handleGenerate} disabled={loading} className="text-xs px-3 py-1.5 rounded-lg ring-1 ring-ink-300 hover:bg-ink-50">
              Régénérer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
