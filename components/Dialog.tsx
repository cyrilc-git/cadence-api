'use client';

// V13.3 — Système de dialogues + toast cohérent avec le ton Cadence.
// Remplace les confirm() et alert() natifs qui cassent la sensation
// premium (popup système blanc avec OK/Annuler en sans-serif système,
// pas de respect du focus ring, pas de close via clic dehors, etc.).
//
// API : import { confirmDialog, alertDialog, toast } from '@/components/Dialog'
// puis appel comme une promesse :
//   const ok = await confirmDialog({ title: '...', body: '...', destructive: true });
//   if (!ok) return;
//   await ...
//   toast.success('Élément supprimé');
//
// Pas de Context Provider : un seul container monté dans le layout root
// via <DialogHost />, qui s'abonne à un EventTarget singleton. Aucune
// dep externe.

import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Event bus (singleton, side-effect free at import)
// ---------------------------------------------------------------------------

type ConfirmOpts = {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};
type AlertOpts = { title: string; body?: string; tone?: 'info' | 'danger' };
type ToastOpts = { kind: 'success' | 'error' | 'info'; message: string; durationMs?: number };

type ConfirmEvent = { type: 'confirm'; opts: ConfirmOpts; resolve: (v: boolean) => void };
type AlertEvent = { type: 'alert'; opts: AlertOpts; resolve: () => void };
type ToastEvent = { type: 'toast'; opts: ToastOpts };
type AnyEvent = ConfirmEvent | AlertEvent | ToastEvent;

class DialogBus extends EventTarget {
  emit(detail: AnyEvent) { this.dispatchEvent(new CustomEvent('cadence:dialog', { detail })); }
}
const bus = new DialogBus();

export function confirmDialog(opts: ConfirmOpts): Promise<boolean> {
  return new Promise(resolve => bus.emit({ type: 'confirm', opts, resolve }));
}
export function alertDialog(opts: AlertOpts): Promise<void> {
  return new Promise(resolve => bus.emit({ type: 'alert', opts, resolve }));
}
export const toast = {
  success: (message: string, durationMs?: number) => bus.emit({ type: 'toast', opts: { kind: 'success', message, durationMs } }),
  error:   (message: string, durationMs?: number) => bus.emit({ type: 'toast', opts: { kind: 'error',   message, durationMs } }),
  info:    (message: string, durationMs?: number) => bus.emit({ type: 'toast', opts: { kind: 'info',    message, durationMs } }),
};

// ---------------------------------------------------------------------------
// DialogHost — monté une seule fois dans le layout root
// ---------------------------------------------------------------------------

export default function DialogHost() {
  const [confirmState, setConfirmState] = useState<ConfirmEvent | null>(null);
  const [alertState, setAlertState] = useState<AlertEvent | null>(null);
  const [toasts, setToasts] = useState<Array<ToastOpts & { id: number }>>([]);

  useEffect(() => {
    function onEvt(e: Event) {
      const ev = (e as CustomEvent<AnyEvent>).detail;
      if (ev.type === 'confirm') setConfirmState(ev);
      else if (ev.type === 'alert') setAlertState(ev);
      else if (ev.type === 'toast') {
        const id = Date.now() + Math.random();
        setToasts(t => [...t, { ...ev.opts, id }]);
        const dur = ev.opts.durationMs ?? 3500;
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), dur);
      }
    }
    bus.addEventListener('cadence:dialog', onEvt as EventListener);
    return () => bus.removeEventListener('cadence:dialog', onEvt as EventListener);
  }, []);

  // ESC ferme le dialog ouvert (priorité au confirm puis à l'alert)
  useEffect(() => {
    if (!confirmState && !alertState) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (confirmState) { confirmState.resolve(false); setConfirmState(null); }
        else if (alertState) { alertState.resolve(); setAlertState(null); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmState, alertState]);

  return (
    <>
      {confirmState && (
        <DialogShell onCancel={() => { confirmState.resolve(false); setConfirmState(null); }}>
          <h3 className="text-base font-semibold text-ink-900">{confirmState.opts.title}</h3>
          {confirmState.opts.body && <p className="mt-2 text-sm text-ink-600 leading-relaxed">{confirmState.opts.body}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => { confirmState.resolve(false); setConfirmState(null); }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-ink-700 hover:bg-ink-100 transition"
            >
              {confirmState.opts.cancelLabel || 'Annuler'}
            </button>
            <button
              onClick={() => { confirmState.resolve(true); setConfirmState(null); }}
              autoFocus
              className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition ${confirmState.opts.destructive ? 'bg-danger-500 hover:bg-danger-700' : 'bg-brand-500 hover:bg-brand-700'}`}
            >
              {confirmState.opts.confirmLabel || 'Confirmer'}
            </button>
          </div>
        </DialogShell>
      )}

      {alertState && (
        <DialogShell onCancel={() => { alertState.resolve(); setAlertState(null); }}>
          <h3 className={`text-base font-semibold ${alertState.opts.tone === 'danger' ? 'text-danger-700' : 'text-ink-900'}`}>{alertState.opts.title}</h3>
          {alertState.opts.body && <p className="mt-2 text-sm text-ink-600 leading-relaxed whitespace-pre-wrap">{alertState.opts.body}</p>}
          <div className="mt-5 flex justify-end">
            <button
              onClick={() => { alertState.resolve(); setAlertState(null); }}
              autoFocus
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-500 text-white hover:bg-brand-700 transition"
            >
              Compris
            </button>
          </div>
        </DialogShell>
      )}

      {/* Toast stack — coin bas droit, max 4 visibles */}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.slice(-4).map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-2.5 rounded-xl text-sm font-medium shadow-elev animate-slide-up flex items-center gap-2 max-w-sm ${
              t.kind === 'success' ? 'bg-success-50 text-success-700 border border-success-100' :
              t.kind === 'error'   ? 'bg-danger-50 text-danger-700 border border-danger-100' :
              'bg-white text-ink-800 border border-ink-200'
            }`}
            role="status"
          >
            <span aria-hidden>
              {t.kind === 'success' ? '✓' : t.kind === 'error' ? '⚠' : '·'}
            </span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function DialogShell({ children, onCancel }: { children: React.ReactNode; onCancel: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-ink-900/40 backdrop-blur-sm animate-fade-in"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl shadow-elev w-full max-w-md p-5 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
