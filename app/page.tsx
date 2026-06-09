import AujourdhuiClient from './aujourdhui-client';
import { nativeOpportunities, type EditorialOpportunity } from '@/lib/editorial-opportunities';
import { marketOpportunities, inspirationOpportunities } from '@/lib/external-radar';

// V52 commit 7 — La racine EST « Aujourd'hui », le produit principal.
// V52 Lot 2 — Opportunités internes natives (domaine Heelio).
// V52 Radar externe — Aujourd'hui mélange opportunités internes (Heelio) et
// externes (tendances FP&A, Fractional CFO, experts-comptables, SaaS finance,
// pilotage PME), au même format et dans le même flux. L'utilisateur ne sait pas
// d'où vient le sujet : il voit « voilà ce que je vous recommande de publier ».
// Rotation quotidienne déterministe. Aucun écran, aucune API, aucun score.
export const dynamic = 'force-dynamic';

export default async function HomePage({ searchParams }: { searchParams?: Record<string, string | undefined> }) {
  const skip = searchParams?.skip || null;

  // Rotation par jour (déterministe au sein de la journée, différente le lendemain).
  const dayIndex = Math.floor(new Date().getTime() / 86_400_000);
  const internal = nativeOpportunities(dayIndex);
  const market = marketOpportunities(dayIndex);
  const inspiration = inspirationOpportunities(dayIndex);

  // Héros : un angle interne fort (Heelio). « Autre idée » (?skip) le fait défiler.
  const heroPool = skip ? internal.filter(o => o.id !== skip) : internal;
  const hero = heroPool[0]
    ? { id: heroPool[0].id, title: heroPool[0].title, hook: heroPool[0].hook, why: heroPool[0].why, pilier: heroPool[0].type }
    : null;

  // Mélange : 1 marché + 1 inspiration + 1 interne (Heelio). Même format, même flux.
  const mix = [market[0], inspiration[0], heroPool[1]]
    .filter((o): o is EditorialOpportunity => Boolean(o));
  const opportunities = mix.slice(0, 3).map(o => ({
    id: o.id, title: o.title, hook: o.hook, why: o.why, pilier: o.type, stars: o.stars,
  }));

  const dateStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris',
  });
  const greeting = 'Bonjour Cyril. ' + dateStr.charAt(0).toUpperCase() + dateStr.slice(1) + '.';

  return <AujourdhuiClient greeting={greeting} when="demain à 9h" hero={hero} opportunities={opportunities} />;
}
