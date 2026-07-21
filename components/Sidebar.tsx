'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

type IconName = 'today' | 'pen' | 'cal' | 'doc' | 'plug' | 'brain';
type NavItem = { href: string; label: string; icon: IconName };

// V52 — Navigation réduite. Le calendrier est l'unique source de vérité des posts.
// V58.8 — Ajout « Aujourd'hui » (racine /) en tête : c'est le produit principal
// (recos du jour) mais il était injoignable depuis la navigation. Le logo pointe
// aussi vers la racine.
const NAV: NavItem[] = [
  { href: '/',          label: "Aujourd'hui", icon: 'today' },
  { href: '/posts/new', label: 'Écrire',       icon: 'pen' },
  { href: '/calendar',  label: 'Calendrier',   icon: 'cal' },
  { href: '/sources',   label: 'Sources',      icon: 'plug' },
  { href: '/cerveau',   label: 'Mémoire',      icon: 'brain' },
];

function Icon({ name }: { name: IconName }) {
  const cls = 'w-[18px] h-[18px] stroke-[1.6]';
  switch (name) {
    case 'today': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="4"/><path strokeLinecap="round" d="M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M19.1 4.9l-1.4 1.4 M6.3 17.7l-1.4 1.4"/></svg>;
    case 'pen':   return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9 M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4z"/></svg>;
    case 'cal':   return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="5" width="18" height="16" rx="2"/><path strokeLinecap="round" d="M3 9h18 M8 3v4 M16 3v4"/></svg>;
    case 'doc':   return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z M14 3v6h6 M9 14h6 M9 17h4"/></svg>;
    case 'plug':  return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 2v6 M15 2v6 M6 8h12v3a6 6 0 01-6 6 6 6 0 01-6-6V8z M12 17v5"/></svg>;
    case 'brain': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 4a3 3 0 00-3 3v1a3 3 0 00-2 2.83V13a3 3 0 002 2.83V17a3 3 0 003 3h1V4H9z M15 4a3 3 0 013 3v1a3 3 0 012 2.83V13a3 3 0 01-2 2.83V17a3 3 0 01-3 3h-1V4h1z M12 8v8 M9 10h1.5 M13.5 10H15 M9 14h1.5 M13.5 14H15"/></svg>;
  }
  return null;
}

export default function Sidebar({ compact = false }: { compact?: boolean } = {}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Un seul item actif à la fois : le href le plus spécifique gagne.
  const sortedByDepth = [...NAV].sort((a, b) => b.href.length - a.href.length);
  const activeHref = sortedByDepth.find(item =>
    pathname === item.href || (item.href !== '/' && (pathname || '').startsWith(item.href + '/'))
  )?.href;

  return (
    <>
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 px-4 flex items-center justify-between bg-white/90 backdrop-blur border-b border-ink-200">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="font-semibold text-ink-900 tracking-tight">Cadence</span>
        </div>
        <button onClick={() => setOpen(o => !o)} aria-label="Menu" className="btn-ghost">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18"/> : <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16"/>}
          </svg>
        </button>
      </header>

      {/* Sidebar */}
      <aside className={`group/sidebar fixed top-0 left-0 z-20 h-screen bg-white border-r border-ink-200 transition-all duration-300 ease-out-expo ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 ${compact ? 'w-64 lg:w-12 lg:hover:w-64' : 'w-64'}`}>
        <div className={`hidden lg:flex items-center gap-3 h-16 border-b border-ink-100 ${compact ? 'lg:px-2 lg:justify-center lg:group-hover/sidebar:justify-start lg:group-hover/sidebar:px-5' : 'px-5'}`}>
          <Logo />
          <div className={`${compact ? 'lg:hidden lg:group-hover/sidebar:block' : ''}`}>
            <div className="font-semibold text-ink-900 leading-tight tracking-tight whitespace-nowrap">Cadence</div>
            <div className="text-2xs text-ink-500 leading-tight whitespace-nowrap">éditorial LinkedIn</div>
          </div>
        </div>
        <nav className={`overflow-y-auto h-[calc(100vh-64px-72px)] pt-20 lg:pt-4 space-y-0.5 ${compact ? 'lg:px-1 lg:group-hover/sidebar:px-3 px-3 py-3 lg:py-4' : 'px-3 py-3 lg:py-4'}`}>
          {NAV.map(item => {
            const active = item.href === activeHref;
            return (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} title={compact ? item.label : undefined}
                className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-colors duration-150 ${active ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-50 hover:text-ink-900'} ${compact ? 'lg:px-2.5 lg:py-2 lg:justify-center lg:group-hover/sidebar:justify-start lg:group-hover/sidebar:px-3 px-3 py-2' : 'px-3 py-2'}`}>
                <span className={active ? 'text-brand-600' : 'text-ink-400'}><Icon name={item.icon} /></span>
                <span className={`flex-1 truncate ${compact ? 'lg:hidden lg:group-hover/sidebar:inline' : ''}`}>{item.label}</span>
                {active && <span className={`w-1.5 h-1.5 rounded-full bg-brand-500 ${compact ? 'lg:hidden lg:group-hover/sidebar:block' : ''}`} />}
              </Link>
            );
          })}
        </nav>
        <div className={`absolute bottom-0 left-0 right-0 border-t border-ink-100 bg-white ${compact ? 'lg:px-2 lg:py-2 lg:group-hover/sidebar:px-5 lg:group-hover/sidebar:py-3.5 px-5 py-3.5' : 'px-5 py-3.5'}`}>
          <div className={`flex items-center gap-3 ${compact ? 'lg:justify-center lg:group-hover/sidebar:justify-start' : ''}`} title={compact ? 'Cyril Coulange · cyril@heelio.io' : undefined}>
            <div className="w-9 h-9 rounded-full bg-ink-100 text-ink-700 flex items-center justify-center text-sm font-semibold shrink-0 ring-1 ring-inset ring-ink-200">CC</div>
            <div className={`flex-1 min-w-0 ${compact ? 'lg:hidden lg:group-hover/sidebar:block' : ''}`}>
              <div className="text-sm font-medium text-ink-900 leading-tight truncate">Cyril Coulange</div>
              <div className="text-xs text-ink-500 leading-tight truncate">cyril@heelio.io</div>
            </div>
          </div>
        </div>
      </aside>

      {open && <div onClick={() => setOpen(false)} className="lg:hidden fixed inset-0 z-10 bg-ink-900/30 backdrop-blur-sm animate-fade-in" />}
      <div className="lg:hidden h-14" />
    </>
  );
}

function Logo() {
  // V58.8 — Le logo renvoie à « Aujourd'hui » (racine), convention attendue.
  return (
    <Link href="/" aria-label="Aujourd'hui" className="w-9 h-9 rounded-xl bg-ink-900 flex items-center justify-center shrink-0">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M9 12 Q9 7 12 7 Q15 7 16 9 M9 12 Q9 17 12 17 Q15 17 16 15" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    </Link>
  );
}
