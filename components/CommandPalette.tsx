'use client';

// V8.3 — Command palette ⌘K
// Style Linear / Raycast : modal centrée avec input search live, fuzzy filter, raccourcis clavier.

import { useEffect, useRef, useState } from 'react';

export type Command = {
  id: string;
  label: string;
  hint?: string;
  group?: string;
  shortcut?: string;
  perform: () => void | Promise<void>;
};

export default function CommandPalette({
  open,
  onClose,
  commands,
}: {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) { setQ(''); setActive(0); return; }
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  // Filter commands by query (fuzzy : every char must appear in order)
  const filtered = q.trim()
    ? commands.filter(c => fuzzyMatch(c.label.toLowerCase(), q.toLowerCase()) || (c.hint && fuzzyMatch(c.hint.toLowerCase(), q.toLowerCase())))
    : commands;

  useEffect(() => { setActive(0); }, [q]);

  function onKey(e: React.KeyboardEvent) {
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (i + 1) % filtered.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (i - 1 + filtered.length) % filtered.length); }
    else if (e.key === 'Enter') { e.preventDefault(); filtered[active]?.perform(); onClose(); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  }

  if (!open) return null;

  // Group commands by their 'group' field
  const groups: Record<string, Command[]> = {};
  filtered.forEach(c => {
    const g = c.group || 'Commandes';
    (groups[g] = groups[g] || []).push(c);
  });

  let flatIdx = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-ink-900/30 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="card max-w-xl w-full overflow-hidden shadow-pop animate-slide-down" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-ink-100">
          <svg className="w-4 h-4 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.3-4.3"/></svg>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Tapez une commande ou cherchez…"
            className="flex-1 text-sm bg-transparent outline-none placeholder-ink-400"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-ink-100 text-2xs font-mono text-ink-500">esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-ink-500">Aucun résultat pour « {q} »</div>
          ) : (
            Object.entries(groups).map(([groupName, list]) => (
              <div key={groupName}>
                <div className="px-3 pt-2 pb-1 text-2xs uppercase tracking-wider font-semibold text-ink-400">{groupName}</div>
                {list.map(c => {
                  flatIdx++;
                  const isActive = flatIdx === active;
                  return (
                    <button
                      key={c.id}
                      onClick={() => { c.perform(); onClose(); }}
                      onMouseEnter={() => setActive(flatIdx)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left transition ${isActive ? 'bg-brand-50 text-brand-700' : 'hover:bg-ink-50 text-ink-800'}`}
                    >
                      <span className="text-sm font-medium flex-1 truncate">{c.label}</span>
                      {c.hint && <span className="text-2xs text-ink-500 truncate max-w-[180px]">{c.hint}</span>}
                      {c.shortcut && <kbd className={`px-1.5 py-0.5 rounded text-2xs font-mono ${isActive ? 'bg-white text-brand-700' : 'bg-ink-100 text-ink-500'}`}>{c.shortcut}</kbd>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="px-4 py-2 border-t border-ink-100 text-2xs text-ink-400 flex items-center gap-3">
          <span><kbd className="px-1 rounded bg-ink-100 font-mono">↑↓</kbd> naviguer</span>
          <span><kbd className="px-1 rounded bg-ink-100 font-mono">↵</kbd> exécuter</span>
          <span><kbd className="px-1 rounded bg-ink-100 font-mono">⌘K</kbd> ouvrir/fermer</span>
        </div>
      </div>
    </div>
  );
}

function fuzzyMatch(haystack: string, needle: string): boolean {
  let i = 0;
  for (const c of haystack) {
    if (c === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return false;
}
