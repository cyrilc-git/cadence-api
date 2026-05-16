'use client';

// V8.8 — MoveMenu : déplacer un post Notion vers une autre date sans drag/drop
// Usage : <MoveMenu postId="..." currentDate="2026-05-18" onMoved={() => refresh()} />

import { useState } from 'react';

const FR_WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

function nextWeekdayLabel(weekday: number, base = new Date()): { label: string; iso: string } {
  const d = new Date(base);
  d.setHours(7, 30, 0, 0);
  while (d.getDay() !== weekday || d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return { label: `${FR_WEEKDAYS[weekday]} ${d.getDate()}/${String(d.getMonth()+1).padStart(2,'0')}`, iso };
}

export default function MoveMenu({
  postId, currentDate, onMoved, compact = false
}: {
  postId: string;
  currentDate?: string | null;
  onMoved?: (newDateIso: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [customDate, setCustomDate] = useState('');

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;

  const options = [
    { label: `Demain (${tomorrow.getDate()}/${String(tomorrow.getMonth()+1).padStart(2,'0')})`, iso: tomorrowIso },
    nextWeekdayLabel(1), // next Monday
    nextWeekdayLabel(2),
    nextWeekdayLabel(3),
    nextWeekdayLabel(4),
    nextWeekdayLabel(5),
  ];

  async function moveTo(dateIso: string) {
    setMoving(true);
    try {
      const r = await fetch(`/api/notion/post/${postId}/move`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateIso, time: '07:30' })
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || 'Erreur déplacement');
      }
      onMoved?.(dateIso);
      setOpen(false);
    } catch (e: any) { alert('Erreur : ' + e.message); }
    finally { setMoving(false); }
  }

  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={e => { e.preventDefault(); setOpen(o => !o); }}
        className={compact ? 'opacity-0 group-hover:opacity-100 px-1 rounded text-ink-400 hover:text-ink-700 hover:bg-ink-50 transition' : 'btn-ghost text-2xs'}
        title="Déplacer vers…"
      >⋯</button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-56 z-50 card p-1 shadow-pop animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="px-3 pt-2 pb-1 text-2xs uppercase tracking-wider font-semibold text-ink-500">Déplacer vers</div>
            {options.map(opt => (
              <button
                key={opt.iso}
                onClick={() => moveTo(opt.iso)}
                disabled={moving || opt.iso === currentDate}
                className="w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-brand-50 hover:text-brand-700 transition disabled:opacity-40 disabled:hover:bg-transparent"
              >
                {opt.label}
              </button>
            ))}
            <div className="px-3 pt-2 pb-1 text-2xs uppercase tracking-wider font-semibold text-ink-500 border-t border-ink-100 mt-1">Date personnalisée</div>
            <div className="px-2 pb-2 flex gap-1">
              <input
                type="date"
                value={customDate || tomorrowIso}
                onChange={e => setCustomDate(e.target.value)}
                className="input text-xs flex-1"
              />
              <button
                onClick={() => moveTo(customDate || tomorrowIso)}
                disabled={moving}
                className="btn-primary text-xs"
              >OK</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
