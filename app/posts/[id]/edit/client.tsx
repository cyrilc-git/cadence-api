'use client';

// V8.4 — ÉDITEUR PREMIUM AI-NATIVE
// Layout single-column max-w-3xl centré. Focus par défaut. Preview en drawer ⌘P. Slash commands. CommandPalette ⌘K.
// Inspirations : Linear / Notion / Claude / Granola.

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import LinkedInPreview from '@/components/LinkedInPreview';
import PublishModal from '@/components/PublishModal';
import VisualGenerator from '@/components/VisualGenerator';
import CadenceEditor, { useEditorMetrics } from '@/components/CadenceEditor';
import CommandPalette, { Command } from '@/components/CommandPalette';
import PreviewDrawer from '@/components/PreviewDrawer';
import { SLASH_COMMANDS } from '@/components/SlashMenu';

type Status = 'draft' | 'needs_validation' | 'scheduled' | 'published' | 'late';

function deriveStatus(summary: any, validated: boolean): Status {
  if (summary.published_at) return 'published';
  if (!summary.scheduled_at) return 'draft';
  if (new Date(summary.scheduled_at) < new Date()) return 'late';
  return validated ? 'scheduled' : 'needs_validation';
}

const STATUS_META: Record<Status, { label: string; cls: string; dot: string }> = {
  draft:            { label: 'Brouillon',      cls: 'chip-neutral', dot: 'bg-ink-400' },
  needs_validation: { label: 'À valider',      cls: 'chip-warn',    dot: 'bg-warn-500' },
  scheduled:        { label: 'Programmé',      cls: 'chip-brand',   dot: 'bg-brand-500' },
  published:        { label: 'Publié',         cls: 'chip-success', dot: 'bg-success-500' },
  late:             { label: 'En retard',      cls: 'chip-danger',  dot: 'bg-danger-500' },
};

function formatDateTime(iso?: string | null): string {
  if (!iso) return 'date à définir';
  try { return new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

function formatRelative(t: number): string {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 5) return "à l'instant";
  if (s < 60) return `il y a ${s} sec`;
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  return `il y a ${h} h`;
}

export default function EditClient({ initial, validated: initialValidated }: { initial: { summary: any; content: string }; validated: boolean }) {
  const { summary } = initial;
  const [text, setText] = useState(initial.content);
  const [versions, setVersions] = useState<string[]>([initial.content]);
  const [validated, setValidated] = useState(initialValidated);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [chat, setChat] = useState<{ role: string; content: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeDialog, setRemoveDialog] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [compareIndex, setCompareIndex] = useState<number | null>(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const lastSavedTextRef = useRef(initial.content);
  const lastSavedValidatedRef = useRef(initialValidated);
  const autosaveTimer = useRef<number | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  const status = deriveStatus(summary, validated);
  const sMeta = STATUS_META[status];
  const isDirty = text !== lastSavedTextRef.current || validated !== lastSavedValidatedRef.current;

  // V8.6 — metrics via CadenceEditor's useEditorMetrics
  const { wordCount, charCount, readingMin } = useEditorMetrics(text);

  // Ticker for live "Sauvegardé il y a X sec"
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  // Save function
  const save = useCallback(async (silent = false) => {
    if (!isDirty && silent) return;
    setSaving(true); setSaveError(null);
    try {
      const r = await fetch('/api/notion/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: summary.id, title: summary.title, pilier: summary.pilier, date: summary.scheduled_at?.slice(0,10), time: summary.scheduled_time, content: text })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await fetch(`/api/notion/post/${summary.id}/validate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ validated }) });
      lastSavedTextRef.current = text;
      lastSavedValidatedRef.current = validated;
      setLastSavedAt(Date.now());
    } catch (e: any) {
      setSaveError(e.message);
    } finally { setSaving(false); }
  }, [isDirty, summary.id, summary.title, summary.pilier, summary.scheduled_at, summary.scheduled_time, text, validated]);

  // Autosave 3s
  useEffect(() => {
    if (!isDirty) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => save(true), 3000);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [text, validated, isDirty, save]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(false); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(o => !o); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') { e.preventDefault(); setPreviewOpen(o => !o); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  // Chat history load
  useEffect(() => {
    fetch(`/api/chat?notion_page_id=${summary.id}`).then(r => r.json()).then(d => setChat(d.messages || [])).catch(() => {});
  }, [summary.id]);

  async function runChat(prompt: string) {
    setChatLoading(true);
    setChat(c => [...c, { role: 'user', content: prompt }]);
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notion_page_id: summary.id, draft: text, instruction: prompt }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setChat(c => [...c, { role: 'assistant', content: d.rewrite }]);
      return d.rewrite as string;
    } catch (e: any) {
      setChat(c => [...c, { role: 'assistant', content: 'Erreur : ' + e.message }]);
      return null;
    } finally { setChatLoading(false); }
  }

  function applyRewrite(rewrite: string) { setVersions(v => [...v, rewrite]); setText(rewrite); }
  function revert() {
    if (versions.length < 2) return;
    const v = [...versions]; v.pop(); setVersions(v); setText(v[v.length - 1]);
  }
  function applyTransform(transform: (s: string) => string) {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    if (start === end) return;
    setText(text.slice(0, start) + transform(text.slice(start, end)) + text.slice(end));
  }

  async function removeFromCadence(alsoArchive: boolean) {
    setRemoveDialog(false);
    setRemoving(true);
    try {
      await fetch(`/api/cadence-drafts/${summary.id}`, { method: 'DELETE' }).catch(() => {});
      if (alsoArchive) {
        const r = await fetch(`/api/notion/post/${summary.id}/archive`, { method: 'POST' });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'archive failed');
      }
      window.location.href = '/posts';
    } catch (e: any) { alert('Erreur : ' + e.message); }
    finally { setRemoving(false); }
  }

  // Command palette commands
  const commands: Command[] = [
    { id: 'preview', label: previewOpen ? 'Fermer l\'aperçu LinkedIn' : 'Ouvrir l\'aperçu LinkedIn', hint: 'Panneau coulissant à droite', group: 'Vue', shortcut: '⌘P', perform: () => setPreviewOpen(o => !o) },
    { id: 'save', label: 'Sauvegarder', hint: 'Forcer une sauvegarde immédiate', group: 'Vue', shortcut: '⌘S', perform: () => save(false) },
    { id: 'versions', label: `Historique versions (${versions.length})`, hint: 'Voir et restaurer une version précédente', group: 'Vue', perform: () => setVersionsOpen(true) },
    { id: 'notion', label: 'Ouvrir dans Notion', group: 'Vue', perform: () => { window.open(summary.notion_url, '_blank'); } },
    ...SLASH_COMMANDS.map<Command>(c => ({
      id: 'slash-' + c.id,
      label: c.label,
      hint: c.hint,
      group: c.group || 'Améliorer',
      perform: async () => {
        const rewrite = await runChat(c.prompt);
        if (rewrite) applyRewrite(rewrite);
      }
    })),
    { id: 'remove', label: summary.cadence_source === 'cadence' ? 'Retirer de Cadence' : 'Retirer de la liste', hint: 'Conserver la page Notion', group: 'Avancé', perform: () => setRemoveDialog(true) },
    { id: 'publish', label: 'Publier maintenant', hint: 'Validation requise', group: 'Avancé', perform: () => setPublishOpen(true) },
  ];

  return (
    <div className="-mx-5 lg:-mx-10 -my-7 lg:-my-9 min-h-screen flex flex-col bg-white">
      {/* === HEADER MINIMAL (sticky, 56px) === */}
      <header className="sticky top-0 z-20 flex items-center gap-3 px-5 lg:px-8 h-14 border-b border-ink-100 bg-white/95 backdrop-blur pt-[env(safe-area-inset-top)]">
        <Link href="/posts" className="btn-ghost text-sm" aria-label="Retour">←</Link>
        <span className={`chip ${sMeta.cls} text-2xs whitespace-nowrap`}>
          <span className={`dot ${sMeta.dot}`} /> {sMeta.label}
        </span>
        <div className="hidden sm:block min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink-900 truncate">{summary.title || 'Sans titre'}</div>
          <div className="text-2xs text-ink-500 truncate">
            {summary.pilier ? summary.pilier.split('·')[1]?.trim() || summary.pilier : 'Pas de pilier'} · {formatDateTime(summary.scheduled_at)}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <SaveIndicator saving={saving} lastSavedAt={lastSavedAt} isDirty={isDirty} error={saveError} tick={tick} />
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

      {/* === EDITOR — single column max-w-3xl centered === */}
      <div ref={editorRef} className="flex-1 w-full max-w-3xl mx-auto px-5 lg:px-8 py-8 lg:py-12 relative">
        <CadenceEditor
          textareaRef={taRef}
          value={text}
          onChange={setText}
          draftId={summary.id}
          onResult={r => setVersions(v => [...v, r])}
          rows={20}
          placeholder="Commencez à écrire. Tapez / pour les commandes, @ pour mentionner."
          bare
        />
      </div>

      {/* === FOOTER STICKY DISCRET (bottom) === */}
      <footer className="sticky bottom-0 z-20 border-t border-ink-100 bg-white/95 backdrop-blur">
        <div className="max-w-3xl mx-auto px-5 lg:px-8 h-14 sm:h-12 flex items-center gap-3 text-xs text-ink-500 pb-[env(safe-area-inset-bottom)]">
          <span className="tabular-nums">{wordCount} mots · ~{readingMin} min</span>
          <span className={`tabular-nums ${charCount > 1300 ? 'text-danger-500 font-semibold' : ''}`}>{charCount}/1300</span>
          <span className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={validated} onChange={e => setValidated(e.target.checked)} className="w-3.5 h-3.5 rounded border-ink-300 text-brand-500" />
              <span>Validé pour cron</span>
            </label>
            <button onClick={() => setPublishOpen(true)} disabled={!text.trim() || isDirty} className="btn-primary text-xs" title={isDirty ? 'Sauvegardez avant' : undefined}>
              Publier…
            </button>
          </span>
        </div>
      </footer>

      {/* === PREVIEW DRAWER === */}
      <PreviewDrawer open={previewOpen} onClose={() => setPreviewOpen(false)}>
        <LinkedInPreview text={text} image={imageUrl || undefined} />
        <div className="mt-6">
          <VisualGenerator
            defaultPrompt={`Visuel d'accompagnement pour ce post LinkedIn :\n\n${text.slice(0, 300)}\n\n(Style : ${summary.pilier || 'Heelio'})`}
            notionPageId={summary.id}
            onPick={setImageUrl}
          />
        </div>
      </PreviewDrawer>

      {/* === COMMAND PALETTE === */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} commands={commands} />

      {/* === VERSIONS MODAL === */}
      {versionsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-ink-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setVersionsOpen(false)}>
          <div className="card max-w-3xl w-full p-6 max-h-[85vh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold text-ink-900">Historique des versions</h3>
                <p className="text-xs text-ink-500">Sélectionnez une version pour la comparer ou la restaurer.</p>
              </div>
              <button onClick={() => setVersionsOpen(false)} className="btn-ghost">×</button>
            </div>
            <div className="space-y-2">
              {versions.slice().reverse().map((v, idx) => {
                const realIdx = versions.length - 1 - idx;
                const isCurrent = realIdx === versions.length - 1;
                return (
                  <div key={realIdx} className={`card p-3 ${isCurrent ? 'border-brand-300 bg-brand-50/30' : 'border-ink-100'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`chip ${isCurrent ? 'chip-brand' : 'chip-neutral'} text-2xs`}>
                          {isCurrent ? '✦ Version actuelle' : `v${realIdx + 1}`}
                        </span>
                        <span className="text-2xs text-ink-500">{v.length} caractères</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {!isCurrent && (
                          <>
                            <button onClick={() => setCompareIndex(compareIndex === realIdx ? null : realIdx)} className="btn-ghost text-2xs">{compareIndex === realIdx ? 'Masquer diff' : 'Diff vs actuel'}</button>
                            <button onClick={() => { setText(v); setVersions(versions.slice(0, realIdx + 1)); setVersionsOpen(false); }} className="btn-secondary text-2xs">Restaurer</button>
                          </>
                        )}
                      </div>
                    </div>
                    {compareIndex === realIdx ? <DiffView a={v} b={text} /> : (
                      <div className="text-xs text-ink-700 whitespace-pre-wrap line-clamp-4 font-mono">{v}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* === REMOVE DIALOG === */}
      {removeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-ink-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setRemoveDialog(false)}>
          <div className="card max-w-md w-full p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-ink-900">Retirer ce post ?</h3>
            <p className="mt-2 text-sm text-ink-600">Choisissez l'option qui vous convient :</p>
            <div className="mt-4 space-y-2">
              <button onClick={() => removeFromCadence(false)} className="w-full text-left p-3 rounded-xl border border-ink-200 hover:border-brand-300 hover:bg-brand-50/30 transition">
                <div className="font-semibold text-sm text-ink-900">Retirer seulement de Cadence</div>
                <div className="text-xs text-ink-500 mt-0.5">La page Notion existe toujours.</div>
              </button>
              <button onClick={() => { if (!confirm('Confirmer ? La page Notion sera archivée.')) return; removeFromCadence(true); }} className="w-full text-left p-3 rounded-xl border border-danger-100 hover:border-danger-300 hover:bg-danger-50/30 transition">
                <div className="font-semibold text-sm text-danger-700">Archiver aussi dans Notion</div>
                <div className="text-xs text-ink-500 mt-0.5">Page archivée (corbeille Notion, réversible).</div>
              </button>
            </div>
            <div className="mt-4 flex justify-end pt-3 border-t border-ink-100">
              <button onClick={() => setRemoveDialog(false)} className="btn-ghost">Annuler</button>
            </div>
          </div>
        </div>
      )}

      <PublishModal open={publishOpen} onClose={() => setPublishOpen(false)} text={text} notionPageId={summary.id} />

    </div>
  );
}

function SaveIndicator({ saving, lastSavedAt, isDirty, error, tick }: { saving: boolean; lastSavedAt: number | null; isDirty: boolean; error: string | null; tick: number }) {
  void tick;
  if (error) return <span className="text-2xs text-danger-700 flex items-center gap-1 px-2"><span className="dot bg-danger-500" /> {error}</span>;
  if (saving) return <span className="text-2xs text-ink-500 flex items-center gap-1 animate-pulse-soft px-2"><span className="dot bg-brand-500" /> …</span>;
  if (isDirty) return <span className="text-2xs text-ink-500 flex items-center gap-1 px-2"><span className="dot bg-warn-500" /> Non sauvé</span>;
  if (!lastSavedAt) return <span className="text-2xs text-ink-400 px-2">—</span>;
  return <span className="text-2xs text-success-700 flex items-center gap-1 px-2"><span className="dot bg-success-500" /> {formatRelative(lastSavedAt)}</span>;
}

function DiffView({ a, b }: { a: string; b: string }) {
  const linesA = a.split('\n');
  const linesB = b.split('\n');
  const setB = new Set(linesB);
  const setA = new Set(linesA);
  return (
    <div className="text-2xs font-mono space-y-0.5 max-h-60 overflow-y-auto">
      {linesA.map((line, i) => (
        <div key={'a' + i} className={setB.has(line) ? 'text-ink-500' : 'bg-danger-50 text-danger-700 px-1 rounded'}>
          {setB.has(line) ? '  ' : '- '}{line || ' '}
        </div>
      ))}
      {linesB.filter(l => !setA.has(l)).map((line, i) => (
        <div key={'b' + i} className="bg-success-50 text-success-700 px-1 rounded">+ {line || ' '}</div>
      ))}
    </div>
  );
}
