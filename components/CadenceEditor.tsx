'use client';

// V8.6 — CadenceEditor : composant unique pour toutes les surfaces d'écriture LinkedIn dans Cadence.
// V8.9 — vrai streaming SSE depuis /api/chat/stream (remplace pseudo-streaming), abort/cancel, undo une étape.

import { useEffect, useRef, useState } from 'react';
import MentionTextarea, { caretCoords } from './MentionTextarea';
import SlashMenu, { SlashCommand, detectSlashQuery } from './SlashMenu';
import MentionSuggestions from './MentionSuggestions';
import { toBold, toItalic, toBulletList, toQuote } from './LinkedInPreview';

export type CadenceEditorProps = {
  value: string;
  onChange: (next: string) => void;
  draftId?: string;
  onResult?: (rewrite: string) => void;
  rows?: number;
  placeholder?: string;
  bare?: boolean;
  className?: string;
  textareaRef?: React.MutableRefObject<HTMLTextAreaElement | null>;
  showAiIndicator?: boolean;
  brief?: string;
  pilier?: string;
  /** V8.9 — afficher les suggestions de mentions IA sous l'éditeur */
  showMentionSuggestions?: boolean;
  /** V12.8 §2 — Callback quand Cadence détecte qu'un visuel serait pertinent.
   * Le parent ouvre alors son drawer / sélectionne le template approprié. */
  onVisualSuggested?: (format: string) => void;
};

function strippedText(text: string): string {
  return text.replace(/@\[([^\]]+)\]\(urn:li:(?:person|organization|school):[^)\s]+\)/g, (_, d) => d);
}

export function useEditorMetrics(text: string) {
  const stripped = strippedText(text);
  const wordCount = stripped.trim() ? stripped.trim().split(/\s+/).length : 0;
  const charCount = stripped.length;
  const readingMin = Math.max(1, Math.round(wordCount / 220));
  return { wordCount, charCount, readingMin, stripped };
}

export default function CadenceEditor({
  value, onChange, draftId = 'new-post', onResult,
  rows = 14, placeholder = 'Tapez / pour les commandes, @ pour mentionner.',
  bare = false, className = '',
  textareaRef, showAiIndicator = true,
  brief, pilier,
  showMentionSuggestions = true,
  onVisualSuggested,
}: CadenceEditorProps) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const ref = textareaRef || localRef;

  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashAnchor, setSlashAnchor] = useState<{ top: number; left: number } | null>(null);
  const [slashTrigger, setSlashTrigger] = useState(0);

  const [bubble, setBubble] = useState<{ top: number; left: number } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  // V8.9 — undo state (snapshot pré-IA) + abort controller
  const [preIaText, setPreIaText] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // V11.2 — Memory check : Cadence se souvient pendant la frappe
  // V11.5 — counterAngle proposé si saturation détectée
  // V12.6 — visualHint : Cadence suggère un format graphique selon le texte
  const [memorySignal, setMemorySignal] = useState<{ kind: 'saturation' | 'novelty' | 'familiar'; message: string; counterAngle?: string | null } | null>(null);
  const [visualHint, setVisualHint] = useState<{ format: string; message: string } | null>(null);
  // V12.8 §2 — l'utilisateur peut "ignorer" une suggestion visuelle pour
  // qu'elle ne réapparaisse pas pendant cette session de frappe.
  const [dismissedHintFormat, setDismissedHintFormat] = useState<string | null>(null);
  const memoryAbortRef = useRef<AbortController | null>(null);
  const memoryTimerRef = useRef<any>(null);

  useEffect(() => {
    if (value.trim().length < 80) { setMemorySignal(null); return; }
    if (memoryTimerRef.current) clearTimeout(memoryTimerRef.current);
    memoryTimerRef.current = setTimeout(async () => {
      try {
        if (memoryAbortRef.current) memoryAbortRef.current.abort();
        const ctl = new AbortController();
        memoryAbortRef.current = ctl;
        const r = await fetch('/api/memory-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: value }),
          signal: ctl.signal,
        });
        if (!r.ok) return;
        const d = await r.json();
        if (d && d.kind && d.kind !== 'none' && d.message) {
          setMemorySignal({ kind: d.kind, message: d.message, counterAngle: d.counterAngle || null });
        } else {
          setMemorySignal(null);
        }
        setVisualHint(d?.visualHint || null);
      } catch { /* abort or network: silent */ }
    }, 1500);
    return () => { if (memoryTimerRef.current) clearTimeout(memoryTimerRef.current); };
  }, [value]);

  function handleTextChange(next: string) {
    onChange(next);
    const ta = ref.current;
    if (!ta) { setSlashOpen(false); return; }
    const caret = ta.selectionStart;
    const detection = detectSlashQuery(next, caret);
    if (detection) {
      setSlashOpen(true);
      setSlashQuery(detection.query);
      setSlashTrigger(detection.trigger);
      try { setSlashAnchor(caretCoords(ta, detection.trigger)); } catch { /* silent */ }
    } else {
      setSlashOpen(false);
    }
  }

  // V8.9 — vrai streaming SSE depuis /api/chat/stream, fallback /api/chat si erreur
  async function streamRewrite(draft: string, instruction: string): Promise<string | null> {
    const controller = new AbortController();
    abortRef.current = controller;
    let acc = '';
    try {
      const r = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notion_page_id: draftId, draft, instruction }),
        signal: controller.signal
      });
      if (!r.ok || !r.body) throw new Error(`stream http ${r.status}`);
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      // V9.0 §6 — batch rendering via requestAnimationFrame pour un streaming fluide (60fps)
      // au lieu de setState pour chaque delta Anthropic. Sensation Perplexity/Cursor.
      let pendingFlush = false;
      function scheduleFlush() {
        if (pendingFlush) return;
        pendingFlush = true;
        requestAnimationFrame(() => {
          pendingFlush = false;
          onChange(acc);
        });
      }

      while (true) {
        const { value: chunk, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(chunk, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const raw = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 2);
          if (!raw.startsWith('data:')) continue;
          const json = raw.slice(5).trim();
          if (!json) continue;
          try {
            const evt = JSON.parse(json);
            if (evt.type === 'delta' && evt.text) {
              acc += evt.text;
              scheduleFlush();
            } else if (evt.type === 'done' && typeof evt.full === 'string') {
              onChange(evt.full);
              return evt.full;
            } else if (evt.type === 'error') {
              throw new Error(evt.message || 'stream error');
            }
          } catch (parseErr) { /* skip malformed */ }
        }
      }
      // Flush final
      if (acc) onChange(acc);
      return acc || null;
    } catch (e: any) {
      if (controller.signal.aborted) return null;
      // Fallback non-stream
      try {
        const r = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notion_page_id: draftId, draft, instruction })
        });
        const d = await r.json();
        if (r.ok && d.rewrite) { onChange(d.rewrite); return d.rewrite; }
        console.warn('chat fallback error:', d.error || r.status);
      } catch (e2: any) {
        console.warn('chat fallback error:', e2.message);
      }
      return null;
    } finally {
      abortRef.current = null;
    }
  }

  function cancelStream() {
    abortRef.current?.abort();
    abortRef.current = null;
    setAiBusy(false);
    // Si annulé, restaurer la version pré-IA
    if (preIaText !== null) {
      onChange(preIaText);
      setPreIaText(null);
    }
  }

  function undoRewrite() {
    if (preIaText === null) return;
    onChange(preIaText);
    setPreIaText(null);
  }

  async function writeFullVersion() {
    if (!brief?.trim()) return;
    setPreIaText(value);
    setAiBusy(true);
    try {
      const r = await fetch('/api/generate-post', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pilier: pilier || 'Jeudi · Opinion / hot take mesuré', brief })
      });
      const d = await r.json();
      if (r.ok && d.proposals?.[0]) {
        onChange(d.proposals[0]);
        onResult?.(d.proposals[0]);
      } else if (d.error) {
        console.warn('writeFullVersion error:', d.error);
        setPreIaText(null);
      }
    } catch (e: any) {
      console.warn('writeFullVersion error:', e.message);
      setPreIaText(null);
    } finally { setAiBusy(false); }
  }

  async function applySlashCommand(cmd: SlashCommand) {
    setSlashOpen(false);
    const ta = ref.current;
    if (!ta) return;
    const caret = ta.selectionStart;
    const cleaned = value.slice(0, slashTrigger) + value.slice(caret);
    onChange(cleaned);
    setPreIaText(cleaned);
    setAiBusy(true);
    try {
      const result = await streamRewrite(cleaned || value, cmd.prompt);
      if (result) onResult?.(result);
      else setPreIaText(null);
    } finally { setAiBusy(false); }
  }

  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    function update() {
      if (!ta) return;
      const start = ta.selectionStart, end = ta.selectionEnd;
      if (start === end) { setBubble(null); return; }
      try {
        const pos = caretCoords(ta, start);
        setBubble({ top: pos.top - 38, left: Math.max(8, pos.left - 60) });
      } catch { setBubble(null); }
    }
    ta.addEventListener('mouseup', update);
    ta.addEventListener('keyup', update);
    document.addEventListener('selectionchange', update);
    return () => {
      ta.removeEventListener('mouseup', update);
      ta.removeEventListener('keyup', update);
      document.removeEventListener('selectionchange', update);
    };
  }, [ref]);

  // V8.9 — Escape pour annuler génération en cours
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && aiBusy) {
        e.preventDefault();
        cancelStream();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [aiBusy]);

  function applyTransform(transform: (s: string) => string) {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    if (start === end) return;
    onChange(value.slice(0, start) + transform(value.slice(start, end)) + value.slice(end));
  }

  // V15.2 — environnement éditorial premium en mode bare (utilisé dans
  // /posts/new et /posts/[id]/edit). On bascule sur la classe globale
  // `.cadence-editorial` qui pose le Charter 17px, leading 1.72,
  // letter-spacing -0.006em, caret brand-500, sélection brand-100. Ces
  // ajustements ne s'appliquent PAS aux usages hors-bare (mémoire,
  // brand-dna, etc.) qui restent en input compact.
  const bareClass = bare
    ? '!border-0 !p-0 !bg-transparent !shadow-none focus:!ring-0 focus:!shadow-none cadence-editorial w-full'
    : 'text-[15px] leading-[1.55] resize-none font-editorial';

  return (
    <div className={`relative ${className}`}>
      <MentionTextarea
        textareaRef={ref}
        value={value}
        onChange={handleTextChange}
        rows={rows}
        placeholder={placeholder}
        className={bareClass}
        onKeyIntercept={(e) => {
          // V8.9.1 — Si le slash menu est ouvert, ON BLOQUE Enter/Tab/Arrow au niveau du textarea.
          // Ça empêche l'insertion de newline natif ET tout side-effect (form submit, etc.).
          if (!slashOpen) return false;
          const k = e.key;
          if (k === 'Escape') { e.preventDefault(); setSlashOpen(false); return true; }
          if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === 'Tab') {
            e.preventDefault();
            e.stopPropagation();
            return true; // bloqué — le window listener du SlashMenu fera la sélection
          }
          return false;
        }}
      />

      {/* V13.8 — affordance "rédiger à partir du brief" : visible UNIQUEMENT
          si aucune génération IA n'a déjà eu lieu. preIaText !== null signifie
          qu'une IA est passée par là, le bouton "annuler la dernière IA"
          prend la place top-right ; afficher les deux à la même position
          créait un chevauchement. */}
      {brief && value.length < 200 && !aiBusy && preIaText === null && (
        <button
          onClick={writeFullVersion}
          className="absolute top-2 right-2 text-2xs text-brand-700 hover:text-brand-900 transition animate-fade-in z-20 underline decoration-dotted underline-offset-2"
          title="Cadence rédige une version complète à partir du brief"
        >
          rédiger à partir du brief
        </button>
      )}

      {/* V9.0 §6 + V12.8 §3 — Indicateur "Cadence rédige" plus discret */}
      {aiBusy && showAiIndicator && (
        <div className="absolute top-2 right-2 inline-flex items-center gap-1.5 text-2xs text-ink-500 animate-fade-in z-20 select-none">
          <span className="inline-block w-[2px] h-3 bg-brand-500 animate-caret-blink" aria-hidden />
          <span>Cadence rédige</span>
          <button onClick={cancelStream} className="ml-1.5 text-ink-400 hover:text-ink-900 transition" title="Annuler (Esc)">esc</button>
        </div>
      )}

      {/* V8.9 + V12.8 §3 — Bouton Undo plus discret après IA */}
      {!aiBusy && preIaText !== null && (
        <button
          onClick={undoRewrite}
          className="absolute top-2 right-2 text-2xs text-ink-500 hover:text-ink-900 transition animate-fade-in z-20 underline decoration-dotted underline-offset-2"
          title="Restaurer la version d'avant l'IA"
        >
          annuler la dernière IA
        </button>
      )}

      {bubble && (
        <div
          className="absolute z-30 bg-ink-900 rounded-lg p-0.5 flex items-center gap-0.5 shadow-elev animate-fade-in"
          style={{ top: bubble.top, left: bubble.left }}
          onMouseDown={e => e.preventDefault()}
        >
          <button
            onClick={() => applyTransform(toBold)}
            className="text-white/85 hover:text-white hover:bg-white/10 w-8 h-8 rounded-md transition text-base font-bold flex items-center justify-center"
            title="Gras Unicode (visible sur LinkedIn)"
          >𝗕</button>
          <button
            onClick={() => applyTransform(toItalic)}
            className="text-white/85 hover:text-white hover:bg-white/10 w-8 h-8 rounded-md transition text-base italic flex items-center justify-center"
            title="Italique Unicode (visible sur LinkedIn)"
          >𝘐</button>
          <span className="w-px h-5 bg-white/10 mx-0.5" aria-hidden />
          <button
            onClick={() => applyTransform(toBulletList)}
            className="text-white/85 hover:text-white hover:bg-white/10 w-8 h-8 rounded-md transition text-sm flex items-center justify-center"
            title="Liste à puces (préfixe • chaque ligne)"
            aria-label="Liste à puces"
          >•</button>
          <button
            onClick={() => applyTransform(toQuote)}
            className="text-white/85 hover:text-white hover:bg-white/10 w-8 h-8 rounded-md transition text-sm flex items-center justify-center"
            title="Citation (entoure de « »)"
            aria-label="Citation"
          >«»</button>
        </div>
      )}

      <SlashMenu
        open={slashOpen}
        anchor={slashAnchor}
        query={slashQuery}
        onSelect={applySlashCommand}
        onClose={() => setSlashOpen(false)}
      />

      {/* V11.2 + V11.5 + V12.6 — Memory signal + contre-angle + visualHint */}
      {(memorySignal || visualHint) && !aiBusy && (
        <div className="mt-2 space-y-0.5" aria-live="polite">
          {memorySignal && (
            <p
              className={`text-2xs italic leading-relaxed ${
                memorySignal.kind === 'novelty' ? 'text-emerald-700' :
                memorySignal.kind === 'saturation' ? 'text-amber-700' :
                'text-ink-500'
              }`}
            >
              {memorySignal.message}
            </p>
          )}
          {memorySignal?.counterAngle && (
            <p className="text-2xs text-ink-500 leading-relaxed">
              {memorySignal.counterAngle}
            </p>
          )}
          {visualHint && dismissedHintFormat !== visualHint.format && (
            <p className="text-2xs text-ink-500 leading-relaxed">
              {visualHint.message}
              {onVisualSuggested && (
                <>
                  {' '}
                  {/* V14.2 — wording explicite : "Ouvrir le studio" prévient
                      l'utilisateur qu'un panneau va apparaître à droite,
                      contrairement à "Créer le visuel" qui laissait penser
                      à une action inline silencieuse. */}
                  <button
                    type="button"
                    onClick={() => onVisualSuggested(visualHint.format)}
                    className="text-brand-700 hover:text-brand-900 underline decoration-dotted underline-offset-2 transition"
                    title="Ouvre le panneau de génération à droite (⌘P)"
                  >
                    Ouvrir le studio
                  </button>
                  {' · '}
                  <button
                    type="button"
                    onClick={() => setDismissedHintFormat(visualHint.format)}
                    className="text-ink-400 hover:text-ink-700 transition"
                    title="Ignorer cette suggestion pour ce post"
                  >
                    plus tard
                  </button>
                </>
              )}
            </p>
          )}
        </div>
      )}

      {/* V8.9 — suggestions de mentions IA discrètes */}
      {showMentionSuggestions && !aiBusy && (
        <MentionSuggestions
          text={value}
          onApply={(position, length, urn, display) => {
            const tag = `@[${display}](urn:li:${urn.includes(':') ? urn.split(':').slice(2).join(':') : urn})`;
            // urn format en cache : "person:abc" ou "organization:xyz" → reconstruit "urn:li:person:abc"
            const fullUrn = urn.startsWith('urn:li:') ? urn : `urn:li:${urn}`;
            const fullTag = `@[${display}](${fullUrn})`;
            const next = value.slice(0, position) + fullTag + value.slice(position + length);
            onChange(next);
          }}
          className="mt-2"
        />
      )}
    </div>
  );
}
