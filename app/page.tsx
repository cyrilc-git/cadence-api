import AujourdhuiClient from './aujourdhui-client';
import { nativeOpportunities, type EditorialOpportunity } from '@/lib/editorial-opportunities';
import { marketOpportunities, inspirationOpportunities } from '@/lib/external-radar';
import { editorialMemoryOpportunities } from '@/lib/editorial-memory';

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

  // Mémoire éditoriale : Cadence apprend Cyril à partir de son historique réel.
  // Lecture seule, sans OpenAI ; [] si le corpus est trop maigre. On exclut le
  // thème du héros pour ne jamais proposer deux fois le même sujet le même jour.
  const memory = await editorialMemoryOpportunities(dayIndex, {
    excludeText: hero ? `${hero.title} ${hero.hook || ''}` : '',
  });

  // Mélange : 1 mémoire (ce que Cadence a appris de Cyril) + 1 marché + 1
  // inspiration, complété par un 2e angle interne si la mémoire est muette.
  // Même format, même flux : l'utilisateur ne sait pas d'où vient le sujet.
  // Dédup par titre : aucune carte ne répète le héros ni une autre carte.
  const seen = new Set<string>();
  if (hero) seen.add(hero.title.trim().toLowerCase());
  const mix = [memory[0], market[0], inspiration[0], heroPool[1]]
    .filter((o): o is EditorialOpportunity => Boolean(o))
    .filter(o => {
      const k = o.title.trim().toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  const opportunities = mix.slice(0, 3).map(o => ({
    id: o.id, title: o.title, hook: o.hook, why: o.why, pilier: o.type, stars: o.stars,
  }));

  const dateStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris',
  });
  const greeting = 'Bonjour Cyril. ' + dateStr.charAt(0).toUpperCase() + dateStr.slice(1) + '.';

  return <AujourdhuiClient greeting={greeting} when="demain à 9h" hero={hero} opportunities={opportunities} />;
}
