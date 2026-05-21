'use client';

// V8.8 — MoveMenu : déplacer un post Notion vers une autre date.
// V9.7 — Mobile premium : bouton visible sur touch, bottom sheet sous 640px,
// toast inline au lieu d'alert(), feedback succès animé.

import { useEffect, useState } from 'react';

const FR_WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

function nextWeekdayLabel(weekday: number, base = new Date()): { label: string; iso: string } {
  const d = new Date(base);
  d.setHours(7, 30, 0, 0);
  while (d.getDay() !== weekday || d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { label: `${FR_WEEKDAYS[weekday]} ${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')}`, iso };
}

export default function MoveMenu({
  postId, currentDate, onMoved, compact = false,
}: {
  postId: string;
  currentDate?: string | null;
  onMoved?: (newDateIso: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  const options = [
    { label: `Demain (${tomorrow.getDate()}/${String(tomorrow.getMonth() + 1).padStart(2, '0')})`, iso: tomorrowIso },
    nextWeekdayLabel(1),
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
        body: JSON.stringify({ date: dateIso, time: '07:30' }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || 'Erreur déplacement');
      }
      const niceLabel = new Date(dateIso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'short' });
      setToast({ kind: 'success', msg: 'Déplacé vers ' + niceLabel });
      onMoved?.(dateIso);
      setOpen(false);
    } catch (e: any) {
      setToast({ kind: 'error', msg: e.message || 'Erreur déplacement' });
    } finally { setMoving(false); }
  }

  // V9.7 — Sur mobile, bouton compact reste visible (pas d'opacity-0).
  const btnClass = compact
    ? 'px-2 py-2 sm:px-1 sm:py-0 sm:opacity-0 sm:group-hover:opacity-100 rounded text-ink-400 hover:text-ink-700 hover:bg-ink-50 transition min-w-[32px] min-h-[32px] flex items-center justify-center'
    : 'btn-ghost text-2xs';

  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={e => { e.preventDefault(); setOpen(o => !o); }}
        className={btnClass}
        title="Déplacer vers"
        aria-label="Déplacer le post"
      >⋯</button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 sm:bg-transparent bg-ink-900/30 backdrop-blur-sm sm:backdrop-blur-none"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          {/* Bottom sheet sur mobile, popover sur desktop */}
          <div
            className="fixed bottom-0 left-0 right-0 z-50 card rounded-b-none rounded-t-2xl shadow-pop animate-slide-up
                       sm:absolute sm:bottom-auto sm:left-auto sm:right-0 sm:top-full sm:mt-1 sm:w-60 sm:rounded-2xl sm:animate-fade-in"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle mobile */}
            <div className="sm:hidden flex justify-center pt-2 pb-1">
              <span className="w-10 h-1 rounded-full bg-ink-200" aria-hidden />
            </div>
            <div className="px-4 sm:px-3 pt-2 pb-1 text-2xs uppercase tracking-wider font-semibold text-ink-500">Déplacer vers</div>
            <div className="px-2 sm:px-1 pb-2">
              {options.map(opt => (
                <button
                  key={opt.iso}
                  onClick={() => moveTo(opt.iso)}
                  disabled={moving || opt.iso === currentDate}
                  className="w-full text-left px-3 py-2.5 sm:py-1.5 text-sm rounded-md hover:bg-brand-50 hover:text-brand-700 active:bg-brand-100 transition disabled:opacity-40 disabled:hover:bg-transparent flex items-center justify-between"
                >
                  <span>{opt.label}</span>
                  {opt.iso === currentDate && <span className="text-2xs text-ink-400">actuel</span>}
                </button>
              ))}
            </div>
            <div className="px-4 sm:px-3 pt-2 pb-1 text-2xs uppercase tracking-wider font-semibold text-ink-500 border-t border-ink-100">Date personnalisée</div>
            <div className="px-3 sm:px-2 pt-1 pb-3 sm:pb-2 flex gap-2 items-center safe-area-bottom">
              <input
                type="date"
                value={customDate || tomorrowIso}
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => setCustomDate(e.target.value)}
                className="input text-sm sm:text-xs flex-1 min-h-[40px] sm:min-h-0"
              />
              <button
                onClick={() => moveTo(customDate || tomorrowIso)}
                disabled={moving}
                className="btn-primary text-sm sm:text-xs min-h-[40px] sm:min-h-0 px-4"
              >Déplacer</button>
            </div>
          </div>
        </>
      )}

      {/* Toast feedback succès / erreur */}
      {toast && (
        <div
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl text-sm font-medium shadow-pop animate-slide-up flex items-center gap-2
            ${toast.kind === 'success' ? 'bg-success-50 text-success-700 border border-success-100' : 'bg-danger-50 text-danger-700 border border-danger-100'}`}
          role="status"
          aria-live="polite"
        >
          <span aria-hidden>{toast.kind === 'success' ? '✓' : '⚠'}</span>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
