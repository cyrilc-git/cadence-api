import PostsLibraryClient from './client';
import { notionStatus } from '@/lib/notion';
import { listPostSummaries, ensureFreshContentItems } from '@/lib/content-items';

export const dynamic = 'force-dynamic';

// V11.1 — Bibliothèque lit la couche canonique content_items.
// Fraîcheur garantie par ensureFreshContentItems (fire-and-forget si > 2h).
export default async function PostsLibraryPage() {
  const status = await notionStatus();
  if (!status.ok) {
    return (
      <div className="space-y-6 max-w-2xl">
        <header>
          <h1 className="text-2xl font-semibold text-ink-900 tracking-tight">Bibliothèque</h1>
          <p className="mt-1 text-sm text-ink-500 leading-relaxed">Notion ne répond pas pour l&apos;instant. Vos posts ne peuvent pas être affichés.</p>
        </header>
        <div className="border-l-2 border-danger-300 pl-4">
          <p className="text-sm text-ink-700 leading-relaxed">Vérifiez la connexion dans <a href="/sources" className="text-brand-700 hover:text-brand-900 transition">Sources</a>.</p>
          {('error' in status && status.error) ? (
            <p className="mt-2 text-xs text-ink-500 break-all">{status.error}</p>
          ) : null}
        </div>
      </div>
    );
  }
  ensureFreshContentItems(120);
  const posts = await listPostSummaries({ limit: 200 });
  return <PostsLibraryClient initial={posts} />;
}
