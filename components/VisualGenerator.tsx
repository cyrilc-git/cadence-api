'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { detectEditorialFormat, buildFormatBrief, type EditorialFormat } from '@/lib/format-intelligence';

type Mode = 'claude-design' | 'openai' | 'gemini' | 'replicate' | 'stability' | 'ideogram';

// V12.7 / V51 §2 — Claude Design = moteur principal. Le flow n'est plus
// « écrire un prompt technique » : Cadence dérive un brief intelligent à
// partir du post (format détecté -> structure -> DA Heelio) et lance la
// génération. Le moteur et le brief brut vivent dans « Avancé », repliés.
// On retire toute la pile de murmures passifs (mémoire visuelle, reco
// memory-check pendant la frappe, disclaimer Midjourney, signaux « trop
// Canva ») : un panneau qui agit, pas un panneau qui commente.
const TEMPLATES: Record<string, { label: string; mode: Mode; example: string }> = {
  feature:      { label: 'Carte KPI',                    mode: 'claude-design', example: 'Carte KPI "DSO" : valeur 32 jours en grand (typo Inter 56px, bleu #2563EB), libellé "vs objectif 30 jours" en sous-texte ink-500, fond #FAFAF9, 1200x630, beaucoup d\'air autour du chiffre, pas de gradient.' },
  schema:       { label: 'Schéma pédagogique',           mode: 'claude-design', example: 'Schéma 3 étapes du closing mensuel (Réconciliation > Provisions > Reporting). 3 cartes alignées horizontalement, fond clair #FAFAF9, accents bleu #2563EB sur les numéros, flèches fines ink-400, espace généreux. Style éditorial premium.' },
  capture:      { label: 'Capture annotée',              mode: 'claude-design', example: 'Capture stylisée du dashboard Heelio avec 3 annotations numérotées (1, 2, 3) en cercles bleus #2563EB. Fond #FAFAF9, ombre subtile sous la capture, libellés courts en Inter 12px ink-700.' },
  opinion:      { label: 'Visuel opinion minimal',       mode: 'claude-design', example: 'Visuel opinion : une seule phrase forte centrée en typo serif (Georgia 36px) sur fond clair #FAFAF9. Aucun ornement. Filet bleu #2563EB de 2px sous la phrase. Format carré 1080x1080.' },
  illustration: { label: 'Illustration métaphorique',    mode: 'openai',        example: 'Illustration plate, ton sobre, fond clair : un dirigeant de PME devant un tableau de bord financier, style éditorial corporate moderne. Réservée aux métaphores : préférez Claude Design pour les visuels produit ou pédagogiques.' }
};

type VisualSignal = { kind: string; message: string; severity?: 'note' | 'soft' | 'firm' };
type Variant = {
  id: string;
  format: 'svg' | 'png';
  svg?: string;
  url?: string;
  model?: string;
  template: keyof typeof TEMPLATES;
  prompt: string;
  createdAt: number;
  // V23.1 — Score premium calculé côté serveur sur le SVG (conservé pour le
  // tracing serveur ; on n'affiche plus les signaux anxiogènes côté UI).
  visualScore?: { score: number; signals: VisualSignal[] };
};

// V12.7 §3 — Mapping visualHint.format -> template VisualGenerator
const HINT_TO_TEMPLATE: Record<string, keyof typeof TEMPLATES> = {
  schema: 'schema',
  data: 'feature',          // "data" du visualHint = carte KPI Cadence
  carousel: 'capture',       // carousel = série de captures annotées
  illustration: 'opinion',   // hook court = visuel opinion minimal
};

export default function VisualGenerator({
  defaultPrompt = '',
  notionPageId,
  onPick,
  pilier: pilierProp,
  text: contextText,
  suggestedFormat,
  autoBrief,
  autoGenerateKey,
}: {
  defaultPrompt?: string;
  notionPageId?: string;
  onPick?: (urlOrSvg: string | null) => void;
  pilier?: string;
  text?: string;
  /** V12.8 §2 — Format pré-sélectionné quand le drawer s'ouvre depuis l'éditeur */
  suggestedFormat?: string | null;
  /** V50.2 — Brief format-aware injecté quand on ouvre depuis un format hint.
   * Pré-remplit le prompt ET lance la génération automatiquement. */
  autoBrief?: string | null;
  /** V50.2 — Clé qui change à chaque clic "générer immédiatement" depuis
   * l'éditeur. Déclenche une seule auto-génération par clic (pas en boucle). */
  autoGenerateKey?: number;
}) {
  const [template, setTemplate] = useState<keyof typeof TEMPLATES>('feature');

  // V12.8 §2 — Quand l'éditeur signale un format suggéré, on bascule le template.
  useEffect(() => {
    if (!suggestedFormat) return;
    const tpl = HINT_TO_TEMPLATE[suggestedFormat];
    if (tpl && tpl !== template) setTemplate(tpl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedFormat]);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [briefLoading, setBriefLoading] = useState(false);

  // V38.2 — Sélecteur de moteur IA (dans « Avancé »). Par défaut on suit le
  // template (Claude Design pour les visuels structurés, DALL-E pour les
  // métaphores), mais l'utilisateur peut forcer un moteur.
  const [engineOverride, setEngineOverride] = useState<Mode | null>(null);
  // V39.3 — Disponibilité des moteurs (clé présente ?) lue depuis /api/engines.
  const [engines, setEngines] = useState<Record<string, boolean> | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/engines')
      .then(r => r.json())
      .then(d => { if (!cancelled) setEngines(d.engines || null); })
      .catch(() => { if (!cancelled) setEngines(null); });
    return () => { cancelled = true; };
  }, []);
  const mode = (engineOverride || TEMPLATES[template].mode) as Mode;
  const selected = variants.find(v => v.id === selectedId) || null;

  // When selection changes, propagate to parent
  useEffect(() => {
    if (!onPick) return;
    if (!selected) { onPick(null); return; }
    onPick(selected.svg || selected.url || null);
  }, [selected, onPick]);

  // V51 §2 — Brief intelligent dérivé du post (zéro saisie technique requise).
  // On détecte le format éditorial du texte, on construit un brief structuré
  // prêt pour Claude Design. Aucune IA réseau, aucune latence : pur JS.
  const deriveBrief = useCallback((): string => {
    const t = (contextText || '').trim();
    if (t.length < 40) return '';
    const detected = detectEditorialFormat(t);
    const fmt: EditorialFormat = detected?.format ?? (t.length < 400 ? 'mono_visual' : 'schema');
    return buildFormatBrief(fmt, t);
  }, [contextText]);

  const handleGenerate = useCallback(async (override?: unknown) => {
    // V50.2 — onClick passe un MouseEvent : on n'accepte un override que
    // si c'est une vraie chaîne (auto-génération depuis un format hint).
    const fromOverride = typeof override === 'string' && override.trim() ? override : '';
    // V51 §2 — Priorité : override > brief saisi (Avancé) > brief dérivé du
    // post > exemple du template. On a donc toujours un brief intelligent.
    const usePrompt = (fromOverride || prompt.trim() || deriveBrief() || TEMPLATES[template].example).trim();
    if (!usePrompt) return;
    setLoading(true); setError(null);
    try {
      // V12.2 — Transmet template + pilier pour tracing dans visual_items
      const r = await fetch('/api/generate-visual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: usePrompt, mode, notion_page_id: notionPageId, template, pilier: pilierProp || null })
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
        prompt: usePrompt,
        createdAt: Date.now(),
        visualScore: data.visualScore || undefined,
      };
      setVariants(list => [v, ...list].slice(0, 8)); // keep last 8
      setSelectedId(v.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [prompt, mode, notionPageId, template, pilierProp, deriveBrief]);

  // V50.2 — Auto-génération : quand l'éditeur déclenche un format hint
  // (« Générer un visuel »), on pré-remplit le brief ET on lance la génération
  // immédiatement, une seule fois par clic. L'utilisateur voit un asset se
  // construire au lieu d'un panneau vide.
  const lastAutoKey = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (autoGenerateKey == null) return;
    if (lastAutoKey.current === autoGenerateKey) return;
    if (!autoBrief || !autoBrief.trim()) return;
    lastAutoKey.current = autoGenerateKey;
    setPrompt(autoBrief);
    handleGenerate(autoBrief);
  }, [autoGenerateKey, autoBrief, handleGenerate]);

  async function suggestBrief() {
    if (briefLoading) return;
    setBriefLoading(true);
    try {
      // V51 §2 — Point de départ = brief dérivé du post si le champ est vide.
      const seed = prompt.trim() || deriveBrief();
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notion_page_id: notionPageId || 'visual-brief',
          draft: seed || '(brief vide)',
          instruction: 'Propose un brief visuel concis pour ce post (3-4 lignes max). Format de réponse : un paragraphe descriptif. Style sobre, design system Heelio bleu #2563EB, fond #F8FAFC. Pas d\'emoji.'
        })
      });
      const d = await r.json();
      if (r.ok && d.rewrite) setPrompt(d.rewrite);
    } catch {/* silent */}
    finally { setBriefLoading(false); }
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
      <div className="mb-3">
        <h3 className="font-semibold text-ink-900 text-sm">Visuel</h3>
        <p className="text-2xs text-ink-500 leading-relaxed mt-0.5">
          Claude Design compose un visuel éditorial à partir de votre post.
        </p>
      </div>

      {/* V12.7 — Claude Design en premier (4 templates), illustration DALL-E à part */}
      <div className="grid grid-cols-2 gap-1.5 mb-2">
        {(Object.entries(TEMPLATES) as Array<[keyof typeof TEMPLATES, typeof TEMPLATES[keyof typeof TEMPLATES]]>)
          .filter(([, v]) => v.mode === 'claude-design')
          .map(([k, v]) => (
            <button
              key={k}
              onClick={() => setTemplate(k)}
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
              onClick={() => setTemplate(k)}
              className={`text-left text-2xs px-3 py-1.5 rounded-md transition ${template === k ? 'bg-ink-100 text-ink-900 font-medium' : 'text-ink-500 hover:text-ink-900'}`}
              title="Pour les métaphores narratives uniquement. Préférez Claude Design pour les visuels produit et pédagogiques."
            >
              {v.label}
            </button>
          ))}
      </div>

      {/* V51 §2 — Action principale : un seul bouton, brief dérivé du post. */}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button onClick={handleGenerate} disabled={loading} className="btn-primary">
          {loading
            ? 'Cadence dessine… (10-30 sec)'
            : mode === 'claude-design'
              ? 'Créer avec Claude Design'
              : 'Créer (DALL-E)'}
        </button>
        <label className="btn-secondary cursor-pointer" title="Importer une image">
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

      {/* V51 §2 — Avancé : moteur + brief brut, repliés. Le défaut suffit. */}
      <details className="mt-3 group">
        <summary className="text-2xs text-ink-500 hover:text-ink-900 cursor-pointer select-none list-none flex items-center gap-1">
          <svg className="w-3 h-3 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6"/></svg>
          Avancé · moteur et brief
        </summary>
        <div className="mt-3 space-y-3">
          {/* Sélecteur de moteur IA */}
          <label className="block">
            <span className="text-2xs uppercase tracking-wider font-semibold text-ink-500">Moteur</span>
            <select
              value={engineOverride || TEMPLATES[template].mode}
              onChange={e => setEngineOverride(e.target.value as Mode)}
              className="input text-xs h-9 w-full mt-1"
              title="Choisissez le moteur de génération d'image"
            >
              {/* V39.3 — Un moteur sans clé est grisé (disabled). engines=null
                  pendant le chargement : on n'empêche rien tant qu'on ne sait pas. */}
              <option value="claude-design" disabled={engines !== null && !engines['claude-design']}>
                Claude Design · SVG{engines && !engines['claude-design'] ? ' (clé requise)' : ''}
              </option>
              <option value="openai" disabled={engines !== null && !engines.openai}>
                DALL-E 3 · OpenAI{engines && !engines.openai ? ' (clé requise)' : ''}
              </option>
              <option value="gemini" disabled={engines !== null && !engines.gemini}>
                Nano Banana · Gemini{engines && !engines.gemini ? ' (clé requise)' : ''}
              </option>
              <option value="replicate" disabled={engines !== null && !engines.replicate}>
                Flux · Replicate{engines && !engines.replicate ? ' (clé requise)' : ''}
              </option>
              <option value="stability" disabled={engines !== null && !engines.stability}>
                Stable Diffusion 3.5{engines && !engines.stability ? ' (clé requise)' : ''}
              </option>
              <option value="ideogram" disabled={engines !== null && !engines.ideogram}>
                Ideogram v3 · texte{engines && !engines.ideogram ? ' (clé requise)' : ''}
              </option>
            </select>
          </label>
          {/* V39.3 — Si le moteur sélectionné n'a pas de clé : message + lien Sources. */}
          {engines && engines[mode] === false && (
            <p className="text-2xs text-amber-700 leading-relaxed">
              Ce moteur nécessite une clé. <a href="/sources" className="underline decoration-dotted underline-offset-2 hover:text-amber-900">Connectez-le dans Sources</a>.
            </p>
          )}

          {/* Brief brut, éditable. Vide = Cadence le dérive du post. */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-ink-700">Brief (optionnel)</label>
              <button onClick={suggestBrief} disabled={briefLoading} className="btn-ghost text-2xs">
                {briefLoading ? 'Réflexion…' : 'Suggérer un brief'}
              </button>
            </div>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} placeholder={`Laissez vide : Cadence dérive un brief de votre post.\nEx. ${TEMPLATES[template].example}`} className="input text-sm" />
          </div>
        </div>
      </details>

      {/* Drop zone (always visible when no variant yet) */}
      {variants.length === 0 && !loading && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`mt-3 rounded-xl border-2 border-dashed p-6 text-center transition ${dragOver ? 'border-brand-400 bg-brand-50' : 'border-ink-200 bg-ink-50/50'}`}
        >
          <svg className="w-8 h-8 mx-auto text-ink-400 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12"/></svg>
          <p className="text-sm text-ink-600">Glissez une image ici, ou cliquez sur Créer.</p>
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
