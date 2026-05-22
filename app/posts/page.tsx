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
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold text-ink-900">Bibliothèque</h1>
        <div className="bg-white rounded-2xl p-6 shadow-card ring-1 ring-inset ring-danger-500/20">
          <p className="text-sm text-danger-700">Notion inaccessible, voir <a href="/settings" className="underline">Connecteurs</a>.</p>
          <pre className="mt-2 text-xs text-ink-500 whitespace-pre-wrap">{('error' in status && status.error) || ''}</pre>
        </div>
      </div>
    );
  }
  ensureFreshContentItems(120);
  const posts = await listPostSummaries({ limit: 200 });
  return <PostsLibraryClient initial={posts} />;
}
