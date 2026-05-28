import { redirect } from 'next/navigation';

// V51 §7 — Route morte. La page « inspirations » autonome n'est plus dans la
// nav ; ces références nourrissent l'écriture en coulisses (l'éditeur lit
// /api/inspirations). On redirige vers Mémoire (/cerveau) qui regroupe
// l'intelligence éditoriale.
export const dynamic = 'force-static';

export default function InspirationsRedirect() {
  redirect('/cerveau');
}
