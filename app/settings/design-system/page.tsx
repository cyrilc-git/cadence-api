import { redirect } from 'next/navigation';

// V51 §7 — Route morte. L'éditeur de tokens design-system (puis /design-visuel)
// ne fait pas partie des 3 flux cœur : les visuels se créent désormais dans
// l'éditeur. On redirige directement vers Écrire pour éviter le double saut
// (l'ancienne cible /design-visuel redirige elle aussi vers /posts/new).
export const dynamic = 'force-static';

export default function DesignSystemRedirect() {
  redirect('/posts/new');
}
