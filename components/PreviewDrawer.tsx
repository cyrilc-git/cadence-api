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
      {/* Drawer */}
      <aside
        className={`fixed top-0 right-0 z-40 h-screen w-full sm:w-[560px] bg-white border-l border-ink-200 shadow-elev transform transition-transform duration-300 ease-out-expo ${open ? 'translate-x-0' : 'translate-x-full'}`}
        aria-hidden={!open}
      >
        <header className="flex items-center justify-between px-5 py-3 border-b border-ink-100">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
            <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
            <kbd className="ml-1 px-1.5 py-0.5 rounded bg-ink-100 text-2xs font-mono text-ink-500">⌘P</kbd>
          </div>
          <button onClick={onClose} className="btn-ghost text-sm" aria-label="Fermer">×</button>
        </header>
        <div className="h-[calc(100vh-49px)] overflow-y-auto px-5 py-5">
          {children}
        </div>
      </aside>
    </>
  );
}
