import InspirationsClient from './client';
import { inspirationsList, inspirationUpsert } from '@/lib/db';

export const dynamic = 'force-dynamic';

const SEEDS = [
  { name: 'Thomas Gasquez', url: 'https://www.linkedin.com/in/thomasgasquez/',  category: 'Build in public', score: 5, style_notes: 'Storytelling court, paragraphes ultra-aérés, première phrase punch.', do_not_copy: 'Ses anecdotes perso, ses chiffres précis, son ton humoristique signature.' },
  { name: 'Maxime Blasco',  url: 'https://www.linkedin.com/in/maximeblasco/',   category: 'Pédagogie SaaS',  score: 5, style_notes: 'Hook fort + 3 bullets + question à la fin. Très lisible mobile.', do_not_copy: 'Ses cas clients nommés, ses captures écran spécifiques, ses formats répétitifs.' },
  { name: 'Louis LeBlanc',  url: 'https://www.linkedin.com/in/louisleblanc/',   category: 'Opinion DAF',     score: 4, style_notes: 'Hot takes assumés, ton direct, jamais de jargon, position claire en 1ère phrase.', do_not_copy: 'Ses sujets niche, ses formules signature ("voici pourquoi…").' },
  { name: 'Nicolas Adam',   url: 'https://www.linkedin.com/in/nicolasadam/',    category: 'Cas client',      score: 4, style_notes: 'Anonymisation propre, raconte le déclic, chiffre la fin.', do_not_copy: 'Ses témoignages clients spécifiques, ses chiffres internes.' },
  { name: 'Rémi Douchet',   url: 'https://www.linkedin.com/in/remidouchet/',    category: 'Produit',         score: 4, style_notes: 'Présente une feature avec bénéfice utilisateur d\'abord, mécanique ensuite.', do_not_copy: 'Ses noms de feature, ses screenshots produit.' }
];

export default async function InspirationsPage() {
  let items: any[] = [];
  try { items = await inspirationsList(); } catch {}
  if (items.length === 0) {
    for (const s of SEEDS) {
      try { await inspirationUpsert(s as any); } catch {}
    }
    try { items = await inspirationsList(); } catch {}
  }
  return <InspirationsClient initial={items} />;
}
