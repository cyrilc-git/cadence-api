'use client';

// V50.1 — Studio carrousel : MVP simple et premium.
// Idée → structure de slides → édition → export PDF LinkedIn-ready.
// Pas un builder Canva : une preview, quelques slides éditables, un export.
//
// Le plan vient de lib/carousel.planSlides (pur, importable client). On le
// rend éditable en local, puis on POST le plan retouché à
// /api/carousel/export qui le rend en PDF tel quel (V50.1 plan override).

import { useMemo, useState } from 'react';
import { planSlides, formatLabel, type CarouselPlan, type Slide } from '@/lib/carousel';
import { toast } from '@/components/Dialog';

const KIND_LABEL: Record<string, string> = {
  hook: 'Ouverture',
  reveal: 'En réalité',
  proof: 'En chiffres',
  step: 'Étape',
  conclusion: 'À retenir',
  cta: 'Pour aller plus loin',
  quote: 'Citation',
  kpi: 'Le chiffre',
  comparison: 'Avant / après',
  divider: 'Section',
  list: 'En clair',
};

export default function CarouselStudio({ text, onClose }: { text: string; onClose?: () => void }) {
  const initialPlan = useMemo(() => planSlides(text), [text]);
  const [plan, setPlan] = useState<CarouselPlan>(initialPlan);
  const [active, setActive] = useState(0);
  const [exporting, setExporting] = useState(false);

  function updateSlide(idx: number, patch: Partial<Slide>) {
    setPlan(p => ({ ...p, slides: p.slides.map((s, i) => i === idx ? { ...s, ...patch } : s) }));
  }

  async function exportPdf() {
    setExporting(true);
    try {
      const r = await fetch('/api/carousel/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || 'Export impossible');
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      toast.success('Carrousel PDF généré');
    } catch (e: any) {
      toast.error('Export : ' + e.message);
    } finally {
      setExporting(false);
    }
  }

  if (!plan.slides.length) {
    return <p className="text-sm text-ink-500">Texte trop court pour un carrousel.</p>;
  }

  const slide = plan.slides[active];

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-ink-900 text-sm">Carrousel · {formatLabel(plan.format)}</h3>
          <p className="text-2xs text-ink-500 mt-0.5">{plan.slides.length} slides · 1 idée par slide. Éditez puis exportez.</p>
        </div>
        <button onClick={exportPdf} disabled={exporting} className="btn-primary text-xs">
          {exporting ? 'Génération…' : 'Exporter en PDF'}
        </button>
      </div>

      {/* Aperçu de la slide active : grand titre, peu de texte, beaucoup d'air */}
      <div className="rounded-xl border border-ink-200 bg-[#FAFAF9] aspect-square max-w-sm mx-auto p-6 flex flex-col justify-between overflow-hidden">
        <div>
          <div className="w-8 h-0.5 bg-brand-500 mb-3" aria-hidden />
          <p className="text-2xs uppercase tracking-wider font-semibold text-ink-400">{KIND_LABEL[slide.kind] || ''}</p>
        </div>
        <div className="flex-1 flex flex-col justify-center">
          {slide.metric && <p className="text-4xl font-bold text-brand-700 tracking-tight leading-none mb-2">{slide.metric}</p>}
          {slide.title && slide.title !== slide.body && <p className="text-lg font-semibold text-ink-900 leading-snug mb-1.5">{slide.title}</p>}
          {slide.body && <p className={`${slide.kind === 'hook' ? 'text-lg' : 'text-sm'} text-ink-800 leading-relaxed font-editorial`}>{slide.body}</p>}
          {slide.kind === 'comparison' && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-2xs uppercase font-semibold text-ink-400">Avant</span><p className="mt-1 text-ink-800">{slide.before}</p></div>
              <div><span className="text-2xs uppercase font-semibold text-brand-600">Après</span><p className="mt-1 text-ink-800">{slide.after}</p></div>
            </div>
          )}
          {slide.kind === 'list' && slide.bullets && (
            <ul className="space-y-1.5">{slide.bullets.map((b, i) => <li key={i} className="text-sm text-ink-800 flex gap-2"><span className="w-1 h-1 rounded-full bg-brand-500 mt-2 shrink-0" />{b}</li>)}</ul>
          )}
        </div>
        <div className="flex items-center justify-between text-2xs text-ink-400">
          <span className="uppercase tracking-wider font-semibold">Cadence · Heelio</span>
          <span className="tabular-nums">{active + 1} / {plan.slides.length}</span>
        </div>
      </div>

      {/* Pellicule de navigation des slides */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {plan.slides.map((s, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`shrink-0 w-12 h-12 rounded-md border text-2xs font-semibold tabular-nums transition ${i === active ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-400 hover:border-ink-300'}`}
            title={KIND_LABEL[s.kind] || ''}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Édition du texte de la slide active */}
      <div className="space-y-2">
        {slide.kind !== 'comparison' && slide.kind !== 'list' && (
          <>
            {(slide.title || slide.kind === 'kpi') && (
              <input
                value={slide.title || ''}
                onChange={e => updateSlide(active, { title: e.target.value })}
                placeholder="Titre court"
                className="input text-sm w-full"
              />
            )}
            <textarea
              value={slide.body || ''}
              onChange={e => updateSlide(active, { body: e.target.value })}
              rows={3}
              placeholder="Texte de la slide (gardez court)"
              className="input text-sm w-full resize-none"
            />
          </>
        )}
        {slide.kind === 'comparison' && (
          <div className="grid grid-cols-2 gap-2">
            <textarea value={slide.before || ''} onChange={e => updateSlide(active, { before: e.target.value })} rows={2} placeholder="Avant" className="input text-sm resize-none" />
            <textarea value={slide.after || ''} onChange={e => updateSlide(active, { after: e.target.value })} rows={2} placeholder="Après" className="input text-sm resize-none" />
          </div>
        )}
        {slide.kind === 'list' && (slide.bullets || []).map((b, bi) => (
          <input
            key={bi}
            value={b}
            onChange={e => updateSlide(active, { bullets: (slide.bullets || []).map((x, j) => j === bi ? e.target.value : x) })}
            className="input text-sm w-full"
          />
        ))}
        <p className="text-2xs text-ink-400">{(slide.body || '').length} caractères · gardez sous 280 pour la lisibilité.</p>
      </div>

      {onClose && (
        <button onClick={onClose} className="text-2xs text-ink-500 hover:text-ink-900 transition">Fermer le studio</button>
      )}
    </div>
  );
}
