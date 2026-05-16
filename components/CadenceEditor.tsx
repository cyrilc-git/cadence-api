'use client';

// V8.6 — CadenceEditor : composant unique pour toutes les surfaces d'écriture LinkedIn dans Cadence.
// Wrapping de :
//   - MentionTextarea (V8.2) — dropdown @ pour mentions LinkedIn
//   - SlashMenu (V8.4) — dropdown / pour commandes IA
//   - BubbleToolbar (V8.4) — toolbar B/I au survol de sélection
//   - Word count + char count + reading time (V8.3)
//   - Slash command execution (calls /api/chat then onResult)
//
// Élimine la duplication entre /posts/new et /posts/[id]/edit.
//
// Usage :
//   <CadenceEditor value={text} onChange={setText} bare autosave={...} draftId={summary.id} onResult={applyRewrite} />

import { useEffect, useRef, useState } from 'react';
import MentionTextarea, { caretCoords } from './MentionTextarea';
import SlashMenu, { SlashCommand, detectSlashQuery } from './SlashMenu';
import { toBold, toItalic } from './LinkedInPreview';

export type CadenceEditorProps = {
  value: string;
  onChange: (next: string) => void;
  /** Notion page id (or 'new-post') — sent to /api/chat for context */
  draftId?: string;
  /** Called after a slash command IA rewrite is received. Use to push to undo/redo stack. */
  onResult?: (rewrite: string) => void;
  rows?: number;
  placeholder?: string;
  /** If true : strip borders/padding/bg (fullscreen editor mode). */
  bare?: boolean;
  className?: string;
  /** Optional ref to the underlying textarea (for keyboard shortcuts, focus, etc.) */
  textareaRef?: React.MutableRefObject<HTMLTextAreaElement | null>;
  /** If true : show 'Cadence réfléchit…' chip during IA call. */
  showAiIndicator?: boolean;
};

// Strip mention markers for char/word count (display name only counts on LinkedIn)
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
}: CadenceEditorProps) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const ref = textareaRef || localRef;

  // Slash menu state
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashAnchor, setSlashAnchor] = useState<{ top: number; left: number } | null>(null);
  const [slashTrigger, setSlashTrigger] = useState(0);

  // Bubble toolbar state
  const [bubble, setBubble] = useState<{ top: number; left: number } | null>(null);

  // IA in-flight indicator
  const [aiBusy, setAiBusy] = useState(false);

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

  async function applySlashCommand(cmd: SlashCommand) {
    setSlashOpen(false);
    const ta = ref.current;
    if (!ta) return;
    const caret = ta.selectionStart;
    // Remove "/cmd" from the text
    const cleaned = value.slice(0, slashTrigger) + value.slice(caret);
    onChange(cleaned);
    setAiBusy(true);
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notion_page_id: draftId, draft: cleaned || value, instruction: cmd.prompt })
      });
      const d = await r.json();
      if (r.ok && d.rewrite) {
        onChange(d.rewrite);
        onResult?.(d.rewrite);
      } else {
        // Silent failure : restore the slash so user sees they need to retry
        console.warn('CadenceEditor IA error:', d.error || r.status);
      }
    } catch (e: any) {
      console.warn('CadenceEditor IA error:', e.message);
    } finally { setAiBusy(false); }
  }

  // Bubble toolbar : update position on selection change
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

  function applyTransform(transform: (s: string) => string) {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    if (start === end) return;
    onChange(value.slice(0, start) + transform(value.slice(start, end)) + value.slice(end));
  }

  const bareClass = bare
    ? '!border-0 !p-0 !bg-transparent !shadow-none text-[16px] leading-[1.65] focus:!ring-0 focus:!shadow-none font-editorial'
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
      />

      {/* IA in-flight indicator */}
      {aiBusy && showAiIndicator && (
        <div className="absolute top-2 right-2 chip chip-brand text-2xs animate-pulse-soft pointer-events-none">
          <span className="dot bg-brand-500" /> Cadence réfléchit…
        </div>
      )}

      {/* Bubble toolbar (B/I) */}
      {bubble && (
        <div
          className="absolute z-30 card p-1 flex items-center gap-0.5 shadow-pop animate-fade-in"
          style={{ top: bubble.top, left: bubble.left }}
          onMouseDown={e => e.preventDefault()}
        >
          <button onClick={() => applyTransform(toBold)} className="btn-ghost text-base font-bold w-8 h-8" title="Gras (Unicode)">𝗕</button>
          <button onClick={() => applyTransform(toItalic)} className="btn-ghost text-base italic w-8 h-8" title="Italique (Unicode)">𝘐</button>
        </div>
      )}

      {/* Slash menu */}
      <SlashMenu
        open={slashOpen}
        anchor={slashAnchor}
        query={slashQuery}
        onSelect={applySlashCommand}
        onClose={() => setSlashOpen(false)}
      />
    </div>
  );
}
