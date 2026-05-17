'use client';

// V8.9.1 §E — Layout shell that switches sidebar to compact "focus mode"
// when on writing surfaces (/posts/new, /posts/[id]/edit).
// — Compact = icon rail w-12 + labels on hover (à la Linear / Arc).
// — Main padding adapts so the editor breathes.

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

function isFocusRoute(p: string): boolean {
  if (p === '/posts/new') return true;
  if (/^\/posts\/[^/]+\/edit\/?$/.test(p)) return true;
  return false;
}

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const focus = isFocusRoute(pathname || '');

  return (
    <div className="flex min-h-screen">
      <Sidebar compact={focus} />
      <main className={`flex-1 transition-[padding] duration-200 ${focus ? 'lg:pl-12' : 'lg:pl-64'}`}>
        <div className={focus ? '' : 'px-5 py-7 lg:px-10 lg:py-9 max-w-6xl mx-auto'}>
          {children}
        </div>
      </main>
    </div>
  );
}
