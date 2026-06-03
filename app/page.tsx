import AujourdhuiClient from './aujourdhui-client';
import { suggestionsList } from '@/lib/db';
import { sanitizeForBrandVoice } from '@/lib/brand-config';

// V52 commit 7 — La racine EST « Aujourd'hui », le produit principal : un
// directeur éditorial qui propose. Plus de redirection vers /posts/new.
// Données réelles depuis le moteur de propositions (radar) ; aucun faux état.
export const dynamic = 'force-dynamic';

function starsFor(score?: number | null): number {
  const s = typeof score === 'number' ? score : 0;
  return s >= 80 ? 5 : s >= 70 ? 4 : 3;
}

export default async function HomePage({ searchParams }: { searchParams?: Record<string, string | undefined> }) {
  const skip = searchParams?.skip || null;

  let pending: any[] = [];
  try { pending = await suggestionsList('pending', 8); } catch { /* silent : page reste accueillante */ }

  const items = pending.map((p: any) => ({
    id: p.id,
    title: sanitizeForBrandVoice(p.title || ''),
    hook: p.hook ? sanitizeForBrandVoice(p.hook) : null,
    why: p.why ? sanitizeForBrandVoice(p.why) : null,
    pilier: p.pilier || null,
    score: p.score,
  }));

  const visible = skip ? items.filter(i => i.id !== skip) : items;

  const hero = visible[0]
    ? { id: visible[0].id, title: visible[0].title, hook: visible[0].hook, why: visible[0].why, pilier: visible[0].pilier }
    : null;
  const opportunities = visible.slice(1, 4).map(o => ({
    id: o.id, title: o.title, why: o.why, pilier: o.pilier, stars: starsFor(o.score),
  }));

  const dateStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris',
  });
  const greeting = 'Bonjour Cyril. ' + dateStr.charAt(0).toUpperCase() + dateStr.slice(1) + '.';

  return <AujourdhuiClient greeting={greeting} when="demain à 9h" hero={hero} opportunities={opportunities} />;
}
