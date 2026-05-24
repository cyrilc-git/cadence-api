'use client';

// V8.4 — Preview drawer
// Slide-in panel from the right that wraps LinkedInPreview. Closes on Esc / outside click / toggle.
// Style Arc / Notion Calendar peek panel.

import { useEffect } from 'react';

export default function PreviewDrawer({
  open, onClose, title = 'Aperçu LinkedIn', children
}: {
  open: boolean; onClose: () => void; title?: string; children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop (mobile only) */}
      {open && (
        <div onClick={onClose} className="lg:hidden fixed inset-0 z-30 bg-ink-900/20 backdrop-blur-[2px] animate-fade-in" />
      )}
      {/* Drawer — V8.8 : bottom sheet on mobile, side drawer on desktop.
          V12.7 fix bug bloquant : pointer-events-none + invisible quand fermé,
          pour ne PAS intercepter les clics ni occuper visuellement la page. */}
      <aside
        className={`fixed z-40 bg-white shadow-elev transform transition-transform duration-300 ease-out-expo
          ${open
            ? 'translate-x-0 translate-y-0 pointer-events-auto'
            : 'sm:translate-x-full translate-y-full sm:translate-y-0 pointer-events-none'}
          sm:top-0 sm:right-0 sm:h-screen sm:w-[560px] sm:border-l sm:border-ink-200
          bottom-0 left-0 right-0 max-h-[88vh] rounded-t-2xl sm:rounded-none
          pb-[env(safe-area-inset-bottom)]`}
        aria-hidden={!open}
      >
        {/* Mobile drag indicator */}
        <div className="sm:hidden flex justify-center pt-2 pb-1" onClick={onClose}>
          <span className="block w-10 h-1 rounded-full bg-ink-200" />
        </div>
        <header className="flex items-center justify-between px-5 py-3 border-b border-ink-100">
          <div className="flex items-center gap-2 min-w-0">
            <svg className="w-4 h-4 text-brand-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
            <h3 className="text-sm font-semibold text-ink-900 truncate">{title}</h3>
            <kbd className="ml-1 hidden sm:inline px-1.5 py-0.5 rounded bg-ink-100 text-2xs font-mono text-ink-500">⌘P</kbd>
          </div>
          <button onClick={onClose} className="btn-ghost text-base" aria-label="Fermer">×</button>
        </header>
        <div className="sm:h-[calc(100vh-49px)] max-h-[calc(88vh-90px)] sm:max-h-none overflow-y-auto px-5 py-5">
          {children}
        </div>
      </aside>
    </>
  );
}
