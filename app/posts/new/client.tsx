'use client';

// V8.9.1 §B — /posts/new refondu en éditeur silencieux.
// V51 §2 — Réparer Écrire (coeur). On retire le bruit : sélecteur de voix
// (7 modes), accordéon « ce que Cadence prend en compte », générateur de
// hooks repliable, toggle « validé pour cron », popover ⋯ qui cachait les
// actions. À la place : une zone d'écriture claire et des boutons EXPLICITES
// — Rédiger avec Cadence · Améliorer · Visuel · Enregistrer · Programmer ·
// Publier. Le visuel passe par Claude Design avec un brief dérivé du post.

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import LinkedInPreview from '@/components/LinkedInPreview';
import PublishModal from '@/components/PublishModal';
import VisualGenerator from '@/components/VisualGenerator';
import CadenceEditor, { useEditorMetrics } from '@/components/CadenceEditor';
import CarouselStudio from '@/components/CarouselStudio';
import CommandPalette, { Command } from '@/components/CommandPalette';
import PreviewDrawer from '@/components/PreviewDrawer';
import { SLASH_COMMANDS } from '@/components/SlashMenu';
import { checkAntiPatterns, autoFixAntiPatterns } from '@/lib/brand-config';
import { detectEditorialFormat, buildFormatBrief, formatToVisualTemplate, pilierFormatHint, type EditorialFormat } from '@/lib/format-intelligence';

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
type Proposal = { id: string; title: string; hook?: string | null; why?: string | null; pilier?: string | null };

export default function NewPostClient({
  initial, prefillBrief, prefillHook,
  suggestSource, suggestId, suggestPilier, suggestWhy,
  filterSource, recyclables = [], proposal = null,
}: {
  initial: Initial;
  prefillBrief?: string;
  prefillHook?: string;
  suggestSource?: string | null;
  suggestId?: string | null;
  suggestPilier?: string | null;
  suggestWhy?: string | null;
  filterSource?: string | null;
  recyclables?: Recyclable[];
  proposal?: Proposal | null;
}) {
  const [pilier, setPilier] = useState(initial?.pilier || PILIERS[2]);
  const [brief, setBrief] = useState(prefillBrief || '');
  const [text, setText] = useState(initial?.content || '');
  const [title, setTitle] = useState(initial?.title || '');
  const [date, setDate] = useState(initial?.date || new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('07:30');
  const [anonOk, setAnonOk] = useState(false);
  const [proposals, setProposals] = useState<string[]>([]);
  const [proposalIdx, setProposalIdx] = useState(0);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [improving, setImproving] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishMode, setPublishMode] = useState<'schedule' | 'publish'>('schedule');
  const [cmdOpen, setCmdOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // V12.8 §2 — format suggéré, pré-sélectionné dans VisualGenerator
  const [suggestedVisualFormat, setSuggestedVisualFormat] = useState<string | null>(null);
  // V50.2 — Brief format-aware + clé d'auto-génération : un clic sur « Visuel »
  // génère l'asset immédiatement via Claude Design.
  const [autoVisualBrief, setAutoVisualBrief] = useState<string | null>(null);
  const [autoGenerateKey, setAutoGenerateKey] = useState(0);
  // V50.1 — Studio carrousel ouvert dans le drawer
  const [carouselMode, setCarouselMode] = useState(false);
  const [pilierOpen, setPilierOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // V38.1 — Suivi de versions. Chaque génération / réécriture / amélioration
  // pousse un snapshot. Le revert lui-même est annulable.
  type PostVersion = { id: string; text: string; label: string; ts: number };
  const [versions, setVersions] = useState<PostVersion[]>([]);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const lastSnapshotRef = useRef<string>('');

  const pushVersion = useCallback((snapshotText: string, label: string) => {
    const t = (snapshotText || '').trim();
    if (!t) return;
    if (t === lastSnapshotRef.current) return;
    lastSnapshotRef.current = t;
    setVersions(prev => {
      const next: PostVersion = { id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, text: t, label, ts: Date.now() };
      return [next, ...prev].slice(0, 20);
    });
  }, []);

  const revertToVersion = useCallback((v: PostVersion) => {
    if (text.trim() && text.trim() !== v.text) {
      pushVersion(text, 'Avant retour arrière');
    }
    setText(v.text);
    setVersionsOpen(false);
  }, [text, pushVersion]);

  // V42 — Inspirations actives : leur style influence la génération (jamais le
  // contenu). On les charge silencieusement et on les passe à /api/generate-post.
  const [activeInspos, setActiveInspos] = useState<Array<{ id: string; name: string; style_notes?: string }>>([]);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/inspirations')
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        const act = (d.items || []).filter((i: any) => i.active && i.style_notes).slice(0, 5);
        setActiveInspos(act);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const { wordCount, charCount } = useEditorMetrics(text);
  const pilierIsCasClient = pilier?.includes('Cas client') || pilier?.includes('Cas dirigeant');
  const lint = useMemo(() => checkAntiPatterns(text), [text]);
  const criticalLint = lint.filter(h => h.severity === 'critical');

  // Date par défaut alignée sur le jour du pilier (post neuf uniquement).
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

  const handleGenerate = useCallback(async (customBrief?: string) => {
    const b = customBrief ?? brief;
    if (!b.trim()) return;
    if (text.trim()) pushVersion(text, 'Avant régénération');
    setGenLoading(true); setGenError(null); setProposals([]);
    try {
      const r = await fetch('/api/generate-post', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // V51 §2 — Toujours « ma voix » : Cadence écrit dans la voix du fondateur.
        body: JSON.stringify({
          pilier, brief: b, voiceMode: 'ma_voix',
          inspirations: activeInspos.map(i => i.style_notes).filter(Boolean),
        })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      const list = data.proposals || [];
      setProposals(list);
      if (list.length) {
        setText(list[0]);
        setProposalIdx(0);
        pushVersion(list[0], 'Proposition Cadence');
      }
    } catch (e: any) { setGenError(e.message); }
    finally { setGenLoading(false); }
  }, [brief, pilier, text, pushVersion, activeInspos]);

  // V51 §2 — « Améliorer » : une passe de resserrage qui garde la voix.
  const improveText = useCallback(async () => {
    if (!text.trim() || improving) return;
    pushVersion(text, 'Avant amélioration');
    setImproving(true);
    try {
      const r = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notion_page_id: initial?.id || 'new-post',
          draft: text,
          instruction: "Améliore ce post LinkedIn : un hook plus net, des phrases plus directes, des paragraphes aérés. Retire tout ce qui sonne « écrit par une IA » (formules creuses, transitions scolaires, conclusions « en résumé »). Garde EXACTEMENT ma voix, mes idées, mes exemples et mes chiffres. Ne rallonge pas : resserre.",
        }),
      });
      const d = await r.json();
      if (r.ok && d.rewrite) {
        setText(d.rewrite);
        pushVersion(d.rewrite, 'Amélioré');
      }
    } catch {/* silent */}
    finally { setImproving(false); }
  }, [text, improving, initial?.id, pushVersion]);

  // V51 §2 — « Générer un visuel » : Cadence détecte le format du post, dérive
  // un brief Claude Design et ouvre le studio en générant immédiatement. Texte
  // long et structuré -> studio carrousel.
  const generateVisual = useCallback(() => {
    if (!text.trim()) return;
    const detected = detectEditorialFormat(text);
    if (detected?.format === 'carousel') {
      setCarouselMode(true);
      setPreviewOpen(true);
      return;
    }
    const fmt: EditorialFormat = detected?.format ?? pilierFormatHint(pilier)?.format ?? (text.length < 400 ? 'mono_visual' : 'schema');
    setCarouselMode(false);
    setSuggestedVisualFormat(formatToVisualTemplate(fmt));
    setAutoVisualBrief(buildFormatBrief(fmt, text));
    setAutoGenerateKey(k => k + 1);
    setPreviewOpen(true);
  }, [text, pilier]);

  const handleSave = useCallback(async (programmer: boolean) => {
    if (!text.trim()) return;
    setSaveLoading(true); setSaveMsg(null);
    try {
      // V51 §2 — validated:false toujours. Le cron n'auto-publie jamais un
      // brouillon : la publication passe par une validation explicite.
      const body: any = {
        title: title || text.split('\n')[0].slice(0, 80),
        content: text,
        pilier,
        validated: false,
      };
      if (programmer) {
        body.scheduled_date = date;
        body.scheduled_time = time;
        body.status = 'scheduled';
      }
      const r = await fetch(initial?.id ? `/api/notion/post/${initial.id}` : '/api/notion/posts', {
        method: initial?.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setSaveMsg(programmer ? `Programmé ${new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}` : 'Sauvegardé');
      setTimeout(() => setSaveMsg(null), 2400);
    } catch (e: any) { setSaveMsg('Erreur : ' + e.message); }
    finally { setSaveLoading(false); }
  }, [initial?.id, title, text, pilier, date, time]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(o => !o); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') { e.preventDefault(); setPreviewOpen(o => !o); }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSave(false); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSave]);

  const pilierShort = pilier.split('·')[1]?.trim() || pilier;
  const canPublish = text.trim() && (!pilierIsCasClient || anonOk) && !criticalLint.length;
  const hasText = text.trim().length > 0;

  const commands: Command[] = [
    { id: 'preview', label: previewOpen ? "Fermer l'aperçu LinkedIn" : "Ouvrir l'aperçu LinkedIn", hint: 'Drawer coulissant', group: 'Vue', shortcut: '⌘P', perform: () => setPreviewOpen(o => !o) },
    { id: 'pilier', label: 'Changer de pilier', group: 'Vue', perform: () => setPilierOpen(true) },
    { id: 'gen', label: 'Rédiger avec Cadence', hint: 'Trois versions à partir du brief', group: 'Écrire', perform: () => handleGenerate() },
    { id: 'improve', label: 'Améliorer le texte', hint: 'Resserre, garde la voix', group: 'Écrire', perform: improveText },
    { id: 'visual', label: 'Générer un visuel', hint: 'Claude Design', group: 'Écrire', perform: generateVisual },
    { id: 'save', label: 'Enregistrer le brouillon', group: 'Sauvegarder', shortcut: '⌘S', perform: () => handleSave(false) },
    { id: 'sched', label: `Programmer pour le ${new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`, group: 'Sauvegarder', perform: () => { setPublishMode('schedule'); setPublishOpen(true); } },
    ...SLASH_COMMANDS.map<Command>(c => ({
      id: 'slash-' + c.id, label: c.label, hint: c.hint, group: c.group || 'Améliorer',
      perform: async () => {
        const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notion_page_id: initial?.id || 'new-post', draft: text, instruction: c.prompt }) });
        const d = await r.json(); if (r.ok && d.rewrite) setText(d.rewrite);
      }
    })),
    { id: 'publish', label: 'Publier maintenant', hint: 'Validation requise', group: 'Avancé', perform: () => { setPublishMode('publish'); setPublishOpen(true); } },
  ];

  // V14.1 — Focus mode automatique : au-delà de 240 caractères on atténue le
  // chrome (header) pour laisser le texte respirer.
  const deepWriting = hasText && text.length > 240;
  useEffect(() => {
    const reading = hasText && text.length > 600;
    if (reading) document.body.classList.add('deep-writing');
    else document.body.classList.remove('deep-writing');
    return () => { document.body.classList.remove('deep-writing'); };
  }, [hasText, text.length]);

  return (
    <div className={`group/page min-h-screen min-h-[100dvh] flex flex-col editorial-canvas transition-[padding] duration-300 ease-out-expo ${previewOpen ? 'lg:pr-[480px]' : ''}`}>
      <header className={`flex items-center gap-2 px-5 lg:px-8 h-14 sm:h-12 relative pt-[env(safe-area-inset-top)] transition-opacity duration-300 ${deepWriting ? 'opacity-30 hover:opacity-100 focus-within:opacity-100' : 'opacity-100'}`}>
        <Link href="/posts" className="text-ink-500 hover:text-ink-900 transition w-10 h-10 sm:w-8 sm:h-8 inline-flex items-center justify-center -ml-2 sm:-ml-1" aria-label="Retour à la bibliothèque" title="Retour">←</Link>

        <div className="relative mx-auto">
          <button
            onClick={() => setPilierOpen(o => !o)}
            className="text-2xs uppercase tracking-wider font-semibold text-ink-500 hover:text-ink-900 transition px-2 py-1 rounded-md hover:bg-ink-50"
            title="Changer le pilier"
            aria-haspopup="true"
            aria-expanded={pilierOpen}
          >
            {pilierShort}
            <span className="ml-1 text-ink-300">▾</span>
          </button>
          {pilierOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setPilierOpen(false)} />
              <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-40 card p-1 min-w-[280px] shadow-pop animate-fade-in">
                {PILIERS.map(p => (
                  <button
                    key={p}
                    onClick={() => { setPilier(p); setPilierOpen(false); }}
                    className={`w-full text-left text-sm px-3 py-2 rounded-md transition ${p === pilier ? 'bg-brand-50 text-brand-700 font-medium' : 'hover:bg-ink-50 text-ink-800'}`}
                  >
                    {p.split('·')[1]?.trim() || p}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {saveMsg && <span className="absolute left-1/2 top-12 -translate-x-1/2 text-2xs text-success-700 flex items-center gap-1 animate-fade-in bg-white px-2 py-0.5 rounded-md shadow-xs"><span className="dot bg-success-500" /> {saveMsg}</span>}

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setCmdOpen(true)} className="w-10 h-10 sm:w-8 sm:h-8 inline-flex items-center justify-center text-ink-400 hover:text-ink-900 rounded-md hover:bg-ink-50 transition" title="Commandes (⌘K)" aria-label="Commandes">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.3-4.3"/></svg>
          </button>
          <button onClick={() => setPreviewOpen(o => !o)} className={`w-10 h-10 sm:w-8 sm:h-8 inline-flex items-center justify-center rounded-md transition ${previewOpen ? 'text-brand-700 bg-brand-50' : 'text-ink-400 hover:text-ink-900 hover:bg-ink-50'}`} title="Aperçu LinkedIn (⌘P)" aria-label="Aperçu LinkedIn">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </header>

      <div className="flex-1 w-full max-w-2xl mx-auto px-5 lg:px-8 py-10 lg:py-16">
        {!hasText && prefillBrief && (
          <SuggestionBand
            pilier={suggestPilier}
            brief={prefillBrief} hook={prefillHook}
            why={suggestWhy}
            id={suggestId} filterSource={filterSource}
            onAccept={() => handleGenerate(prefillBrief)}
            generating={genLoading}
          />
        )}

        {!hasText && !prefillBrief && (
          <>
            {proposal && (
              <SuggestionBand
                pilier={proposal.pilier}
                brief={proposal.title} hook={proposal.hook}
                why={proposal.why}
                id={proposal.id} filterSource={null}
                onAccept={() => { if (proposal.pilier) setPilier(proposal.pilier); handleGenerate(proposal.title); }}
                generating={genLoading}
              />
            )}
            <div className={proposal ? 'mt-8' : ''}>
              <StartHint
                pilier={pilier}
                brief={brief}
                onBrief={setBrief}
                onGenerate={() => handleGenerate()}
                generating={genLoading}
                error={genError}
                recyclables={recyclables}
              />
            </div>
          </>
        )}

        {(hasText || !prefillBrief) && (
          <div className={hasText ? 'mt-4' : 'mt-10'}>
            <CadenceEditor
              textareaRef={taRef}
              value={text}
              onChange={setText}
              draftId={initial?.id || 'new-post'}
              rows={hasText ? 22 : 8}
              placeholder={hasText ? '' : (prefillBrief ? 'Commencez à écrire ici. Tapez / pour les commandes.' : '')}
              bare
              brief={brief || prefillBrief}
              pilier={pilier}
              onResult={r => {
                if (text.trim() && text.trim() !== r.trim()) pushVersion(text, 'Avant réécriture');
                setProposals([r]); setProposalIdx(0);
                pushVersion(r, 'Réécriture Cadence');
              }}
            />
          </div>
        )}

        {proposals.length > 1 && (
          <div className="mt-4 flex items-center gap-2 text-2xs text-ink-400 animate-fade-in">
            <span>Variantes :</span>
            {proposals.map((p, i) => (
              <button key={i} onClick={() => { setText(p); setProposalIdx(i); }} className={`px-2 py-0.5 rounded-md transition ${proposalIdx === i ? 'bg-ink-100 text-ink-900 font-medium' : 'text-ink-500 hover:bg-ink-50'}`}>
                v{i + 1}
              </button>
            ))}
            <button onClick={() => handleGenerate()} disabled={genLoading} className="ml-auto text-ink-400 hover:text-ink-700" title="Régénérer">↻</button>
          </div>
        )}

        {hasText && criticalLint.length > 0 && (
          <div className="mt-4 text-xs text-danger-700 flex items-center gap-3 animate-fade-in flex-wrap">
            <span className="inline-flex items-center gap-2">
              <span aria-hidden>⚠</span>
              <span>{criticalLint[0].label}{criticalLint[0].matches[0] ? ` (« ${criticalLint[0].matches[0]} »)` : ''}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                const { text: fixed, changes } = autoFixAntiPatterns(text);
                if (changes.length > 0 && fixed !== text) setText(fixed);
              }}
              className="ml-auto text-2xs text-brand-700 hover:text-brand-900 transition underline decoration-dotted underline-offset-2"
              title="Corrige em-dash, smart quotes, ellipsis, emojis, espaces"
            >
              Calmer le texte
            </button>
          </div>
        )}

        {genLoading && !hasText && <GenerationStatus />}
        {genError && <div className="mt-4 text-xs text-danger-700">Erreur : {genError}</div>}
      </div>

      {hasText && (
        <footer className="sticky bottom-0 z-20 border-t border-ink-100 bg-white/90 backdrop-blur">
          <div className="max-w-2xl mx-auto px-5 lg:px-8 py-2.5 flex items-center gap-x-3 gap-y-2 flex-wrap text-xs text-ink-500 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
            <span className="tabular-nums text-ink-500">
              {wordCount} mots
              <span className={`ml-2 ${charCount > 1300 ? 'text-danger-500 font-semibold' : 'text-ink-400'}`}>{charCount}/1300</span>
            </span>

            {pilierIsCasClient && (
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-2xs text-ink-600 hover:text-ink-900" title="Pas de nom, pas de chiffres internes. Requis pour publier un cas client.">
                <input type="checkbox" checked={anonOk} onChange={e => setAnonOk(e.target.checked)} className="w-3.5 h-3.5 rounded border-ink-300 text-brand-500" />
                Anonymisé
              </label>
            )}

            <div className="ml-auto flex items-center gap-1.5 flex-wrap">
              <button onClick={improveText} disabled={improving || !text.trim()} className="btn-ghost text-xs" title="Resserre le texte en gardant votre voix">
                {improving ? 'Cadence relit…' : 'Améliorer'}
              </button>
              <button onClick={generateVisual} disabled={!text.trim()} className="btn-ghost text-xs" title="Visuel ou carrousel via Claude Design">
                Visuel
              </button>

              {versions.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setVersionsOpen(o => !o)}
                    className="btn-ghost text-xs inline-flex items-center gap-1.5"
                    title="Revenir à une version précédente"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v5h5M3.05 13A9 9 0 106 5.3L3 8"/></svg>
                    Versions
                    <span className="text-ink-400 tabular-nums">{versions.length}</span>
                  </button>
                  {versionsOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setVersionsOpen(false)} />
                      <div className="absolute bottom-full mb-1 right-0 z-40 card p-1 min-w-[300px] max-h-[60vh] overflow-y-auto shadow-pop animate-fade-in">
                        <div className="px-3 pt-2 pb-1 text-2xs uppercase tracking-wider font-semibold text-ink-400">Historique des versions</div>
                        {versions.map(v => (
                          <button
                            key={v.id}
                            onClick={() => revertToVersion(v)}
                            className="w-full text-left px-3 py-2 rounded-md hover:bg-ink-50 transition group/v"
                          >
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-sm text-ink-800 font-medium">{v.label}</span>
                              <span className="text-2xs text-ink-400 tabular-nums shrink-0">
                                {new Date(v.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-ink-500 line-clamp-2 leading-snug">{v.text.slice(0, 120)}</p>
                            <span className="mt-1 inline-block text-2xs text-brand-700 opacity-0 group-hover/v:opacity-100 transition">Revenir à cette version →</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              <span className="w-px h-5 bg-ink-200 mx-0.5 hidden sm:inline-block" aria-hidden />

              <button onClick={() => handleSave(false)} disabled={saveLoading || !text.trim()} className="btn-secondary text-xs">
                {saveLoading ? '…' : (initial?.id ? 'Sauvegarder' : 'Enregistrer')}
              </button>
              <button onClick={() => { setPublishMode('schedule'); setPublishOpen(true); }} disabled={!text.trim()} className="btn-secondary text-xs" title="Choisir une date et programmer">
                Programmer
              </button>
              <button onClick={() => { setPublishMode('publish'); setPublishOpen(true); }} disabled={!canPublish} className="btn-primary text-xs" title={canPublish ? 'Publier sur LinkedIn (validation requise)' : pilierIsCasClient && !anonOk ? 'Cochez « Anonymisé » pour publier ce cas client' : criticalLint.length ? 'Corrigez les alertes avant de publier' : 'Publier'}>
                Publier
              </button>
            </div>
          </div>
        </footer>
      )}

      <PreviewDrawer open={previewOpen} onClose={() => setPreviewOpen(false)} title={carouselMode ? 'Studio carrousel' : 'Aperçu & visuel'}>
        {carouselMode ? (
          <>
            <CarouselStudio text={text} onClose={() => setCarouselMode(false)} />
            <div className="mt-6 pt-6 border-t border-ink-100">
              <p className="text-2xs uppercase tracking-wider font-semibold text-ink-400 mb-3">Aperçu post</p>
              <LinkedInPreview text={text} image={imageUrl || undefined} />
            </div>
          </>
        ) : suggestedVisualFormat ? (
          <>
            <VisualGenerator
              defaultPrompt=""
              notionPageId={initial?.id}
              pilier={pilier}
              text={text}
              suggestedFormat={suggestedVisualFormat}
              autoBrief={autoVisualBrief}
              autoGenerateKey={autoGenerateKey}
              onPick={setImageUrl}
            />
            <div className="mt-6 pt-6 border-t border-ink-100">
              <p className="text-2xs uppercase tracking-wider font-semibold text-ink-400 mb-3">Aperçu post</p>
              <LinkedInPreview text={text} image={imageUrl || undefined} />
            </div>
          </>
        ) : (
          <>
            <LinkedInPreview text={text} image={imageUrl || undefined} />
            <div className="mt-6 pt-6 border-t border-ink-100">
              <p className="text-2xs uppercase tracking-wider font-semibold text-ink-400 mb-3">Visuel d&apos;accompagnement</p>
              <VisualGenerator
                defaultPrompt=""
                notionPageId={initial?.id}
                pilier={pilier}
                text={text}
                onPick={setImageUrl}
              />
            </div>
          </>
        )}
      </PreviewDrawer>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} commands={commands} />
      <PublishModal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        text={text}
        image={imageUrl}
        notionPageId={initial?.id}
        initialMode={publishMode}
        defaultDate={date}
        defaultTime={time}
        onSchedule={async (d, t) => {
          setDate(d); setTime(t);
          if (!text.trim()) return false;
          setSaveLoading(true); setSaveMsg(null);
          try {
            const body: any = {
              title: title || text.split('\n')[0].slice(0, 80),
              content: text, pilier, validated: false,
              scheduled_date: d, scheduled_time: t, status: 'scheduled',
            };
            const r = await fetch(initial?.id ? `/api/notion/post/${initial.id}` : '/api/notion/posts', {
              method: initial?.id ? 'PATCH' : 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            const dd = await r.json();
            if (!r.ok) throw new Error(dd.error || `HTTP ${r.status}`);
            return true;
          } catch (e: any) {
            setSaveMsg('Erreur : ' + e.message);
            return false;
          } finally { setSaveLoading(false); }
        }}
      />
    </div>
  );
}

function SuggestionBand({
  pilier, brief, hook, why, id, filterSource, onAccept, generating
}: {
  pilier?: string | null;
  brief?: string; hook?: string | null; why?: string | null;
  id?: string | null; filterSource?: string | null;
  onAccept: () => void; generating: boolean;
}) {
  return (
    <section className="border-l-2 border-brand-300 pl-4 animate-fade-in">
      <div className="text-2xs uppercase tracking-wider font-semibold text-brand-700">Cadence vous propose</div>
      <h2 className="mt-1 text-lg font-semibold text-ink-900 leading-snug">{brief}</h2>
      {hook && <p className="mt-1.5 text-sm text-ink-600 italic">« {hook} »</p>}
      {why && (() => {
        const segs = Array.from(new Set(why.split(/\s*·\s*/).map(s => s.trim()).filter(Boolean)));
        return <p className="mt-2 text-2xs text-ink-500">{segs.join(' · ')}</p>;
      })()}
      <div className="mt-3 flex items-center gap-3 text-xs">
        <button onClick={onAccept} disabled={generating} className="btn-primary text-xs">
          {generating ? 'Cadence rédige…' : 'Écrire ce post →'}
        </button>
        {id && <a href={'/posts/new?skip=' + id + (filterSource ? '&source=' + filterSource : '')} className="text-ink-500 hover:text-ink-900 transition">Autre idée</a>}
      </div>
    </section>
  );
}

function StartHint({
  pilier, brief, onBrief, onGenerate, generating, error, recyclables,
}: {
  pilier: string; brief: string; onBrief: (s: string) => void;
  onGenerate: () => void; generating: boolean; error: string | null; recyclables: Recyclable[];
}) {
  return (
    <section className="animate-fade-in space-y-8">
      <div>
        <p className="text-2xs uppercase tracking-wider font-semibold text-ink-400">Nouveau post · {pilier.split('·')[1]?.trim() || pilier}</p>
        <h1 className="mt-3 text-2xl font-semibold text-ink-900 tracking-tight font-editorial">De quoi voulez-vous parler aujourd&apos;hui ?</h1>
        <p className="mt-3 text-sm text-ink-500 leading-relaxed max-w-xl">
          Posez un brief court : Cadence en écrit trois versions dans votre voix. Ou commencez à écrire directement dans la zone plus bas.
        </p>
      </div>

      <div>
        <textarea
          value={brief} onChange={e => onBrief(e.target.value)}
          rows={3}
          placeholder={`Ex : un client a divisé par 2 son DSO en passant à Heelio. Raconter le déclic et le résultat, sans donner le nom.`}
          className="cadence-brief"
          autoFocus
        />
        <div className="mt-3 flex items-center gap-3 text-xs flex-wrap">
          <button onClick={onGenerate} disabled={generating || !brief.trim()} className="btn-primary text-xs">
            {generating ? 'Cadence rédige…' : 'Rédiger avec Cadence'}
          </button>
        </div>
        {error && <p className="mt-3 text-xs text-danger-700">Erreur : {error}</p>}
      </div>

      {recyclables.length > 0 && (
        <div className="pt-4 border-t border-ink-100">
          <p className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-3">À recycler</p>
          <ul className="space-y-1.5">
            {recyclables.slice(0, 3).map(r => (
              <li key={r.id}>
                <a href={'/posts/new?from=' + r.id + '&recycle=1'} className="group flex items-start gap-3 py-1.5 hover:text-ink-900 transition">
                  <span className="w-1.5 h-1.5 rounded-full bg-ink-300 mt-2 shrink-0 group-hover:bg-ink-700" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-700 truncate group-hover:text-ink-900">{r.title}</p>
                    {r.published_at && (() => {
                      const days = Math.floor((Date.now() - new Date(r.published_at).getTime()) / 86_400_000);
                      return days > 0 ? <p className="text-2xs text-ink-400">Publié il y a {days} jours</p> : null;
                    })()}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="pt-4 border-t border-ink-100 text-2xs text-ink-500 leading-relaxed">
        Raccourcis : <kbd className="px-1 rounded bg-ink-100 font-mono">⌘K</kbd> commandes · <kbd className="px-1 rounded bg-ink-100 font-mono">⌘P</kbd> aperçu · <kbd className="px-1 rounded bg-ink-100 font-mono">/</kbd> commandes éditeur · <kbd className="px-1 rounded bg-ink-100 font-mono">@</kbd> mentions
      </div>
    </section>
  );
}

// V15.17 — État de génération vivant pendant l'attente.
function GenerationStatus() {
  const [step, setStep] = useState(0);
  const phases = [
    'Cadence lit votre brief…',
    'Cadence cherche dans votre voix…',
    'Cadence pose la première phrase…',
    'Cadence affine les variantes…',
    'Cadence relit avant de vous montrer…',
  ];
  useEffect(() => {
    const interval = setInterval(() => {
      setStep(s => Math.min(s + 1, phases.length - 1));
    }, 4500);
    return () => clearInterval(interval);
  }, [phases.length]);
  return (
    <div className="mt-6 flex items-center gap-2.5 animate-fade-in" aria-live="polite">
      <span className="inline-block w-[2px] h-3.5 bg-brand-500 animate-caret-blink" aria-hidden />
      <span className="text-xs text-ink-500 italic font-editorial">{phases[step]}</span>
    </div>
  );
}
