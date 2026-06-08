import AujourdhuiClient from './aujourdhui-client';
import { nativeOpportunities } from '@/lib/editorial-opportunities';

// V52 commit 7 — La racine EST « Aujourd'hui », le produit principal : un
// directeur éditorial qui propose. Plus de redirection vers /posts/new.
// V52 Lot 2 — Les opportunités sont de vrais angles éditoriaux du domaine de
// Cyril (pilotage financier PME), disponibles sans LinkedIn/CRM/API. Rotation
// quotidienne déterministe. Aucun recyclage en façade, aucun score chiffré.
export const dynamic = 'force-dynamic';

export default async function HomePage({ searchParams }: { searchParams?: Record<string, string | undefined> }) {
  const skip = searchParams?.skip || null;

  // Rotation par jour (déterministe au sein de la journée, différente le lendemain).
  const dayIndex = Math.floor(new Date().getTime() / 86_400_000);
  const pool = nativeOpportunities(dayIndex);
  const visible = skip ? pool.filter(o => o.id !== skip) : pool;

  const hero = visible[0]
    ? { id: visible[0].id, title: visible[0].title, hook: visible[0].hook, why: visible[0].why, pilier: visible[0].type }
    : null;
  const opportunities = visible.slice(1, 4).map(o => ({
    id: o.id, title: o.title, hook: o.hook, why: o.why, pilier: o.type, stars: o.stars,
  }));

  const dateStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris',
  });
  const greeting = 'Bonjour Cyril. ' + dateStr.charAt(0).toUpperCase() + dateStr.slice(1) + '.';

  return <AujourdhuiClient greeting={greeting} when="demain à 9h" hero={hero} opportunities={opportunities} />;
}
