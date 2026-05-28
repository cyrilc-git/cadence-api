import { redirect } from 'next/navigation';

// V51 §7 — Route morte. La génération de visuels (flux cœur n°3) se fait
// désormais dans l'éditeur ; la page « design visuel » autonome (réglages,
// patterns) n'est plus dans la nav. On redirige vers Écrire, là où les
// visuels se créent réellement.
export const dynamic = 'force-static';

export default function DesignVisuelRedirect() {
  redirect('/posts/new');
}
