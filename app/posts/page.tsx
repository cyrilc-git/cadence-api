import PostsLibraryClient from './client';
import { listNotionPosts, notionStatus } from '@/lib/notion';

export const dynamic = 'force-dynamic';

export default async function PostsLibraryPage() {
  const status = await notionStatus();
  if (!status.ok) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold text-ink-900">Bibliothèque</h1>
        <div className="bg-white rounded-2xl p-6 shadow-card ring-1 ring-inset ring-danger-500/20">
          <p className="text-sm text-danger-700">Notion inaccessible — voir <a href="/settings" className="underline">Connecteurs</a>.</p>
          <pre className="mt-2 text-xs text-ink-500 whitespace-pre-wrap">{('error' in status && status.error) || ''}</pre>
        </div>
      </div>
    );
  }
  const posts = await listNotionPosts(150);
  return <PostsLibraryClient initial={posts} />;
}
