'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

type NavItem = { href: string; label: string; icon: IconName; group?: 'main' | 'editorial' | 'config' };

const NAV: NavItem[] = [
  { href: '/',                label: 'Dashboard',         icon: 'home',  group: 'main' },
  { href: '/suggestions',     label: 'Radar',             icon: 'spark', group: 'main' },
  { href: '/calendar',        label: 'Calendrier',        icon: 'cal',   group: 'main' },
  { href: '/posts',           label: 'Bibliothèque',      icon: 'doc',   group: 'main' },
  { href: '/posts/new',       label: 'Nouveau post',      icon: 'plus',  group: 'main' },
  { href: '/brand-dna',       label: 'Ligne éditoriale',  icon: 'star',  group: 'editorial' },
  { href: '/inspirations',    label: 'Inspirations',      icon: 'eye',   group: 'editorial' },
  { href: '/style-visuel',    label: 'Style visuel',      icon: 'palette', group: 'editorial' },
  { href: '/analytics',       label: 'Analytics',         icon: 'chart', group: 'editorial' },
  { href: '/sources',         label: 'Sources',           icon: 'plug',  group: 'config' },
  { href: '/settings',        label: 'Paramètres',        icon: 'gear',  group: 'config' }
];

type IconName = 'home'|'doc'|'plus'|'cal'|'star'|'eye'|'chart'|'spark'|'plug'|'gear'|'palette';

function Icon({ name }: { name: IconName }) {
  const cls = 'w-[18px] h-[18px] stroke-[1.6]';
  switch (name) {
    case 'home':    return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 11l9-8 9 8M5 10v10h14V10"/></svg>;
    case 'doc':     return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z M14 3v6h6 M9 14h6 M9 17h4"/></svg>;
    case 'plus':    return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14"/></svg>;
    case 'cal':     return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="5" width="18" height="16" rx="2"/><path strokeLinecap="round" d="M3 9h18 M8 3v4 M16 3v4"/></svg>;
    case 'star':    return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3l2.7 5.7 6.3.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.3-.9z"/></svg>;
    case 'eye':     return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'chart':   return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>;
    case 'spark':   return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>;
    case 'plug':    return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 2v6 M15 2v6 M6 8h12v3a6 6 0 01-6 6 6 6 0 01-6-6V8z M12 17v5"/></svg>;
    case 'gear':    return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3"/><path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33 1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.07.34.24.65.49.9.25.25.56.42.9.49H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
    case 'palette': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 22a10 10 0 110-20 10 10 0 014 19c-1 .5-2 0-2-1l1-2c.5-1-.5-2-1.5-1.5l-1 .5c-1 .5-2-.5-1.5-1.5l.5-1c.5-1-.5-2-1.5-1.5l-2 .5C5 14 4 13 4.5 12"/><circle cx="7.5" cy="9.5" r="1.5"/><circle cx="12" cy="6.5" r="1.5"/><circle cx="16.5" cy="9.5" r="1.5"/></svg>;
  }
  return null;
}

const SECTIONS: { key: string; label: string; group: NavItem['group'] }[] = [
  { key: 'main',      label: 'Cockpit',    group: 'main' },
  { key: 'editorial', label: 'Éditorial',  group: 'editorial' },
  { key: 'config',    label: 'Réglages',   group: 'config' }
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
      <aside className={`fixed top-0 left-0 z-20 h-screen w-64 bg-white border-r border-ink-200 transition-transform duration-300 ease-out-expo ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="hidden lg:flex items-center gap-3 h-16 px-5 border-b border-ink-100">
          <Logo />
          <div>
            <div className="font-semibold text-ink-900 leading-tight tracking-tight">Cadence</div>
            <div className="text-2xs text-ink-500 leading-tight font-medium uppercase tracking-wider">LinkedIn publishing</div>
          </div>
        </div>
        <nav className="px-3 py-3 lg:py-4 overflow-y-auto h-[calc(100vh-64px-72px)] pt-20 lg:pt-3 space-y-5">
          {SECTIONS.map(section => (
            <div key={section.key}>
              <div className="px-3 pb-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-400">{section.label}</div>
              <div className="space-y-0.5">
                {NAV.filter(n => n.group === section.group).map(item => {
                  const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${active ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-50 hover:text-ink-900'}`}>
                      <span className={active ? 'text-brand-600' : 'text-ink-400'}><Icon name={item.icon} /></span>
                      <span className="flex-1">{item.label}</span>
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 px-5 py-3.5 border-t border-ink-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-sm font-semibold">CC</div>
            <div className="flex-1 min-w-0">
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
  return (
    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M9 12 Q9 7 12 7 Q15 7 16 9 M9 12 Q9 17 12 17 Q15 17 16 15" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    </div>
  );
}
