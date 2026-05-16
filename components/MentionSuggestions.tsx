'use client';

// V8.9 §6 — Suggestions de mentions IA discrètes.
// Détecte les noms d'entreprises/personnes connues dans le draft (cache linkedin_entities)
// et propose de les transformer en mention LinkedIn taguée. Jamais auto-inséré.

import { useEffect, useState } from 'react';

type Suggestion = {
  urn: string;
  type: 'person' | 'company' | 'school';
  display_name: string;
  handle?: string;
  url?: string;
  position: number;
  length: number;
};

export default function MentionSuggestions({
  text, onApply, className = ''
}: {
  text: string;
  onApply: (position: number, length: number, urn: string, display: string) => void;
  className?: string;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (text.length < 20) { setSuggestions([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch('/api/mentions/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        const d = await r.json();
        if (!cancelled) setSuggestions((d.suggestions || []).filter((s: Suggestion) => !dismissed.has(s.urn)));
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    }, 800); // debounce
    return () => { cancelled = true; clearTimeout(t); };
  }, [text, dismissed]);

  const visible = suggestions.filter(s => !dismissed.has(s.urn));
  if (!visible.length) return null;

  function apply(s: Suggestion) {
    // Re-localiser la position (peut avoir changé depuis la suggestion). Si on ne retrouve pas, on dismiss.
    const escaped = s.display_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![@\\w])${escaped}(?!\\w)`, 'i');
    const match = re.exec(text);
    if (!match || match.index === undefined) {
      setDismissed(prev => new Set([...prev, s.urn]));
      return;
    }
    onApply(match.index, match[0].length, s.urn, s.display_name);
    setDismissed(prev => new Set([...prev, s.urn]));
  }

  function dismiss(urn: string) {
    setDismissed(prev => new Set([...prev, urn]));
  }

  return (
    <div className={`flex items-start gap-2 flex-wrap text-2xs text-ink-500 ${className}`}>
      <span className="font-medium text-ink-600 mt-1.5 shrink-0">Mentions suggérées :</span>
      <div className="flex flex-wrap gap-1.5">
        {visible.map(s => (
          <span key={s.urn} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-brand-50 border border-brand-100 text-brand-700">
            <button
              onClick={() => apply(s)}
              className="hover:underline cursor-pointer"
              title={`Taguer ${s.display_name} (${s.type})`}
            >
              @{s.display_name}
            </button>
            <button
              onClick={() => dismiss(s.urn)}
              className="ml-0.5 text-ink-400 hover:text-ink-700 cursor-pointer"
              title="Ignorer"
              aria-label={`Ignorer ${s.display_name}`}
            >×</button>
          </span>
        ))}
      </div>
    </div>
  );
}
