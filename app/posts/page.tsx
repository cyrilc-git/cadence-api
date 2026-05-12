import Link from 'next/link';
import PostCard from '@/components/PostCard';
import EmptyState from '@/components/EmptyState';
import StatusBadge from '@/components/StatusBadge';
import { listNotionPosts, notionStatus } from '@/lib/notion';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PostsPage() {
  const status = await notionStatus();
  if (!status.ok) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold text-ink-900">Posts</h1>
        <div className="bg-white rounded-2xl p-6 shadow-card ring-1 ring-inset ring-danger-500/20">
          <StatusBadge variant="danger">Notion inaccessible</StatusBadge>
          <p className="mt-3 text-sm text-ink-700">{('error' in status && status.error) || 'Erreur inconnue'}</p>
          <Link href="/settings" className="mt-3 inline-block text-sm text-brand-700 hover:text-brand-600 font-medium">Diagnostiquer dans Settings →</Link>
        </div>
      </div>
    );
  }
  const posts = await listNotionPosts(100);
  const drafts = posts.filter(p => p.status === 'draft');
  const scheduled = posts.filter(p => p.status === 'scheduled');
  const published = posts.filter(p => p.status === 'published');

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-ink-900">Posts</h1>
          <p className="mt-1 text-ink-500">{posts.length} posts dans la database Notion.</p>
        </div>
        <Link href="/posts/new" className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600">+ Nouveau</Link>
      </header>

      <Section title="À programmer" empty="Pas de drafts en attente." posts={drafts} />
      <Section title="Programmés" empty="Aucun post programmé pour le moment." posts={scheduled} />
      <Section title="Publiés" empty="Aucun post publié pour le moment." posts={published.slice(0, 25)} />
    </div>
  );
}

function Section({ title, posts, empty }: { title: string; posts: any[]; empty: string }) {
  return (
    <section>
      <h2 className="font-semibold text-ink-900 mb-3">{title} <span className="text-ink-500 font-normal">({posts.length})</span></h2>
      {posts.length === 0
        ? <EmptyState title={empty} />
        : <div className="grid gap-3">{posts.map(p => <PostCard key={p.id} post={{ ...p, excerpt: p.excerpt || '' }} />)}</div>}
    </section>
  );
}
