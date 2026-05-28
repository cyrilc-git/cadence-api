import { redirect } from 'next/navigation';

// V51 §2 — La racine renvoie vers Écrire, le coeur du produit. Plus de
// dashboard "Aujourd'hui" : la proposition proactive (UNE idée en attente) est
// désormais intégrée directement dans /posts/new, sans grille admin ni KPI.
export const dynamic = 'force-dynamic';

export default function HomePage() {
  redirect('/posts/new');
}
