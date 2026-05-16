'use client';

// V8.4 — Slash command menu inside the editor textarea.
// Triggered by typing `/` at start of line or after whitespace.
// Shows a Linear/Raycast-style dropdown anchored to the caret.

import { useEffect, useRef, useState } from 'react';

export type SlashCommand = {
  id: string;
  trigger: string;             // ex: 'hook', 'raccourcir', 'opinion'
  label: string;               // ex: 'Améliorer le hook'
  hint?: string;               // ex: 'Rends-le plus accrocheur'
  group?: string;              // ex: 'Améliorer'
  icon?: string;               // emoji or short char
  prompt: string;              // sent to /api/chat
};

export const SLASH_COMMANDS: SlashCommand[] = [
  // === Améliorer ===
  { id: 'hook',          trigger: 'hook',          icon: '🎣', label: 'Améliorer le hook',         hint: 'Plus accrocheur, factuel, < 80 chars',                group: 'Améliorer', prompt: 'Améliore le hook (1ère phrase) : rends-le plus accrocheur, < 80 caractères, factuel, sans clickbait. Garde tout le reste du post.' },
  { id: 'raccourcir',    trigger: 'raccourcir',    icon: '✂️', label: 'Raccourcir',                hint: '600-700 chars en gardant l\'essentiel',               group: 'Améliorer', prompt: 'Raccourcis ce post à 600-700 caractères en préservant l\'essentiel et un exemple chiffré.' },
  { id: 'plus-direct',   trigger: 'plus-direct',   icon: '⚡', label: 'Plus direct',               hint: 'Couper les filler, aller droit au but',               group: 'Améliorer', prompt: 'Rends ce post plus direct : supprime les filler words, les phrases d\'intro lentes, va droit au but dès la 1ère ligne.' },
  { id: 'plus-concret',  trigger: 'plus-concret',  icon: '🔍', label: 'Plus concret',              hint: 'Ajouter exemple chiffré ou cas anonymisé',            group: 'Améliorer', prompt: 'Rends ce post plus concret : ajoute un exemple chiffré, un cas anonymisé, des paragraphes plus courts.' },
  { id: 'plus-premium',  trigger: 'plus-premium',  icon: '✨', label: 'Plus premium',              hint: 'Ton expert, mature, sans jargon',                     group: 'Améliorer', prompt: 'Rends ce post plus premium : ton expert mature, vocabulaire précis sans jargon technique, structure plus serrée. Style Linear / Lemlist landing page.' },
  { id: 'supprimer-ia',  trigger: 'supprimer-ia',  icon: '🧹', label: 'Supprimer style IA',        hint: 'Tirets longs, mots creux, formules signatures',        group: 'Améliorer', prompt: 'Retire tout style IA reconnaissable : tirets longs, mots creux (seamless/robust/delve), formules signature, "ce n\'est pas X c\'est Y".' },
  // === Reformater ===
  { id: 'aerer',         trigger: 'aerer',         icon: '🌬', label: 'Aérer les paragraphes',     hint: 'Lignes vides entre les blocs',                         group: 'Format',    prompt: 'Aère ce post : ajoute des lignes vides entre les paragraphes, casse les longues phrases.' },
  { id: 'thread',        trigger: 'thread',        icon: '🧵', label: 'Convertir en thread',       hint: '4-6 messages liés',                                    group: 'Format',    prompt: 'Convertis ce post en thread LinkedIn de 4-6 messages liés. Chaque message numéroté X/N, autonome mais cohérent.' },
  { id: 'carrousel',     trigger: 'carrousel',     icon: '📑', label: 'Convertir en carrousel',    hint: '6 slides : pb → contexte → 3 leçons → CTA',           group: 'Format',    prompt: 'Convertis ce post en plan de carrousel 6 slides : Slide 1 problème, Slide 2 contexte, Slides 3-5 trois leçons, Slide 6 CTA. Donne le texte exact de chaque slide.' },
  // === Angle ===
  { id: 'opinion',       trigger: 'opinion',       icon: '💬', label: 'Convertir en opinion',      hint: 'Hot take mesuré sur ce sujet',                         group: 'Angle',     prompt: 'Réécris ce post en mode opinion : hot take mesuré sur ce sujet, position claire en 1ère phrase, exemple à l\'appui, sans gratuité.' },
  { id: 'storytelling',  trigger: 'storytelling',  icon: '📖', label: 'Convertir en storytelling', hint: 'Acte 1 contexte, acte 2 conflit, acte 3 résolution',  group: 'Angle',     prompt: 'Réécris ce post en storytelling 3 actes : Acte 1 contexte (qui, où, quand), Acte 2 conflit (le problème), Acte 3 résolution (la leçon). Format narratif.' },
  { id: 'cas-client',    trigger: 'cas-client',    icon: '🏢', label: 'Convertir en cas client',   hint: 'PME anonymisée, avant/après chiffré',                  group: 'Angle',     prompt: 'Réécris ce post en cas client anonymisé : une PME (sans nom), problème de départ chiffré, action mise en place, résultat mesuré. Garde tout anonyme.' },
  { id: 'ajouter-stat',  trigger: 'ajouter-stat',  icon: '📊', label: 'Ajouter une statistique',   hint: 'Chiffre marquant + source si dispo',                   group: 'Angle',     prompt: 'Ajoute une statistique pertinente à ce post : un chiffre marquant qui renforce le propos. Si tu ne peux pas l\'inventer, propose une stat plausible avec [SOURCE À VÉRIFIER].' },
  // === Visuel ===
  { id: 'visuel',        trigger: 'visuel',        icon: '🎨', label: 'Brief illustration',        hint: 'Idée de visuel pour ce post',                          group: 'Visuel',    prompt: 'Propose un brief d\'illustration pour ce post : style design system Heelio (bleu #2563EB, fond #F8FAFC), format 1200×630, ce qu\'on doit voir, ce qu\'il faut éviter.' },
];

export default function SlashMenu({
  open, anchor, query, onSelect, onClose
}: {
  open: boolean;
  anchor: { top: number; left: number } | null;
  query: string;
  onSelect: (cmd: SlashCommand) => void;
  onClose: () => void;
}) {
  const [active, setActive] = useState(0);

  // Filter commands by trigger or label
  const q = query.toLowerCase();
  const filtered = q
    ? SLASH_COMMANDS.filter(c => c.trigger.includes(q) || c.label.toLowerCase().includes(q))
    : SLASH_COMMANDS;

  useEffect(() => { setActive(0); }, [query, open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (filtered.length === 0) {
        if (e.key === 'Escape') onClose();
        return;
      }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (i + 1) % filtered.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (i - 1 + filtered.length) % filtered.length); }
      else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); onSelect(filtered[active]); }
      else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, active, onSelect, onClose]);

  if (!open || !anchor) return null;

  // Group filtered by group
  const groups: Record<string, SlashCommand[]> = {};
  filtered.forEach(c => { const g = c.group || 'Commandes'; (groups[g] = groups[g] || []).push(c); });

  let flatIdx = -1;

  return (
    <div
      className="absolute z-50 w-72 max-h-80 overflow-y-auto card p-1 shadow-pop animate-fade-in"
      style={{ top: anchor.top, left: Math.min(anchor.left, 380) }}
      onMouseDown={e => e.preventDefault()}
    >
      <div className="px-3 py-1.5 text-2xs uppercase tracking-wider font-semibold text-ink-500 flex items-center justify-between">
        <span>Commandes {query && <span className="text-ink-400 normal-case font-normal">« /{query} »</span>}</span>
        <kbd className="px-1 rounded bg-ink-100 font-mono">esc</kbd>
      </div>
      {filtered.length === 0 ? (
        <div className="px-3 py-3 text-xs text-ink-500 italic">Aucune commande « /{query} ». Tapez Esc.</div>
      ) : (
        Object.entries(groups).map(([groupName, list]) => (
          <div key={groupName}>
            <div className="px-3 pt-1.5 pb-0.5 text-2xs uppercase tracking-wider font-semibold text-ink-400">{groupName}</div>
            {list.map(c => {
              flatIdx++;
              const isActive = flatIdx === active;
              return (
                <button
                  key={c.id}
                  onClick={() => onSelect(c)}
                  onMouseEnter={() => setActive(flatIdx)}
                  className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-md transition text-left ${isActive ? 'bg-brand-50 text-brand-700' : 'hover:bg-ink-50 text-ink-800'}`}
                >
                  <span className="text-base shrink-0">{c.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">/{c.trigger}</div>
                    {c.hint && <div className="text-2xs text-ink-500 truncate">{c.hint}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}

// Helper : detect if user is typing a slash command at the caret position
// Returns { trigger: pos of '/', query: chars after '/' } if active, else null.
export function detectSlashQuery(text: string, caret: number): { trigger: number; query: string } | null {
  for (let i = caret - 1; i >= 0; i--) {
    const c = text[i];
    if (c === '/') {
      // Must be at start of text, start of line, or after whitespace
      if (i > 0 && /\S/.test(text[i - 1])) return null;
      const query = text.slice(i + 1, caret);
      // Only alphanumeric + dash in query
      if (!/^[a-zA-Z-]*$/.test(query)) return null;
      return { trigger: i, query };
    }
    if (/\s/.test(c)) return null;
    if (i < caret - 30) return null;
  }
  return null;
}
