'use client';

// V8.2 — MentionTextarea
// Standard <textarea> + overlay dropdown au caret quand l'utilisateur tape `@`.
// Insertion via syntax inline @[Display Name](urn:li:type:XXX) qui survit aux edits manuels.

import { useEffect, useMemo, useRef, useState } from 'react';
import { detectMentionQuery, insertMentionAtCaret, parseMentions } from '@/lib/mentions';

type Entity = {
  urn: string;
  type: 'person' | 'company' | 'school';
  display_name: string;
  handle?: string;
  url?: string;
  headline?: string;
  use_count?: number;
  avatar_url?: string;
};

export default function MentionTextarea({
  value,
  onChange,
  rows = 16,
  placeholder,
  className = '',
  id,
  textareaRef,
  spellCheck = true,
  onKeyIntercept,
}: {
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
  id?: string;
  textareaRef?: React.MutableRefObject<HTMLTextAreaElement | null>;
  spellCheck?: boolean;
  /** V8.9.1 — Si retourne true, on bloque le keypress natif (utilisé par SlashMenu pour intercepter Enter/Tab/Arrow) */
  onKeyIntercept?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean;
}) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const ref = textareaRef || localRef;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Entity[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<number | null>(null);

  const onInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    onChange(next);
    const ta = e.target;
    const caret = ta.selectionStart;
    const detection = detectMentionQuery(next, caret);
    if (detection) {
      setQuery(detection.query);
      setOpen(true);
      setActiveIdx(0);
      // Compute caret position in viewport for the dropdown anchor
      const pos = caretCoords(ta, detection.trigger);
      setAnchor(pos);
    } else {
      setOpen(false);
      setQuery('');
    }
  };

  // Debounced fetch on query change
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/mentions/search?q=${encodeURIComponent(query || ' ')}&limit=8`);
        const d = await r.json();
        setResults(d.results || []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 120);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, open]);

  function pickEntity(e: Entity) {
    const ta = ref.current;
    if (!ta) return;
    const caret = ta.selectionStart;
    const { text, caret: nextCaret } = insertMentionAtCaret(value, caret, e);
    onChange(text);
    setOpen(false);
    setQuery('');
    // Restore caret
    requestAnimationFrame(() => {
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(nextCaret, nextCaret);
    });
    // Increment use_count async
    fetch(`/api/mentions/upsert?urn=${encodeURIComponent(e.urn)}`, { method: 'PATCH' }).catch(() => {});
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // V8.9.1 — Slash menu (ou autre parent) a priorité absolue
    if (onKeyIntercept && onKeyIntercept(e)) return;
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => (i + 1) % results.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => (i - 1 + results.length) % results.length); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickEntity(results[activeIdx]); }
    else if (e.key === 'Escape') { setOpen(false); }
  }

  const mentionCount = useMemo(() => parseMentions(value).mentions.length, [value]);

  return (
    <div className="relative">
      <textarea
        ref={ref}
        id={id}
        value={value}
        onChange={onInput}
        onKeyDown={onKeyDown}
        rows={rows}
        placeholder={placeholder}
        spellCheck={spellCheck}
        className={`input text-[15px] leading-[1.55] resize-none ${className}`}
      />
      {mentionCount > 0 && (
        <span className="absolute -bottom-5 right-1 text-2xs text-ink-400">{mentionCount} mention{mentionCount > 1 ? 's' : ''} insérée{mentionCount > 1 ? 's' : ''}</span>
      )}
      {open && anchor && (() => {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
        const cls = isMobile
          ? 'fixed z-50 mx-2 mb-2 left-0 right-0 bottom-0 max-h-[60vh] overflow-y-auto card p-1 shadow-pop animate-slide-up'
          : 'absolute z-50 w-80 max-h-72 overflow-y-auto card p-1 shadow-pop animate-fade-in';
        const style = isMobile ? undefined : { top: anchor.top, left: Math.min(anchor.left, 320) };
        return (
        <div
          className={cls}
          style={style}
          onMouseDown={e => e.preventDefault() /* preserve focus */}
        >
          <div className="px-3 py-1.5 text-2xs uppercase tracking-wider font-semibold text-ink-500 flex items-center justify-between">
            <span>Mentions {query && <span className="text-ink-400 normal-case font-normal">« {query} »</span>}</span>
            {loading && <span className="dot bg-brand-500 animate-pulse-soft" />}
          </div>
          {results.length === 0 && !loading && (
            <div className="px-3 py-3 text-xs text-ink-500 italic">
              {query ? 'Aucun résultat. Tapez Esc pour annuler.' : 'Tapez pour rechercher une personne ou entreprise.'}
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={r.urn}
              onClick={() => pickEntity(r)}
              onMouseEnter={() => setActiveIdx(i)}
              className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-lg transition text-left ${i === activeIdx ? 'bg-brand-50 text-brand-700' : 'hover:bg-ink-50 text-ink-800'}`}
            >
              <Avatar entity={r} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate flex items-center gap-1.5">
                  {r.display_name}
                  {r.use_count != null && r.use_count > 0 && <span className="text-2xs text-ink-400">· déjà mentionné {r.use_count}×</span>}
                </div>
                {r.headline && <div className="text-2xs text-ink-500 truncate">{r.headline}</div>}
              </div>
              <span className="text-2xs text-ink-400 shrink-0 mt-0.5">{r.type === 'person' ? '👤' : '🏢'}</span>
            </button>
          ))}
          <div className="px-3 py-1.5 text-2xs text-ink-400 border-t border-ink-100 flex items-center gap-2">
            <kbd className="px-1 rounded bg-ink-100 font-mono">↑↓</kbd> naviguer
            <kbd className="px-1 rounded bg-ink-100 font-mono">↵</kbd> insérer
            <kbd className="px-1 rounded bg-ink-100 font-mono">Esc</kbd> fermer
          </div>
        </div>
        );
      })()}
    </div>
  );
}

function Avatar({ entity }: { entity: Entity }) {
  if (entity.avatar_url) {
    return <img src={entity.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />;
  }
  const initials = entity.display_name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const isCompany = entity.type !== 'person';
  return (
    <div className={`w-7 h-7 rounded-${isCompany ? 'md' : 'full'} flex items-center justify-center text-2xs font-semibold shrink-0 ${isCompany ? 'bg-ink-100 text-ink-700' : 'bg-gradient-to-br from-brand-500 to-brand-700 text-white'}`}>
      {initials || '?'}
    </div>
  );
}

// Compute the caret pixel coordinates inside a textarea using a hidden mirror div.
// Standard trick — works cross-browser.
export function caretCoords(textarea: HTMLTextAreaElement, position: number): { top: number; left: number } {
  const div = document.createElement('div');
  const style = getComputedStyle(textarea);
  const props = ['boxSizing','width','height','overflowX','overflowY','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','paddingTop','paddingRight','paddingBottom','paddingLeft','fontStyle','fontVariant','fontWeight','fontStretch','fontSize','fontFamily','lineHeight','letterSpacing','wordSpacing','textTransform','whiteSpace','tabSize','MozTabSize','direction','textAlign','textIndent'];
  for (const p of props) (div.style as any)[p] = (style as any)[p];
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';
  div.style.top = '0';
  div.style.left = '0';
  div.textContent = textarea.value.substring(0, position);
  const span = document.createElement('span');
  span.textContent = textarea.value.substring(position) || '.';
  div.appendChild(span);
  textarea.parentElement?.appendChild(div);
  const top = span.offsetTop - textarea.scrollTop + parseInt(style.fontSize) + 4;
  const left = span.offsetLeft;
  div.parentElement?.removeChild(div);
  return { top, left };
}
