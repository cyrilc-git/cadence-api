'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const NAV = [
  { href: '/',             label: 'Dashboard',    icon: 'home'  },
  { href: '/suggestions',  label: 'Suggestions',  icon: 'spark' },
  { href: '/posts/new',    label: 'Nouveau post', icon: 'plus'  },
  { href: '/posts',        label: 'Bibliothèque', icon: 'doc'   },
  { href: '/calendar',     label: 'Calendrier',   icon: 'cal'   },
  { href: '/brand-dna',    label: 'Brand DNA',    icon: 'star'  },
  { href: '/inspirations', label: 'Inspirations', icon: 'eye'   },
  { href: '/analytics',    label: 'Analytics',    icon: 'chart' },
  { href: '/settings',     label: 'Connecteurs',  icon: 'plug'  }
];

function Icon({ name }: { name: string }) {
  const cls = 'w-4 h-4 stroke-[1.6]';
  switch (name) {
    case 'home':  return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 11l9-8 9 8M5 10v10h14V10"/></svg>;
    case 'doc':   return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z M14 3v6h6 M9 14h6 M9 17h4"/></svg>;
    case 'plus':  return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14"/></svg>;
    case 'cal':   return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="5" width="18" height="16" rx="2"/><path strokeLinecap="round" d="M3 9h18 M8 3v4 M16 3v4"/></svg>;
    case 'star':  return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3l2.7 5.7 6.3.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.3-.9z"/></svg>;
    case 'eye':   return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'chart': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>;
    case 'spark': return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>;
    case 'plug':  return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 2v6 M15 2v6 M6 8h12v3a6 6 0 01-6 6 6 6 0 01-6-6V8z M12 17v5"/></svg>;
  }
  return null;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 px-4 flex items-center justify-between bg-white border-b border-ink-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold">C</div>
          <span className="font-semibold text-ink-900">Cadence</span>
        </div>
        <button onClick={() => setOpen(o => !o)} aria-label="Menu" className="p-2 rounded-md hover:bg-ink-100">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open
              ? <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18"/>
              : <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16"/>}
          </svg>
        </button>
      </header>

      <aside className={`fixed top-0 left-0 z-20 h-screen w-64 bg-white border-r border-ink-100 transition-transform
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="hidden lg:flex items-center gap-3 h-16 px-6 border-b border-ink-100">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-lg">C</div>
          <div>
            <div className="font-semibold text-ink-900 leading-tight">Cadence</div>
            <div className="text-xs text-ink-500 leading-tight">LinkedIn publishing</div>
          </div>
        </div>

        <nav className="px-3 py-4 lg:py-6 space-y-1 overflow-y-auto h-[calc(100vh-64px)] pt-20 lg:pt-0">
          {NAV.map(item => {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition
                  ${active ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-50 hover:text-ink-900'}`}>
                <Icon name={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 px-6 py-4 border-t border-ink-100 text-xs text-ink-500">
          <div className="font-medium text-ink-700">Cyril Coulange</div>
          <div>cyril@heelio.io</div>
        </div>
      </aside>

      {open && <div onClick={() => setOpen(false)} className="lg:hidden fixed inset-0 z-10 bg-ink-900/40 backdrop-blur-sm" />}
      <div className="lg:hidden h-14" />
    </>
  );
}
