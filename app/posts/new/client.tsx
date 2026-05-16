'use client';

// V8.6 — /posts/new refondu en single column premium
// Inspirations : Linear ticket / Notion page / Claude chat
// Sortie : single column max-w-3xl, hero suggestion en haut, CadenceEditor au centre, sticky footer

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import LinkedInPreview from '@/components/LinkedInPreview';
import PublishModal from '@/components/PublishModal';
import VisualGenerator from '@/components/VisualGenerator';
import CadenceEditor, { useEditorMetrics } from '@/components/CadenceEditor';
import CommandPalette, { Command } from '@/components/CommandPalette';
import PreviewDrawer from '@/components/PreviewDrawer';
import { SLASH_COMMANDS } from '@/components/SlashMenu';

const PILIERS = [
  'Lundi · Cas client',
  'Lundi · Cas dirigeant anonymisé',
  'Mardi · Pédagogie sans jargon',
  'Mercredi · Produit / démo / nouveauté / release note',
  'Jeudi · Opinion / hot take mesuré',
  'Vendredi · Build in public'
];

type Initial = null | { id?: string; title: string; pilier?: string; content: string; date?: string };
type Recyclable = { id: string; title: string; pilier?: string; impressions?: number; published_at: string };

export default function NewPostClient({
  initial, prefillBrief, prefillHook,
  suggestSource, suggestId, suggestScore, suggestPilier,
  suggestAngle, suggestWhy, suggestVisualIdea,
  filterSource, recyclables = []
}: {
  initial: Initial;
  prefillBrief?: string;
  prefillHook?: string;
  suggestSource?: string | null;
  suggestId?: string | null;
  suggestScore?: number | null;
  suggestPilier?: string | null;
  suggestAngle?: string | null;
  suggestWhy?: string | null;
  suggestVisualIdea?: string | null;
  filterSource?: string | null;
  recyclables?: Recyclable[];
}) {
  // ── State ─────────────────────────────────
  const [pilier, setPilier] = useState(initial?.pilier || PILIERS[2]);
  const [brief, setBrief] = useState(prefillBrief || '');
  const [text, setText] = useState(initial?.content || '');
  const [title, setTitle] = useState(initial?.title || '');
  const [date, setDate] = useState(initial?.date || new Date().toISOString().slice(0,10));
  const [time, setTime] = useState('07:30');
  const [anonOk, setAnonOk] = useState(false);
  const [validated, setValidated] = useState(false);
  const [proposals, setProposals] = useState<string[]>([]);
  const [proposalIdx, setProposalIdx] = useState(0);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false); // bottom collapsible (brief, schedule, validate)
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const { wordCount, charCount, readingMin } = useEditorMetrics(text);
  const pilierIsCasClient = pilier?.includes('Cas client') || pilier?.includes('Cas dirigeant');
  const lint = useMemo(() => analyzeAntiPatterns(text), [text]);
  const criticalLint = lint.filter(h => h.severity === 'critical');

  // Auto-pre-fill date based on pilier (only when no explicit date and no existing post)
  useEffect(() => {
    if (!pilier || initial?.id || initial?.date) return;
    const wd = /Lundi/.test(pilier) ? 1 : /Mardi/.test(pilier) ? 2 : /Mercredi/.test(pilier) ? 3 : /Jeudi/.test(pilier) ? 4 : /Vendredi/.test(pilier) ? 5 : -1;
    if (wd < 0) return;
    const next = new Date();
    next.setHours(7, 30, 0, 0);
    for (let i = 0; i < 14; i++) {
      if (next.getDay() === wd && next.getTime() > Date.now()) break;
      next.setDate(next.getDate() + 1);
    }
    const y = next.getFullYear(), m = String(next.getMonth() + 1).padStart(2, '0'), d2 = String(next.getDate()).padStart(2, '0');
    setDate(`${y}-${m}-${d2}`);
  }, [pilier, initial]);

  // ── Generate ─────────────────────────────
  const handleGenerate = useCallback(async (customBrief?: string) => {
    const b = customBrief ?? brief;
    if (!b.trim()) return;
    setGenLoading(true); setGenError(null); setProposals([]);
    try {
      const r = await fetch('/api/generate-post', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pilier, brief: b })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `Erreur ${r.status}`);
      const props = data.proposals || [];
      setProposals(props);
      if (props.length > 0) { setText(props[0]); setProposalIdx(0); }
    } catch (e: any) { setGenError(e.message); }
    finally { setGenLoading(false); }
  }, [brief, pilier]);

  // ── Save ─────────────────────────────────
  const handleSave = useCallback(async (asScheduled: boolean) => {
    setSaveLoading(true); setSaveMsg(null);
    try {
      const r = await fetch('/api/notion/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: initial?.id,
          title: title || (text.split('\n')[0] || 'Sans titre').slice(0, 80),
          pilier,
          date: asScheduled ? date : undefined,
          time: asScheduled ? time : undefined,
          anonymisation_ok: anonOk,
          content: text
        })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erreur sauvegarde Notion');
      const pageId = data.id || initial?.id;
      if (pageId) await fetch(`/api/notion/post/${pageId}/validate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ validated }) }).catch(() => {});
      setSaveMsg(asScheduled ? `Programmé ${validated ? '✓ validé' : ''}` : 'Brouillon sauvegardé');
      setTimeout(() => setSaveMsg(null), 2400);
    } catch (e: any) { setSaveMsg('Erreur : ' + e.message); }
    finally { setSaveLoading(false); }
  }, [initial?.id, title, text, pilier, date, time, anonOk, validated]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(o => !o); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') { e.preventDefault(); setPreviewOpen(o => !o); }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSave(false); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSave]);

  // Command palette commands
  const commands: Command[] = [
    { id: 'preview', label: previewOpen ? "Fermer l'aperçu LinkedIn" : "Ouvrir l'aperçu LinkedIn", hint: 'Drawer coulissant', group: 'Vue', shortcut: '⌘P', perform: () => setPreviewOpen(o => !o) },
    { id: 'options', label: optionsOpen ? 'Masquer les options' : 'Afficher les options', hint: 'Brief, garde-fous, programmation', group: 'Vue', perform: () => setOptionsOpen(o => !o) },
    { id: 'gen', label: 'Régénérer 3 propositions', hint: 'Re-run Claude avec le brief', group: 'Génération', perform: () => handleGenerate() },
    { id: 'save', label: 'Sauvegarder en brouillon', group: 'Sauvegarder', shortcut: '⌘S', perform: () => handleSave(false) },
    { id: 'sched', label: `Programmer pour le ${new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} à ${time}`, group: 'Sauvegarder', perform: () => handleSave(true) },
    ...SLASH_COMMANDS.map<Command>(c => ({
      id: 'slash-' + c.id, label: c.label, hint: c.hint, group: c.group || 'Améliorer',
      perform: async () => {
        const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notion_page_id: initial?.id || 'new-post', draft: text, instruction: c.prompt }) });
        const d = await r.json(); if (r.ok && d.rewrite) setText(d.rewrite);
      }
    })),
    { id: 'publish', label: 'Publier maintenant', hint: 'Validation requise', group: 'Avancé', perform: () => setPublishOpen(true) },
  ];

  const pilierShort = pilier.split('·')[1]?.trim() || pilier;
  const canPublish = text.trim() && (!pilierIsCasClient || anonOk) && !criticalLint.length;

  return (
    <div className="-mx-5 lg:-mx-10 -my-7 lg:-my-9 min-h-screen flex flex-col bg-white">
      {/* ── HEADER STICKY 56px ───────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex items-center gap-3 px-5 lg:px-8 h-14 border-b border-ink-100 bg-white/95 backdrop-blur">
        <Link href="/posts" className="btn-ghost text-sm" aria-label="Retour">←</Link>
        <span className="chip chip-neutral text-2xs whitespace-nowrap">
          {initial?.id ? '✦ Modification' : '✦ Nouveau'}
        </span>
        <select value={pilier} onChange={e => setPilier(e.target.value)} className="text-2xs bg-transparent border-0 focus:ring-0 cursor-pointer text-ink-700 hover:text-ink-900 max-w-[280px] truncate" title="Changer le pilier">
          {PILIERS.map(p => <option key={p} value={p}>{p.split('·')[1]?.trim() || p}</option>)}
        </select>
        {saveMsg && <span className="text-2xs text-success-700 flex items-center gap-1 animate-fade-in"><span className="dot bg-success-500" /> {saveMsg}</span>}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setCmdOpen(true)} className="btn-ghost text-xs" title="Commandes ⌘K">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.3-4.3"/></svg>
            <kbd className="hidden sm:inline px-1 rounded bg-ink-100 font-mono text-2xs ml-1">⌘K</kbd>
          </button>
          <button onClick={() => setPreviewOpen(o => !o)} className={`btn-ghost text-xs ${previewOpen ? 'bg-brand-50 text-brand-700' : ''}`} title="Aperçu LinkedIn ⌘P">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
            <span className="hidden sm:inline">Aperçu</span>
          </button>
        </div>
      </header>

      {/* ── MAIN single-column max-w-3xl ─────────────────────────── */}
      <div className="flex-1 w-full max-w-3xl mx-auto px-5 lg:px-8 py-8 lg:py-10 space-y-6">
        {/* Suggestion hero (only when text empty AND a suggestion is available) */}
        {!text && prefillBrief && (
          <SuggestionHero
            source={suggestSource} score={suggestScore} pilier={suggestPilier}
            brief={prefillBrief} hook={prefillHook} angle={suggestAngle}
            why={suggestWhy} visualIdea={suggestVisualIdea}
            id={suggestId} filterSource={filterSource} recyclables={recyclables}
            onAccept={() => handleGenerate(prefillBrief)}
            generating={genLoading}
          />
        )}

        {/* Start callout (no suggestion AND no text) */}
        {!text && !prefillBrief && (
          <StartCallout
            pilier={pilier}
            brief={brief}
            onBrief={setBrief}
            onGenerate={() => handleGenerate()}
            generating={genLoading}
            error={genError}
            recyclables={recyclables}
          />
        )}

        {/* Editor (always visible once there's text, or on user start writing) */}
        {(text || !prefillBrief) && (
          <CadenceEditor
            textareaRef={taRef}
            value={text}
            onChange={setText}
            draftId={initial?.id || 'new-post'}
            rows={text ? 18 : 6}
            placeholder={text ? '' : 'Ou commencez à écrire directement. Tapez / pour les commandes, @ pour mentionner.'}
            bare
          />
        )}

        {/* Alternative proposals (after generation) */}
        {proposals.length > 1 && (
          <div className="flex items-center gap-2 text-xs text-ink-500 animate-fade-in">
            <span>Cadence a généré {proposals.length} variantes :</span>
            {proposals.map((p, i) => (
              <button key={i} onClick={() => { setText(p); setProposalIdx(i); }} className={`px-2 py-1 rounded-md transition ${proposalIdx === i ? 'bg-brand-50 text-brand-700 font-medium' : 'text-ink-500 hover:bg-ink-50'}`}>
                v{i + 1}
              </button>
            ))}
            <button onClick={() => handleGenerate()} disabled={genLoading} className="ml-auto btn-ghost text-2xs">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M21 12a9 9 0 11-3-6.7L21 8"/></svg>
              Régénérer
            </button>
          </div>
        )}

        {/* Critical lint inline (only if critical issue) */}
        {criticalLint.length > 0 && (
          <div className="card p-3 border-danger-100 bg-danger-50/30 text-xs text-danger-700 flex items-center gap-2 animate-fade-in">
            <span>⚠</span>
            <span><strong>{criticalLint.length} problème critique :</strong> {criticalLint[0].label}{criticalLint[0].matches[0] ? ` (« ${criticalLint[0].matches[0]} »)` : ''}</span>
          </div>
        )}

        {/* Options collapsible (Schedule + Visuel + Garde-fous + Brief) */}
        {(optionsOpen || (initial?.id && text)) && (
          <section className="card p-5 space-y-4 animate-slide-up">
            {/* Brief */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-2xs uppercase tracking-wider font-semibold text-ink-500">Brief / contexte</label>
                {suggestSource && <span className="text-2xs text-ink-400">auto · {suggestSource}{suggestScore ? ` · ${suggestScore}/100` : ''}</span>}
              </div>
              <textarea
                value={brief} onChange={e => setBrief(e.target.value)}
                rows={2}
                placeholder="Ex : un client a divisé par 2 son DSO en passant à Heelio. Veut raconter le déclic + résultat sans donner le nom."
                className="input text-sm"
              />
              <button onClick={() => handleGenerate()} disabled={genLoading || !brief.trim()} className="btn-secondary text-xs mt-2">
                {genLoading ? 'Génération…' : '✨ Re-générer 3 propositions depuis ce brief'}
              </button>
            </div>

            {/* Programmation */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-ink-100">
              <div>
                <label className="text-2xs uppercase tracking-wider font-semibold text-ink-500">Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input text-sm mt-1" />
              </div>
              <div>
                <label className="text-2xs uppercase tracking-wider font-semibold text-ink-500">Heure</label>
                <input type="time" value={time} onChange={e => setTime(e.target.value)} className="input text-sm mt-1" />
              </div>
            </div>

            {/* Cas client safety */}
            {pilierIsCasClient && (
              <label className="flex items-start gap-2 cursor-pointer p-3 rounded-lg border border-warn-100 bg-warn-50/40">
                <input type="checkbox" checked={anonOk} onChange={e => setAnonOk(e.target.checked)} className="mt-0.5 w-3.5 h-3.5 rounded border-ink-300 text-brand-500" />
                <span className="text-xs text-ink-700">
                  <strong className="block text-ink-900">Anonymisation OK validée</strong>
                  Obligatoire avant publication d'un cas client (pas de nom, pas de chiffres internes identifiables).
                </span>
              </label>
            )}
          </section>
        )}

        {/* Generation in progress */}
        {genLoading && (
          <div className="card p-4 border-brand-100 bg-brand-50/30 text-sm text-ink-700 flex items-center gap-3 animate-fade-in">
            <span className="dot bg-brand-500 animate-pulse-soft" />
            <span>Cadence rédige 3 propositions pour vous (15-30 secondes)…</span>
          </div>
        )}
        {genError && (
          <div className="card p-3 border-danger-100 bg-danger-50/30 text-sm text-danger-700">
            Erreur génération : {genError}
          </div>
        )}
      </div>

      {/* ── FOOTER STICKY 48px ───────────────────────────────────── */}
      <footer className="sticky bottom-0 z-20 border-t border-ink-100 bg-white/95 backdrop-blur">
        <div className="max-w-3xl mx-auto px-5 lg:px-8 h-12 flex items-center gap-3 text-xs text-ink-500">
          {text && (
            <>
              <span className="tabular-nums hidden sm:inline">{wordCount} mots · ~{readingMin} min</span>
              <span className={`tabular-nums ${charCount > 1300 ? 'text-danger-500 font-semibold' : ''}`}>{charCount}/1300</span>
            </>
          )}
          <button onClick={() => setOptionsOpen(o => !o)} className="btn-ghost text-2xs">
            {optionsOpen ? '↑ Options' : '↓ Options'}
          </button>
          <span className="ml-auto flex items-center gap-2">
            <label className="hidden sm:flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={validated} onChange={e => setValidated(e.target.checked)} className="w-3.5 h-3.5 rounded border-ink-300 text-brand-500" />
              <span>Validé pour cron</span>
            </label>
            <button onClick={() => handleSave(false)} disabled={saveLoading || !text.trim()} className="btn-ghost text-xs">{saveLoading ? '…' : 'Sauvegarder'}</button>
            <button onClick={() => handleSave(true)} disabled={saveLoading || !text.trim()} className="btn-secondary text-xs">
              {saveLoading ? '…' : `Programmer ${new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} ${time.slice(0,5)}`}
            </button>
            <button onClick={() => setPublishOpen(true)} disabled={!canPublish} className="btn-primary text-xs" title={!canPublish ? (criticalLint.length ? 'Corrigez les problèmes critiques' : 'Texte requis') : undefined}>
              Publier…
            </button>
          </span>
        </div>
      </footer>

      {/* ── PREVIEW DRAWER ───────────────────────────────────────── */}
      <PreviewDrawer open={previewOpen} onClose={() => setPreviewOpen(false)}>
        <LinkedInPreview text={text} image={imageUrl || undefined} />
        <div className="mt-6">
          <VisualGenerator
            defaultPrompt={text ? `Visuel d'accompagnement : ${text.slice(0, 200)} (Style Heelio)` : ''}
            notionPageId={initial?.id}
            onPick={setImageUrl}
          />
        </div>
      </PreviewDrawer>

      {/* ── COMMAND PALETTE ──────────────────────────────────────── */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} commands={commands} />

      <PublishModal open={publishOpen} onClose={() => setPublishOpen(false)} text={text} notionPageId={initial?.id} />
    </div>
  );
}

// ══════════════ SUB-COMPONENTS ══════════════

function SuggestionHero({
  source, score, pilier, brief, hook, angle, why, visualIdea, id, filterSource, recyclables,
  onAccept, generating
}: {
  source?: string|null; score?: number|null; pilier?: string|null; brief?: string; hook?: string;
  angle?: string|null; why?: string|null; visualIdea?: string|null;
  id?: string|null; filterSource?: string|null; recyclables: Recyclable[];
  onAccept: () => void; generating: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showRecyclables, setShowRecyclables] = useState(false);

  return (
    <section className="card p-5 border-brand-100 bg-gradient-to-br from-brand-50/40 to-white animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700 text-lg shrink-0">✨</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-2xs uppercase tracking-wider font-semibold text-brand-700">Cadence vous propose</span>
            {source && <span className="chip chip-brand text-2xs">{source}</span>}
            {score != null && <span className="text-2xs text-ink-500">· score {score}/100</span>}
            {pilier && <span className="text-2xs text-ink-500">· {pilier.split('·')[1]?.trim() || pilier}</span>}
          </div>
          <h2 className="mt-1 text-base font-semibold text-ink-900 leading-snug">{brief}</h2>
          {hook && <p className="mt-2 text-sm text-ink-700 italic border-l-2 border-brand-300 pl-3">« {hook} »</p>}
          {expanded && (
            <div className="mt-3 space-y-1.5 pt-3 border-t border-brand-100 text-xs animate-slide-up">
              {why && <div><span className="font-semibold text-ink-700">Pourquoi : </span><span className="text-ink-600">{why}</span></div>}
              {angle && <div><span className="font-semibold text-ink-700">Angle : </span><span className="text-ink-600">{angle}</span></div>}
              {visualIdea && <div><span className="font-semibold text-ink-700">Visuel : </span><span className="text-ink-600">{visualIdea}</span></div>}
              {!why && !angle && !visualIdea && <div className="text-ink-500 italic">Suggestion heuristique.</div>}
            </div>
          )}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <button onClick={onAccept} disabled={generating} className="btn-primary">
              {generating ? (<><span className="dot bg-white animate-pulse-soft" /> Cadence rédige…</>) : 'Écrire ce post →'}
            </button>
            <button onClick={() => setExpanded(e => !e)} className="btn-ghost text-xs">{expanded ? '↑ Masquer' : '↓ Voir pourquoi'}</button>
            {id && <a href={'/posts/new?skip=' + id + (filterSource ? '&source=' + filterSource : '')} className="btn-ghost text-xs">↻ Autre idée</a>}
            {recyclables.length > 0 && <button onClick={() => setShowRecyclables(s => !s)} className="btn-ghost text-xs">⟲ Recycler ancien</button>}
          </div>
          {showRecyclables && (
            <div className="mt-3 p-2 rounded-lg border border-ink-200 bg-white max-h-60 overflow-y-auto animate-slide-up">
              <div className="text-2xs font-semibold text-ink-500 mb-1.5">Anciens posts à recycler ({recyclables.length})</div>
              <div className="space-y-1">
                {recyclables.slice(0, 5).map(r => (
                  <a key={r.id} href={'/posts/new?from=' + r.id + '&recycle=1'} className="block p-2 rounded-md hover:bg-ink-50 text-xs transition">
                    <div className="font-medium text-ink-900 truncate">{r.title}</div>
                    <div className="text-2xs text-ink-500 mt-0.5">{r.pilier?.split('·')[1]?.trim() || '—'} · {new Date(r.published_at).toLocaleDateString('fr-FR')}{r.impressions ? ' · ' + r.impressions.toLocaleString('fr-FR') + ' imp' : ''}</div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StartCallout({
  pilier, brief, onBrief, onGenerate, generating, error, recyclables
}: {
  pilier: string; brief: string; onBrief: (s: string) => void;
  onGenerate: () => void; generating: boolean; error: string | null; recyclables: Recyclable[];
}) {
  return (
    <section className="card p-5 animate-fade-in">
      <h2 className="font-semibold text-ink-900">De quoi voulez-vous parler ?</h2>
      <p className="text-xs text-ink-500 mt-0.5">Brief court — Cadence en fera 3 versions. Ou commencez à écrire directement dans la zone ci-dessous.</p>
      <textarea
        value={brief} onChange={e => onBrief(e.target.value)}
        rows={3}
        placeholder={`Ex (${pilier.split('·')[1]?.trim() || 'sujet'}) : un client a divisé par 2 son DSO en passant à Heelio.`}
        className="input text-sm mt-3 font-editorial leading-[1.55]"
        autoFocus
      />
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <button onClick={onGenerate} disabled={generating || !brief.trim()} className="btn-primary">
          {generating ? (<><span className="dot bg-white animate-pulse-soft" /> Génération…</>) : '✨ Générer 3 propositions'}
        </button>
        <Link href="/suggestions" className="btn-ghost text-xs">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M12 3v4M12 17v4M3 12h4M17 12h4"/></svg>
          Voir le Radar
        </Link>
        {recyclables.length > 0 && <a href={'/posts/new?from=' + recyclables[0].id + '&recycle=1'} className="btn-ghost text-xs">⟲ Recycler un ancien</a>}
      </div>
      {error && <p className="mt-3 text-xs text-danger-700">Erreur : {error}</p>}
    </section>
  );
}

// ── Anti-pattern linter ─────────────────────
function analyzeAntiPatterns(text: string) {
  const hits: { id: string; label: string; severity: 'critical' | 'high' | 'medium'; matches: string[] }[] = [];
  if (!text.trim()) return hits;
  if (/[—–]/.test(text)) hits.push({ id: 'em_dash', label: 'Tiret long (— ou –) interdit', severity: 'critical', matches: text.match(/[—–]/g) || [] });
  if (/(c['e]?st|n['e]?st)\s+pas\s+\w+[\s,]+c['e]?st\s+\w+/i.test(text)) hits.push({ id: 'not_x_y', label: '« Ce n\'est pas X, c\'est Y » interdit', severity: 'critical', matches: ['(détecté)'] });
  if (/\b(seamless|robust|delve|leverage|unlock|unleash|deep dive|game[- ]?changer|dans un monde où)\b/i.test(text)) hits.push({ id: 'creux', label: 'Mot creux IA détecté', severity: 'high', matches: text.match(/\b(seamless|robust|delve|leverage|unlock|unleash|deep dive|game[- ]?changer|dans un monde où)\b/gi) || [] });
  if (/\b(tu|toi|ton|ta|tes)\b/i.test(text)) hits.push({ id: 'tu', label: 'Tutoiement détecté (vouvoiement requis)', severity: 'high', matches: text.match(/\b(tu|toi|ton|ta|tes)\b/gi) || [] });
  return hits;
}
