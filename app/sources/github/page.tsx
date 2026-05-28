import { redirect } from 'next/navigation';

// V51 §6 — La page GitHub exposait des variables d'environnement (GITHUB_TOKEN,
// GITHUB_REPOS) et un « bientôt » : deux interdits de la reprise produit. Les
// signaux GitHub ne servent pas les 3 flux cœur (écrire, programmer/publier,
// visuels), donc la source disparaît du hub. On garde une redirection pour ne
// pas casser les anciens favoris. (Suppression complète de la route en §7.)
export const dynamic = 'force-static';

export default function GitHubSourceRedirect() {
  redirect('/sources');
}
