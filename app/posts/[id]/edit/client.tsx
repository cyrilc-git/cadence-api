'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import LinkedInPreview, { toBold, toItalic } from '@/components/LinkedInPreview';
import PublishModal from '@/components/PublishModal';
import VisualGenerator from '@/components/VisualGenerator';
import MentionTextarea from '@/components/MentionTextarea';
import CommandPalette, { Command } from '@/components/CommandPalette';

const QUICK_ACTIONS = [
  { label: 'Améliorer le hook',          prompt: 'Améliore le hook : rends-le plus accrocheur, < 80 caractères, factuel, sans clickbait.' },
  { label: 'Raccourcir',                 prompt: "Raccourcis ce post à 600-700 caractères en préservant l'essentiel et un exemple chiffré." },
  { label: 'Rendre plus concret',        prompt: 'Rends ce post plus concret : ajoute un exemple chiffré, un cas anonymisé, des paragraphes plus courts.' },
  { label: 'Vouvoiement strict',         prompt: 'Vérifie le vouvoiement strict. Corrige tout tutoiement.' },
  { label: 'Mise en forme LinkedIn',     prompt: 'Améliore la mise en forme LinkedIn : paragraphes courts, hook fort, mots-clés en gras Unicode si pertinent, pas de tiret long, hashtags ciblés à la fin.' },
  { label: 'Nettoyer style IA',          prompt: 'Retire tout style IA reconnaissable : phrases creuses, formules signature, mots interdits.' },
  { label: 'Brief illustration',         prompt: "Propose un brief d'illustration pour ce post : style design system Heelio (couleurs bleues #2563EB, fond #F8FAFC), format 1200x630." }
];

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
  if (!iso) return '(date à définir)';
  try {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
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
  const [chatInput, setChatInput] = useState('');
  const [publishOpen, setPublishOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const lastSavedTextRef = useRef(initial.content);
  const lastSavedValidatedRef = useRef(initialValidated);
  const autosaveTimer = useRef<number | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const status = deriveStatus(summary, validated);
  const sMeta = STATUS_META[status];
  const isDirty = text !== lastSavedTextRef.current || validated !== lastSavedValidatedRef.current;

  // Ticker for "Sauvegardé il y a X sec"
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  // Save function (called by autosave + manual)
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

  // Autosave : 3s after last change
  useEffect(() => {
    if (!isDirty) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => save(true), 3000);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [text, validated, isDirty, save]);

  // Cmd/Ctrl+S to save immediately
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(false); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(o => !o); }
      if (e.key === 'Escape' && focusMode) setFocusMode(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save, focusMode]);

  // Chat history load
  useEffect(() => {
    fetch(`/api/chat?notion_page_id=${summary.id}`).then(r => r.json()).then(d => setChat(d.messages || [])).catch(() => {});
  }, [summary.id]);

  async function runChat(prompt: string) {
    setChatLoading(true); setChatInput('');
    setChat(c => [...c, { role: 'user', content: prompt }]);
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notion_page_id: summary.id, draft: text, instruction: prompt }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setChat(c => [...c, { role: 'assistant', content: d.rewrite }]);
    } catch (e: any) {
      setChat(c => [...c, { role: 'assistant', content: 'Erreur : ' + e.message }]);
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

  const [removeDialog, setRemoveDialog] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [compareIndex, setCompareIndex] = useState<number | null>(null);

  async function performRemove(alsoArchiveNotion: boolean) {
    setRemoveDialog(false);
    setRemoving(true);
    try {
      // Always remove the cadence_drafts marker (idempotent — does nothing if none)
      await fetch(`/api/cadence-drafts/${summary.id}`, { method: 'DELETE' }).catch(() => {});
      if (alsoArchiveNotion) {
        const r = await fetch(`/api/notion/post/${summary.id}/archive`, { method: 'POST' });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'archive failed');
      }
      window.location.href = '/posts';
    } catch (e: any) { alert('Erreur : ' + e.message); }
    finally { setRemoving(false); }
  }

  // V8.3 — Command palette ⌘K
  const commands: Command[] = [
    { id: 'focus', label: focusMode ? 'Quitter le mode focus' : 'Mode focus', hint: 'Plein écran sans distractions', group: 'Vue', shortcut: 'esc', perform: () => setFocusMode(f => !f) },
    { id: 'save', label: 'Sauvegarder', hint: 'Forcer une sauvegarde immédiate', group: 'Vue', shortcut: '⌘S', perform: () => save(false) },
    { id: 'versions', label: `Historique versions (${versions.length})`, hint: 'Voir et restaurer une version précédente', group: 'Vue', perform: () => setVersionsOpen(true) },
    { id: 'notion', label: 'Ouvrir dans Notion', group: 'Vue', perform: () => window.open(summary.notion_url, '_blank') },
    ...QUICK_ACTIONS.map<Command>(a => ({
      id: 'ai-' + a.label.toLowerCase().replace(/\s+/g, '-'),
      label: a.label,
      hint: 'Réécriture par Cadence',
      group: 'Améliorer avec l\'IA',
      perform: () => runChat(a.prompt)
    })),
    { id: 'remove', label: summary.cadence_source === 'cadence' ? 'Retirer de Cadence' : 'Retirer de la liste', hint: 'Conserver la page Notion', group: 'Avancé', perform: () => setRemoveDialog(true) },
    { id: 'publish', label: 'Publier maintenant', hint: 'Validation requise', group: 'Avancé', perform: () => setPublishOpen(true) },
  ];

  // V8.3 — slash commands inside the textarea (detect '/' typed at start of line)
  // Light implementation : if user types '/' followed by a known command and hits Enter, replace it.
  function handleTextChange(next: string) {
    setText(next);
  }

  // V8.3 — word/reading helpers
  const stripped = text.replace(/@\[([^\]]+)\]\(urn:li:(?:person|organization|school):[^)\s]+\)/g, (_, d) => d);
  const wordCount = stripped.trim() ? stripped.trim().split(/\s+/).length : 0;
  const readingMin = Math.max(1, Math.round(wordCount / 220));

  return (
    <div className={focusMode ? 'fixed inset-0 z-40 bg-white overflow-y-auto p-8 animate-fade-in' : 'space-y-6 pb-24 lg:pb-0'}>
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`chip ${sMeta.cls}`}><span className={`dot ${sMeta.dot}`} /> {sMeta.label}</span>
            {summary.pilier && <span className="text-2xs uppercase tracking-wider font-semibold text-ink-500">{summary.pilier}</span>}
          </div>
          <h1 className="text-2xl font-semibold text-ink-900 tracking-tight">{summary.title || 'Sans titre'}</h1>
          <p className="mt-1 text-sm text-ink-500">{formatDateTime(summary.scheduled_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          <SaveIndicator saving={saving} lastSavedAt={lastSavedAt} isDirty={isDirty} error={saveError} tick={tick} />
          <button onClick={() => setFocusMode(f => !f)} className="btn-ghost" title="Mode focus (Esc pour quitter)">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d={focusMode ? 'M4 14h6v6 M20 10h-6V4 M14 10l7-7 M3 21l7-7' : 'M15 3h6v6 M9 21H3v-6 M21 3l-7 7 M3 21l7-7'}/></svg>
            {focusMode ? 'Quitter focus' : 'Focus'}
          </button>
          <a href={summary.notion_url} target="_blank" rel="noopener" className="btn-ghost" title="Ouvrir dans Notion">Notion ↗</a>
          {summary.linkedin_url && <a href={summary.linkedin_url} target="_blank" rel="noopener" className="btn-ghost">LinkedIn ↗</a>}
        </div>
      </header>

      <div className={focusMode ? 'max-w-3xl mx-auto' : 'grid lg:grid-cols-2 gap-6'}>
        <section className="space-y-5">
          {/* Editor card */}
          <div className="card p-5">
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              <button onClick={() => applyTransform(toBold)}   className="btn-ghost text-base font-bold w-8 h-8" title="Sélection en gras Unicode">𝗕</button>
              <button onClick={() => applyTransform(toItalic)} className="btn-ghost text-base italic w-8 h-8" title="Sélection en italique Unicode">𝘐</button>
              <span className="w-px h-5 bg-ink-200 mx-1" />
              <button onClick={() => setText(text.replace(/[—–]/g, ','))} className="btn-ghost text-xs">Retirer tirets longs</button>
              <button onClick={() => setText(text.replace(/\n+/g, '\n\n').trim())} className="btn-ghost text-xs">Aérer</button>
              <span className="ml-auto text-xs text-ink-500 tabular-nums flex items-center gap-3">
                <span className="hidden sm:inline">{wordCount} mots · ~{readingMin} min</span>
                <span><span className={stripped.length > 1300 ? 'text-danger-500 font-semibold' : ''}>{stripped.length}</span> <span className="text-ink-400">/ 1300</span></span>
              </span>
            </div>
            <MentionTextarea
              textareaRef={taRef}
              value={text}
              onChange={setText}
              rows={focusMode ? 24 : 16}
              placeholder="Commencez à écrire votre post… Tapez @ pour mentionner une personne ou entreprise."
            />
          </div>

          {!focusMode && (
            <>
              {/* AI assistant card */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-ink-900 text-sm">Améliorer avec l'IA</h3>
                  {versions.length > 1 && (
                    <div className="flex items-center gap-1">
                      <button onClick={revert} className="btn-ghost text-xs" title="Revenir à la version précédente">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M3 7v6h6 M21 17a9 9 0 00-15-6.7L3 13"/></svg>
                        Annuler
                      </button>
                      <button onClick={() => setVersionsOpen(true)} className="btn-ghost text-xs">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M12 8v4l3 3 M3 12a9 9 0 1018 0 9 9 0 00-18 0z M3 5v4h4"/></svg>
                        Versions ({versions.length})
                      </button>
                    </div>
                  )}
                </div>
                <button onClick={() => setCmdOpen(true)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-ink-200 hover:border-brand-300 hover:bg-brand-50/40 text-sm text-ink-600 transition text-left">
                  <svg className="w-3.5 h-3.5 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.3-4.3"/></svg>
                  <span className="flex-1">Améliorer avec l'IA…</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-ink-100 text-2xs font-mono text-ink-500">⌘K</kbd>
                </button>
                <div className="mt-3 flex gap-2">
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && chatInput && runChat(chatInput)} placeholder="Ou une instruction libre…" className="input text-sm flex-1" />
                  <button onClick={() => chatInput && runChat(chatInput)} disabled={chatLoading || !chatInput} className="btn-primary">{chatLoading ? '…' : 'Envoyer'}</button>
                </div>
                {chat.length > 0 && (
                  <div className="mt-4 max-h-96 overflow-y-auto space-y-3 pr-1">
                    {chat.map((m, i) => (
                      <div key={i} className={`rounded-xl p-3 text-sm border ${m.role === 'user' ? 'border-ink-200 bg-ink-50' : 'border-brand-200 bg-brand-50/40'}`}>
                        <div className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-1">{m.role === 'user' ? 'Vous' : 'Cadence IA'}</div>
                        <div className="whitespace-pre-wrap text-ink-800">{m.content}</div>
                        {m.role === 'assistant' && !m.content.startsWith('Erreur') && (
                          <button onClick={() => applyRewrite(m.content)} className="mt-2 text-xs px-3 py-1 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition">Appliquer</button>
                        )}
                      </div>
                    ))}
                    {chatLoading && <div className="text-xs text-ink-500 italic animate-pulse-soft">Cadence IA réfléchit…</div>}
                  </div>
                )}
              </div>

              <VisualGenerator
                defaultPrompt={`Visuel d'accompagnement pour ce post LinkedIn :\n\n${text.slice(0, 300)}\n\n(Style : ${summary.pilier || 'Heelio'})`}
                notionPageId={summary.id}
                onPick={setImageUrl}
              />
            </>
          )}
        </section>

        {!focusMode && (
          <section className="space-y-5 lg:sticky lg:top-6 lg:self-start">
            <div className="card p-5">
              <h3 className="font-semibold text-ink-900 text-sm mb-3">Aperçu LinkedIn</h3>
              <LinkedInPreview text={text} image={imageUrl || undefined} />
            </div>

            <div className="card p-5 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer select-none p-3 rounded-xl border border-warn-100 bg-warn-50/40 hover:bg-warn-50 transition">
                <input type="checkbox" checked={validated} onChange={e => setValidated(e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-ink-300 text-brand-500" />
                <span className="text-sm text-ink-700">
                  <strong className="block text-ink-900 mb-0.5">Validé pour publication automatique</strong>
                  <span className="text-xs text-ink-500">Si coché, le cron quotidien publiera ce post à l'heure programmée. Sinon il reste en brouillon.</span>
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => save(false)} disabled={saving} className="btn-secondary">{saving ? 'Sauvegarde…' : 'Sauvegarder'}</button>
                <button onClick={() => setPublishOpen(true)} disabled={!text.trim() || isDirty} title={isDirty ? 'Sauvegardez avant de publier' : undefined} className="btn-primary">Publier…</button>
              </div>
              <button onClick={() => setRemoveDialog(true)} disabled={removing} className="btn-danger w-full justify-center">
                {removing ? 'Suppression…' : (summary.cadence_source === 'cadence' ? 'Retirer de Cadence…' : 'Retirer de la liste…')}
              </button>
            </div>
          </section>
        )}
      </div>

      {/* V8.1 — Mobile sticky action bar */}
      {!focusMode && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-ink-200 shadow-elev px-4 py-3 flex items-center gap-2 animate-slide-up">
          <SaveIndicator saving={saving} lastSavedAt={lastSavedAt} isDirty={isDirty} error={saveError} tick={tick} />
          <span className="ml-auto" />
          <button onClick={() => save(false)} disabled={saving} className="btn-secondary text-xs flex-1">{saving ? '…' : 'Sauver'}</button>
          <button onClick={() => setPublishOpen(true)} disabled={!text.trim() || isDirty} className="btn-primary text-xs flex-1">Publier…</button>
        </div>
      )}

      {/* V8.1 — Versions modal with diff preview */}
      {versionsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-ink-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setVersionsOpen(false)}>
          <div className="card max-w-3xl w-full p-6 max-h-[85vh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold text-ink-900">Historique des versions</h3>
                <p className="text-xs text-ink-500">Sélectionnez une version pour la comparer avec l'actuelle ou la restaurer.</p>
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
                            <button onClick={() => setCompareIndex(compareIndex === realIdx ? null : realIdx)} className="btn-ghost text-2xs">
                              {compareIndex === realIdx ? 'Masquer diff' : 'Diff vs actuel'}
                            </button>
                            <button onClick={() => { setText(v); setVersions(versions.slice(0, realIdx + 1)); setVersionsOpen(false); }} className="btn-secondary text-2xs">Restaurer</button>
                          </>
                        )}
                      </div>
                    </div>
                    {compareIndex === realIdx ? (
                      <DiffView a={v} b={text} />
                    ) : (
                      <div className="text-xs text-ink-700 whitespace-pre-wrap line-clamp-4 font-mono">{v}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

            {removeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-ink-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setRemoveDialog(false)}>
          <div className="card max-w-md w-full p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-ink-900">Retirer ce post ?</h3>
            <p className="mt-2 text-sm text-ink-600">Choisissez l'option qui vous convient :</p>
            <div className="mt-4 space-y-2">
              <button
                onClick={() => performRemove(false)}
                className="w-full text-left p-3 rounded-xl border border-ink-200 hover:border-brand-300 hover:bg-brand-50/30 transition"
              >
                <div className="font-semibold text-sm text-ink-900">Retirer seulement de Cadence</div>
                <div className="text-xs text-ink-500 mt-0.5">La page Notion existe toujours. Vous pouvez la rouvrir manuellement dans Notion. Cadence ne la verra plus comme « Créée par Cadence ».</div>
              </button>
              <button
                onClick={() => {
                  if (!confirm('Confirmer ? La page Notion sera archivée (réversible côté Notion mais le post disparaîtra de toutes les vues Cadence).')) return;
                  performRemove(true);
                }}
                className="w-full text-left p-3 rounded-xl border border-danger-100 hover:border-danger-300 hover:bg-danger-50/30 transition"
              >
                <div className="font-semibold text-sm text-danger-700">Archiver aussi dans Notion</div>
                <div className="text-xs text-ink-500 mt-0.5">La page Notion est archivée (= déplacée à la corbeille Notion). Vous pouvez la restaurer depuis Notion si besoin. Cadence ne la verra plus.</div>
              </button>
            </div>
            <div className="mt-4 flex justify-end pt-3 border-t border-ink-100">
              <button onClick={() => setRemoveDialog(false)} className="btn-ghost">Annuler</button>
            </div>
          </div>
        </div>
      )}

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} commands={commands} />

      <PublishModal open={publishOpen} onClose={() => setPublishOpen(false)} text={text} notionPageId={summary.id} />
    </div>
  );
}

function SaveIndicator({ saving, lastSavedAt, isDirty, error, tick }: { saving: boolean; lastSavedAt: number | null; isDirty: boolean; error: string | null; tick: number }) {
  void tick; // tick is consumed via parent re-render
  if (error) return <span className="text-xs text-danger-700 flex items-center gap-1"><span className="dot bg-danger-500" /> {error}</span>;
  if (saving) return <span className="text-xs text-ink-500 flex items-center gap-1 animate-pulse-soft"><span className="dot bg-brand-500" /> Sauvegarde…</span>;
  if (isDirty) return <span className="text-xs text-ink-500 flex items-center gap-1"><span className="dot bg-warn-500" /> Modifications non sauvegardées</span>;
  if (!lastSavedAt) return <span className="text-xs text-ink-400">Aucune modification</span>;
  return <span className="text-xs text-success-700 flex items-center gap-1"><span className="dot bg-success-500" /> {formatRelative(lastSavedAt)}</span>;
}

function formatRelative(t: number): string {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 5) return "Sauvegardé à l'instant";
  if (s < 60) return `Sauvegardé il y a ${s} sec`;
  const m = Math.floor(s / 60);
  if (m < 60) return `Sauvegardé il y a ${m} min`;
  const h = Math.floor(m / 60);
  return `Sauvegardé il y a ${h} h`;
}


function DiffView({ a, b }: { a: string; b: string }) {
  // Simple line-level diff : removed (red), added (green), unchanged (gray)
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
