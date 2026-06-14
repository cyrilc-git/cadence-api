import PostsLibraryClient from './client';
import { listPostSummaries, EDITORIAL_SOURCE_TYPES } from '@/lib/content-items';

export const dynamic = 'force-dynamic';

// V11.1 — Bibliothèque lit la couche canonique content_items.
// V55 — Plus de gate Notion (si Notion disparaît, la bibliothèque fonctionne) ;
// on n'affiche que l'éditorial (LinkedIn + Cadence), les notes/archives Notion
// ne polluent plus le flux.
export default async function PostsLibraryPage() {
  const posts = await listPostSummaries({ limit: 300, sourceTypes: EDITORIAL_SOURCE_TYPES });
  return <PostsLibraryClient initial={posts} />;
}
