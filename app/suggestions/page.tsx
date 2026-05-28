import { redirect } from 'next/navigation';

// V51 §7 — Route morte. Les suggestions de sujets servent l'écriture : on
// les rabat sur Écrire (/posts/new) plutôt que de garder une page orpheline.
// Le lien interne (Mémoire → « voir suggestions ») pointe maintenant vers Écrire.
export const dynamic = 'force-static';

export default function SuggestionsRedirect() {
  redirect('/posts/new');
}
