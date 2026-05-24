// V12.10 §8 — Page 404 globale. Évite l'écran Next.js par défaut quand
// un utilisateur tombe sur une URL inconnue (lien externe cassé, ancien
// signet d'une page renommée). Ton calme, propose les destinations
// usuelles.

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="space-y-8 max-w-2xl mx-auto pt-10">
      <header>
        <p className="text-2xs uppercase tracking-wider font-semibold text-ink-400">Erreur 404</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink-900 tracking-tight">Page introuvable</h1>
        <p className="mt-2 text-sm text-ink-500 leading-relaxed">
          Cette adresse n&apos;existe pas, ou a été déplacée. Pas grave, voici les pages les plus utiles pour repartir.
        </p>
      </header>

      <ul className="space-y-3">
        <li>
          <Link href="/" className="group flex items-baseline gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2 shrink-0" aria-hidden />
            <div>
              <div className="text-sm font-medium text-ink-900 group-hover:text-brand-700 transition">Tableau de bord</div>
              <div className="text-xs text-ink-500">Vue d&apos;ensemble du jour</div>
            </div>
          </Link>
        </li>
        <li>
          <Link href="/posts/new" className="group flex items-baseline gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2 shrink-0" aria-hidden />
            <div>
              <div className="text-sm font-medium text-ink-900 group-hover:text-brand-700 transition">Nouveau post</div>
              <div className="text-xs text-ink-500">Ouvrir l&apos;éditeur</div>
            </div>
          </Link>
        </li>
        <li>
          <Link href="/calendar" className="group flex items-baseline gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-ink-300 mt-2 shrink-0" aria-hidden />
            <div>
              <div className="text-sm font-medium text-ink-900 group-hover:text-brand-700 transition">Calendrier</div>
              <div className="text-xs text-ink-500">Planning des prochains jours</div>
            </div>
          </Link>
        </li>
        <li>
          <Link href="/posts" className="group flex items-baseline gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-ink-300 mt-2 shrink-0" aria-hidden />
            <div>
              <div className="text-sm font-medium text-ink-900 group-hover:text-brand-700 transition">Bibliothèque</div>
              <div className="text-xs text-ink-500">Tous vos posts</div>
            </div>
          </Link>
        </li>
      </ul>
    </div>
  );
}
