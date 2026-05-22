'use client';

// V8.9.1 §E — Layout shell qui passe la sidebar en compact sur les surfaces
// d'écriture (/posts/new, /posts/[id]/edit).
// V11.4 §8 — Command palette globale ⌘K disponible sur toutes les pages,
// pas seulement dans l'éditeur. Navigation rapide Linear/Raycast-style.

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import CommandPalette, { Command } from './CommandPalette';

function isFocusRoute(p: string): boolean {
  if (p === '/posts/new') return true;
  if (/^\/posts\/[^/]+\/edit\/?$/.test(p)) return true;
  return false;
}

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const focus = isFocusRoute(pathname || '');
  const [cmdOpen, setCmdOpen] = useState(false);

  // ⌘K / Ctrl+K -> palette globale. ⌘1-4 navigation rapide. ⌘N nouveau post.
  // Tous skip si on est en focus d'écriture (l'éditeur gère ses propres).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (focus) return;
      const k = e.key.toLowerCase();
      // Ignorer les combinaisons avec Shift/Alt pour ne pas casser les
      // raccourcis natifs (⌘⇧K, etc.)
      if (e.shiftKey || e.altKey) return;
      if (k === 'k') { e.preventDefault(); setCmdOpen(o => !o); }
      else if (k === '1') { e.preventDefault(); router.push('/'); }
      else if (k === '2') { e.preventDefault(); router.push('/suggestions'); }
      else if (k === '3') { e.preventDefault(); router.push('/calendar'); }
      else if (k === '4') { e.preventDefault(); router.push('/cerveau'); }
      else if (k === 'n') {
        // ⌘N native = new window. On ne préempte pas. Skip.
        // (les utilisateurs voient le label dans la palette, c'est suffisant)
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus, router]);

  const commands: Command[] = [
    { id: 'go-dashboard',   label: 'Aller au tableau de bord',   shortcut: '⌘1', group: 'Naviguer',  perform: () => router.push('/') },
    { id: 'go-radar',       label: 'Ouvrir le radar',            shortcut: '⌘2', group: 'Naviguer',  perform: () => router.push('/suggestions') },
    { id: 'go-calendar',    label: 'Voir le calendrier',         shortcut: '⌘3', group: 'Naviguer',  perform: () => router.push('/calendar') },
    { id: 'go-memory',      label: 'Ouvrir la mémoire',          shortcut: '⌘4', group: 'Naviguer',  perform: () => router.push('/cerveau') },
    { id: 'go-library',     label: 'Aller à la bibliothèque',                    group: 'Naviguer',  perform: () => router.push('/posts') },
    { id: 'go-analytics',   label: 'Voir les analytics',                         group: 'Naviguer',  perform: () => router.push('/analytics') },
    { id: 'new-post',       label: 'Écrire un nouveau post',                     group: 'Action',    perform: () => router.push('/posts/new') },
    { id: 'inspirations',   label: 'Parcourir les inspirations',                 group: 'Naviguer',  perform: () => router.push('/inspirations') },
    { id: 'design',         label: 'Design visuel',                              group: 'Naviguer',  perform: () => router.push('/design-visuel') },
    { id: 'brand-dna',      label: 'Ligne éditoriale',                           group: 'Naviguer',  perform: () => router.push('/brand-dna') },
    { id: 'sources',        label: 'Sources',                                    group: 'Naviguer',  perform: () => router.push('/sources') },
    { id: 'settings',       label: 'Paramètres',                                 group: 'Naviguer',  perform: () => router.push('/settings') },
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar compact={focus} />
      <main className={`flex-1 transition-[padding] duration-200 ${focus ? 'lg:pl-12' : 'lg:pl-64'}`}>
        <div className={focus ? '' : 'px-5 py-7 lg:px-10 lg:py-9 max-w-6xl mx-auto'}>
          {children}
        </div>
      </main>
      {!focus && (
        <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} commands={commands} />
      )}
    </div>
  );
}
