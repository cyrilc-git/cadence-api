'use client';

// V8.9.1 §B — /posts/new refondu en éditeur silencieux.
// Inspirations : Notion page / Granola / Substack editor.
// Principe : la page est un grand espace blanc, le texte est le héros.
// — Aucune sticky bar, aucun panneau visible.
// — Top : retour + pilier discret + ⌘K + Aperçu (icône seule).
// — Centre : CadenceEditor max-w-2xl, prose serif éditoriale.
// — Bas : char count + Sauvegarder primaire. Reste derrière "⋯" popover.
// — Preview LinkedIn fermé par défaut, ⌘P ouvre drawer.

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import LinkedInPreview from '@/components/LinkedInPreview';
import PublishModal from '@/components/PublishModal';
import VisualGenerator from '@/components/VisualGenerator';
import CadenceEditor, { useEditorMetrics } from '@/components/CadenceEditor';
import CommandPalette, { Command } from '@/components/CommandPalette';
import PreviewDrawer from '@/components/PreviewDrawer';
import { SLASH_COMMANDS } from '@/components/SlashMenu';
// V25.5 — Anti-patterns centralisés : on lit directement la table de
// vérité dans lib/brand-config plutôt que de maintenir un double inline
// qui dérive (les 9 patterns V25.1 anti-slop n'étaient pas reflétés ici).
import { checkAntiPatterns, autoFixAntiPatterns } from '@/lib/brand-config';

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
  const [pilier, setPilier] = useState(initial?.pilier || PILIERS[2]);
  const [brief, setBrief] = useState(prefillBrief || '');
  const [text, setText] = useState(initial?.content || '');
  const [title, setTitle] = useState(initial?.title || '');
  const [date, setDate] = useState(initial?.date || new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('07:30');
  const [anonOk, setAnonOk] = useState(false);
  const [validated, setValidated] = useState(false);
  const [proposals, setProposals] = useState<string[]>([]);
  const [proposalIdx, setProposalIdx] = useState(0);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  // V18.4 — Modulation de voix pour la génération.
  const [voiceMode, setVoiceMode] = useState<'ma_voix' | 'pedagogue' | 'direct' | 'narratif' | 'terrain' | 'opinion' | 'hors_style'>('ma_voix');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // V12.8 §2 — format suggéré par memory-check, pré-sélectionné dans VisualGenerator
  const [suggestedVisualFormat, setSuggestedVisualFormat] = useState<string | null>(null);
  const [pilierOpen, setPilierOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const { wordCount, charCount, readingMin, hookLen, hookTone, rhythmTone, paragraphCount } = useEditorMetrics(text);
  const pilierIsCasClient = pilier?.includes('Cas client') || pilier?.includes('Cas dirigeant');
  const lint = useMemo(() => checkAntiPatterns(text), [text]);
  const criticalLint = lint.filter(h => h.severity === 'critical');

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
    setGenLoading(true); setGenError(null); setProposals([]);
    try {
      const r = await fetch('/api/generate-post', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pilier, brief: b, voiceMode })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      const list = data.proposals || [];
      setProposals(list);
      if (list.length) { setText(list[0]); setProposalIdx(0); }
    } catch (e: any) { setGenError(e.message); }
    finally { setGenLoading(false); }
  }, [brief, pilier, voiceMode]);

  const handleSave = useCallback(async (programmer: boolean) => {
    if (!text.trim()) return;
    if (pilierIsCasClient && !anonOk) {
      setSaveMsg('Anonymisation OK requise pour ce pilier.');
      setTimeout(() => setSaveMsg(null), 3000);
      return;
    }
    setSaveLoading(true); setSaveMsg(null);
    try {
      const body: any = {
        title: title || text.split('\n')[0].slice(0, 80),
        content: text,
        pilier,
        validated,
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
  }, [initial?.id, title, text, pilier, date, time, anonOk, validated]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(o => !o); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') { e.preventDefault(); setPreviewOpen(o => !o); }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSave(false); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSave]);

  const commands: Command[] = [
    { id: 'preview', label: previewOpen ? "Fermer l'aperçu LinkedIn" : "Ouvrir l'aperçu LinkedIn", hint: 'Drawer coulissant', group: 'Vue', shortcut: '⌘P', perform: () => setPreviewOpen(o => !o) },
    { id: 'pilier', label: 'Changer de pilier', group: 'Vue', perform: () => setPilierOpen(true) },
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
  const hasText = text.trim().length > 0;
  // V14.1 — Focus mode automatique : au-delà de 240 caractères, l'utilisateur
  // est clairement dans une phase d'écriture sérieuse. On atténue le chrome
  // (header pilier + boutons header) pour laisser le texte respirer comme
  // sur iA Writer / Lex / Bear. Le chrome réapparaît au hover (groupe).
  const deepWriting = hasText && text.length > 240;
  // V15.8 — Reading mode : sidebar + footer s'atténuent à 600 chars (flow
  // confirmé). On pose body.deep-writing pour que les sélecteurs CSS
  // globaux (cf. globals.css) attrapent aside et footer périphériques.
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
          <button onClick={() => setCmdOpen(true)} className="w-10 h-10 sm:w-8 sm:h-8 inline-flex items-center justify-center text-ink-400 hover:text-ink-900 rounded-md hover:bg-ink-50 transition" title="Commandes" aria-label="Commandes">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.3-4.3"/></svg>
          </button>
          <button onClick={() => setPreviewOpen(o => !o)} className={`w-10 h-10 sm:w-8 sm:h-8 inline-flex items-center justify-center rounded-md transition ${previewOpen ? 'text-brand-700 bg-brand-50' : 'text-ink-400 hover:text-ink-900 hover:bg-ink-50'}`} title="Aperçu LinkedIn" aria-label="Aperçu LinkedIn">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </header>

      <div className="flex-1 w-full max-w-2xl mx-auto px-5 lg:px-8 py-10 lg:py-16">
        {!hasText && prefillBrief && (
          <SuggestionBand
            source={suggestSource} pilier={suggestPilier}
            brief={prefillBrief} hook={prefillHook}
            why={suggestWhy}
            id={suggestId} filterSource={filterSource}
            onAccept={() => handleGenerate(prefillBrief)}
            generating={genLoading}
          />
        )}

        {!hasText && !prefillBrief && (
          <StartHint
            pilier={pilier}
            brief={brief}
            onBrief={setBrief}
            onGenerate={() => handleGenerate()}
            generating={genLoading}
            error={genError}
            recyclables={recyclables}
            voiceMode={voiceMode}
            onVoiceMode={setVoiceMode}
            // V25.3 — Quand l'utilisateur choisit un hook, on l'insère
            // tel quel comme ouverture du post. L'éditeur prend le relais.
            onPickHook={(hook) => setText(hook + '\n\n')}
          />
        )}

        {(hasText || !prefillBrief) && (
          <div className={hasText ? 'mt-4' : 'mt-10'}>
            <CadenceEditor
              textareaRef={taRef}
              value={text}
              onChange={setText}
              draftId={initial?.id || 'new-post'}
              rows={hasText ? 22 : 8}
              // V15.18 — Placeholder différent selon contexte :
              // - StartHint visible (pas de brief, pas de texte) : placeholder
              //   minimaliste pour ne pas dupliquer l'info "Ou commencez à
              //   écrire dans la zone plus bas" qui est déjà au-dessus.
              // - Brief pré-rempli depuis URL (prefillBrief, mais pas encore
              //   de texte) : invitation classique.
              placeholder={hasText ? '' : (prefillBrief ? 'Commencez à écrire ici. Tapez / pour les commandes.' : '')}
              bare
              brief={brief || prefillBrief}
              pilier={pilier}
              onResult={r => { setProposals([r]); setProposalIdx(0); }}
              onVisualSuggested={(format) => {
                setSuggestedVisualFormat(format);
                setPreviewOpen(true);
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
            {/* V25.6 — "Calmer le texte" : corrige les patterns lexicaux
                automatisables (em-dash, smart quotes, ellipsis, emojis,
                espaces). Ne touche pas aux patterns sémantiques. */}
            <button
              type="button"
              onClick={() => {
                const { text: fixed, changes } = autoFixAntiPatterns(text);
                if (changes.length > 0 && fixed !== text) {
                  setText(fixed);
                }
              }}
              className="ml-auto text-2xs text-brand-700 hover:text-brand-900 transition underline decoration-dotted underline-offset-2"
              title="Corrige em-dash, smart quotes, ellipsis, emojis, espaces"
            >
              Calmer le texte
            </button>
          </div>
        )}

        {genLoading && !hasText && (
          <GenerationStatus />
        )}
        {genError && (
          <div className="mt-4 text-xs text-danger-700">Erreur : {genError}</div>
        )}
      </div>

      {hasText && (
        <footer className="sticky bottom-0 z-20 border-t border-ink-100 bg-white/90 backdrop-blur">
          <div className="max-w-2xl mx-auto px-5 lg:px-8 h-14 sm:h-12 flex items-center gap-3 text-xs text-ink-500 pb-[env(safe-area-inset-bottom)]">
            {/* V15.4 — Footer compagnon d'écriture. Signaux éditoriaux
                (hook, rythme, lecture) avant les compteurs techniques. */}
            <span
              className={`hidden sm:inline ${
                hookTone === 'sweet' ? 'text-emerald-700' :
                hookTone === 'too-long' ? 'text-amber-700' :
                'text-ink-500'
              }`}
              title={hookTone === 'sweet' ? 'Cible idéale 60-130 chars' : hookTone === 'too-long' ? 'LinkedIn coupe à 210 chars en mobile' : 'Un hook plus court accroche mieux'}
            >
              {hookTone === 'sweet' ? 'Hook serré' :
               hookTone === 'long' ? 'Hook long' :
               hookTone === 'too-long' ? 'Hook trop long' :
               'Hook court'}
              <span className="tabular-nums text-ink-400 ml-1">{hookLen}</span>
            </span>
            <span className="hidden md:inline text-ink-300" aria-hidden>·</span>
            <span
              className={`hidden md:inline ${rhythmTone === 'dense' ? 'text-amber-700' : 'text-ink-500'}`}
              title={rhythmTone === 'dense' ? 'Un paragraphe dépasse 400 caractères' : rhythmTone === 'compact' ? 'Paragraphes denses' : 'Texte aéré'}
            >
              {rhythmTone === 'dense' ? 'Pavé dense' :
               rhythmTone === 'compact' ? 'Compact' :
               'Aéré'}
              {paragraphCount > 1 && <span className="tabular-nums text-ink-400 ml-1">{paragraphCount}¶</span>}
            </span>
            <span className="hidden lg:inline text-ink-300" aria-hidden>·</span>
            <span className="tabular-nums hidden lg:inline text-ink-500">{wordCount} mots · {readingMin} min</span>
            <span className={`tabular-nums ml-auto sm:ml-0 ${charCount > 1300 ? 'text-danger-500 font-semibold' : 'text-ink-400'}`}>{charCount}/1300</span>
            <div className="ml-auto flex items-center gap-1.5">
              <button onClick={() => handleSave(false)} disabled={saveLoading || !text.trim()} className="btn-primary text-xs">
                {saveLoading ? '…' : (initial?.id ? 'Sauvegarder' : 'Enregistrer le brouillon')}
              </button>
              <div className="relative">
                <button onClick={() => setMoreOpen(o => !o)} className="w-10 h-10 sm:w-8 sm:h-8 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-50 transition" title="Plus d'actions" aria-label="Plus d'actions">⋯</button>
                {moreOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setMoreOpen(false)} />
                    <div className="absolute bottom-full mb-1 right-0 z-40 card p-1 min-w-[260px] shadow-pop animate-fade-in">
                      <button onClick={() => { setMoreOpen(false); handleSave(true); }} disabled={saveLoading || !text.trim()} className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-ink-50 disabled:opacity-40 disabled:cursor-not-allowed">
                        Programmer le {new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} à {time.slice(0, 5)}
                      </button>
                      <div className="px-3 pt-1.5 pb-0.5 text-2xs uppercase tracking-wider font-semibold text-ink-400">Date & heure</div>
                      <div className="grid grid-cols-2 gap-1.5 px-2 py-1">
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input text-xs h-8" />
                        <input type="time" value={time} onChange={e => setTime(e.target.value)} className="input text-xs h-8" />
                      </div>
                      <label className="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm hover:bg-ink-50 rounded-md">
                        <input type="checkbox" checked={validated} onChange={e => setValidated(e.target.checked)} className="w-3.5 h-3.5 rounded border-ink-300 text-brand-500" />
                        <span>Validé pour cron auto-publi</span>
                      </label>
                      {pilierIsCasClient && (
                        <label className="flex items-start gap-2 px-3 py-2 cursor-pointer text-xs hover:bg-warn-50/50 rounded-md border-t border-ink-100">
                          <input type="checkbox" checked={anonOk} onChange={e => setAnonOk(e.target.checked)} className="mt-0.5 w-3.5 h-3.5 rounded border-ink-300 text-brand-500" />
                          <span><strong className="block text-ink-900">Anonymisation OK</strong>Pas de nom, pas de chiffres internes</span>
                        </label>
                      )}
                      <div className="border-t border-ink-100 mt-1 pt-1">
                        <button onClick={() => { setMoreOpen(false); setPublishOpen(true); }} disabled={!canPublish} className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-brand-50 text-brand-700 disabled:opacity-40 disabled:cursor-not-allowed">
                          Publier maintenant…
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </footer>
      )}

      <PreviewDrawer open={previewOpen} onClose={() => setPreviewOpen(false)} title="Aperçu & visuel">
        {/* V13.3 §3 — quand la drawer est ouverte via "Créer le visuel"
            (suggestedVisualFormat défini), on met le VisualGenerator en
            premier pour que l'utilisateur tombe sur ce qu'il a demandé. */}
        {suggestedVisualFormat ? (
          <>
            <VisualGenerator
              defaultPrompt={text ? `Visuel d'accompagnement : ${text.slice(0, 200)} (Style Heelio)` : ''}
              notionPageId={initial?.id}
              pilier={pilier}
              text={text}
              suggestedFormat={suggestedVisualFormat}
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
                defaultPrompt={text ? `Visuel d'accompagnement : ${text.slice(0, 200)} (Style Heelio)` : ''}
                notionPageId={initial?.id}
                pilier={pilier}
                text={text}
                suggestedFormat={suggestedVisualFormat}
                onPick={setImageUrl}
              />
            </div>
          </>
        )}
      </PreviewDrawer>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} commands={commands} />
      <PublishModal open={publishOpen} onClose={() => setPublishOpen(false)} text={text} notionPageId={initial?.id} />
    </div>
  );
}

function SuggestionBand({
  source, pilier, brief, hook, why, id, filterSource, onAccept, generating
}: {
  source?: string | null; pilier?: string | null;
  brief?: string; hook?: string; why?: string | null;
  id?: string | null; filterSource?: string | null;
  onAccept: () => void; generating: boolean;
}) {
  return (
    <section className="border-l-2 border-brand-300 pl-4 animate-fade-in">
      <div className="text-2xs uppercase tracking-wider font-semibold text-brand-700">Cadence vous propose</div>
      <h2 className="mt-1 text-lg font-semibold text-ink-900 leading-snug">{brief}</h2>
      {hook && <p className="mt-1.5 text-sm text-ink-600 italic">« {hook} »</p>}
      {why && <p className="mt-2 text-2xs text-ink-500">{why}</p>}
      <div className="mt-3 flex items-center gap-3 text-xs">
        <button onClick={onAccept} disabled={generating} className="btn-primary text-xs">
          {generating ? 'Cadence rédige…' : 'Écrire ce post →'}
        </button>
        {id && <a href={'/posts/new?skip=' + id + (filterSource ? '&source=' + filterSource : '')} className="text-ink-500 hover:text-ink-900 transition">Autre idée</a>}
      </div>
    </section>
  );
}

type VoiceMode = 'ma_voix' | 'pedagogue' | 'direct' | 'narratif' | 'terrain' | 'opinion' | 'hors_style';
const VOICE_MODE_LABELS: { key: VoiceMode; label: string; hint: string }[] = [
  { key: 'ma_voix',    label: 'Ma voix',       hint: 'respecte votre signature' },
  { key: 'pedagogue',  label: 'Pédagogue',     hint: 'plus enseignant, plus structuré' },
  { key: 'direct',     label: 'Direct',        hint: 'phrases courtes, hooks secs' },
  { key: 'narratif',   label: 'Narratif',      hint: 'scène, dialogue, tension douce' },
  { key: 'terrain',    label: 'Terrain',       hint: 'montants, délais, arbitrages' },
  { key: 'opinion',    label: 'Opinion',       hint: 'hot take mesuré, position claire' },
  { key: 'hors_style', label: 'Sortir du style', hint: 'explorer une voix inhabituelle' },
];

// V25.3 — 6 angles de hooks, libellés FR pour le picker
const HOOK_ANGLE_FR: { key: string; label: string }[] = [
  { key: 'number_led',     label: 'Chiffre' },
  { key: 'contrarian',     label: 'Contre-courant' },
  { key: 'transformation', label: 'Bascule' },
  { key: 'authority',      label: 'Référence' },
  { key: 'admission',      label: 'Aveu' },
  { key: 'future_shock',   label: 'Présent vs futur' },
];

function StartHint({
  pilier, brief, onBrief, onGenerate, generating, error, recyclables,
  voiceMode, onVoiceMode, onPickHook,
}: {
  pilier: string; brief: string; onBrief: (s: string) => void;
  onGenerate: () => void; generating: boolean; error: string | null; recyclables: Recyclable[];
  voiceMode: VoiceMode; onVoiceMode: (m: VoiceMode) => void;
  onPickHook: (hook: string) => void;
}) {
  // V25.3 — État du hook generator (replié par défaut)
  const [hookLoading, setHookLoading] = useState(false);
  const [hookError, setHookError] = useState<string | null>(null);
  const [hooks, setHooks] = useState<Array<{ angle: string; line1: string; line2: string }>>([]);

  async function fetchHooks() {
    if (!brief.trim() || brief.trim().length < 4) {
      setHookError('Posez d\'abord un sujet court dans le brief.');
      return;
    }
    setHookLoading(true); setHookError(null); setHooks([]);
    try {
      const r = await fetch('/api/hooks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: brief.trim(), pilier, voiceMode }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setHooks(d.hooks || []);
    } catch (e: any) {
      setHookError(e.message);
    } finally {
      setHookLoading(false);
    }
  }
  // V12.9 §2 — Onboarding écran "vide" plus habité.
  // Trois chemins clairs : 1) brief court → 3 propositions, 2) recycler un
  // ancien, 3) ouvrir le radar pour partir d'une idée fraîche.
  return (
    <section className="animate-fade-in space-y-8">
      <div>
        <p className="text-2xs uppercase tracking-wider font-semibold text-ink-400">Nouveau post · {pilier.split('·')[1]?.trim() || pilier}</p>
        <h1 className="mt-3 text-2xl font-semibold text-ink-900 tracking-tight font-editorial">De quoi voulez-vous parler aujourd&apos;hui ?</h1>
        <p className="mt-3 text-sm text-ink-500 leading-relaxed max-w-xl">
          Posez un brief court, Cadence en fera trois versions. Ou commencez à écrire directement dans la zone plus bas, ou reprenez un sujet du Radar.
        </p>
      </div>

      <div>
        <textarea
          value={brief} onChange={e => onBrief(e.target.value)}
          rows={3}
          placeholder={`Ex : un client a divisé par 2 son DSO en passant à Heelio. Veut raconter le déclic et le résultat sans donner le nom.`}
          className="cadence-brief"
          autoFocus
        />
        <div className="mt-3 flex items-center gap-3 text-xs flex-wrap">
          <button onClick={onGenerate} disabled={generating || !brief.trim()} className="btn-primary text-xs">
            {generating ? 'Cadence rédige…' : 'Rédiger trois versions'}
          </button>
          <span className="text-ink-400">·</span>
          <Link href="/suggestions" className="text-ink-500 hover:text-ink-900 transition">Voir le Radar</Link>
          {recyclables.length > 0 && (
            <>
              <span className="text-ink-400">·</span>
              <a href={'/posts/new?from=' + recyclables[0].id + '&recycle=1'} className="text-ink-500 hover:text-ink-900 transition">Recycler un ancien</a>
            </>
          )}
          <span className="text-ink-400">·</span>
          <Link href="/cerveau" className="text-ink-500 hover:text-ink-900 transition">Ouvrir la mémoire</Link>
        </div>
        {/* V18.4 — Selector de voix : discret, dépliable au hover/focus.
            Par défaut "Ma voix". Si l'utilisateur veut explorer ailleurs,
            il clique. Ne s'affiche que quand l'utilisateur s'est posé sur
            le brief (focus-within sur le bloc parent). */}
        <details className="mt-3 group/voice text-2xs">
          <summary className="select-none cursor-pointer inline-flex items-center gap-1.5 text-ink-500 hover:text-ink-900 transition">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500" aria-hidden />
            <span>Voix : <span className="text-ink-900 font-medium">{VOICE_MODE_LABELS.find(m => m.key === voiceMode)?.label || 'Ma voix'}</span></span>
            <span className="text-ink-300 group-open/voice:hidden">change</span>
            <span className="text-ink-300 hidden group-open/voice:inline">replier</span>
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {VOICE_MODE_LABELS.map(m => (
              <button
                key={m.key}
                onClick={() => onVoiceMode(m.key)}
                title={m.hint}
                className={`text-2xs px-2.5 py-1 rounded-full border transition ${voiceMode === m.key ? 'bg-brand-50 text-brand-700 border-brand-300 font-medium' : 'bg-white text-ink-600 border-ink-200 hover:bg-ink-50 hover:text-ink-900'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-2xs text-ink-400 italic">
            {VOICE_MODE_LABELS.find(m => m.key === voiceMode)?.hint}
          </p>
        </details>

        {/* V25.3 — Hook generator : à partir du brief court, Cadence propose
            6 hooks selon 6 angles (chiffre, contre-courant, bascule, référence,
            aveu, présent vs futur). Un clic sur un hook l'insère comme
            ouverture du post et fait disparaître le StartHint. */}
        <details className="mt-2 group/hooks text-2xs">
          <summary className="select-none cursor-pointer inline-flex items-center gap-1.5 text-ink-500 hover:text-ink-900 transition">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden />
            <span>Cadence vous propose 6 hooks</span>
            <span className="text-ink-300 group-open/hooks:hidden">ouvrir</span>
            <span className="text-ink-300 hidden group-open/hooks:inline">replier</span>
          </summary>
          <div className="mt-3 space-y-2">
            {hooks.length === 0 && !hookLoading && (
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={fetchHooks}
                  disabled={!brief.trim() || brief.trim().length < 4}
                  className="text-2xs text-brand-700 hover:text-brand-900 transition underline decoration-dotted underline-offset-2 disabled:opacity-40 disabled:no-underline"
                >
                  Générer 6 hooks à partir de ce brief
                </button>
                {hookError && <span className="text-2xs text-danger-700">{hookError}</span>}
              </div>
            )}
            {hookLoading && (
              <p className="text-2xs text-ink-400 italic">Cadence cherche six angles…</p>
            )}
            {hooks.length > 0 && (
              <ul className="space-y-2">
                {hooks.map((h, i) => {
                  const angleLabel = HOOK_ANGLE_FR.find(a => a.key === h.angle)?.label || h.angle;
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => onPickHook(`${h.line1}\n${h.line2}`)}
                        className="w-full text-left border border-ink-100 hover:border-ink-300 hover:bg-ink-50/50 rounded-md p-3 transition group/h"
                      >
                        <p className="text-2xs uppercase tracking-wider font-semibold text-ink-400 group-hover/h:text-ink-700">{angleLabel}</p>
                        <p className="mt-1 text-sm text-ink-800 leading-snug font-editorial">{h.line1}</p>
                        <p className="text-sm text-ink-600 leading-snug font-editorial">{h.line2}</p>
                      </button>
                    </li>
                  );
                })}
                <li>
                  <button
                    type="button"
                    onClick={fetchHooks}
                    disabled={hookLoading}
                    className="text-2xs text-ink-500 hover:text-ink-900 transition underline decoration-dotted underline-offset-2"
                  >
                    Six autres angles
                  </button>
                </li>
              </ul>
            )}
          </div>
        </details>

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
        Raccourcis : <kbd className="px-1 rounded bg-ink-100 font-mono">⌘K</kbd> commandes globales · <kbd className="px-1 rounded bg-ink-100 font-mono">⌘P</kbd> aperçu LinkedIn · <kbd className="px-1 rounded bg-ink-100 font-mono">/</kbd> commandes éditeur · <kbd className="px-1 rounded bg-ink-100 font-mono">@</kbd> mentions
      </div>
    </section>
  );
}

// V15.17 — État de génération vivant : Cadence raconte ce qu'elle fait
// pendant les 15-30 secondes d'attente. Mieux que "Cadence rédige..." figé.
// Cycle de phrases qui change toutes les ~4 secondes.
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

// V25.5 — analyzeAntiPatterns inline supprimé. La source de vérité est
// lib/brand-config.ts ANTI_PATTERNS, importée plus haut via checkAntiPatterns().
// Les 9 patterns V25.1 anti-slop sont maintenant détectés ici aussi.
