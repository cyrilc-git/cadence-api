import NewPostClient from './client';
import { getNotionPost } from '@/lib/notion';

export const dynamic = 'force-dynamic';

export default async function NewPostPage({ searchParams }: { searchParams: { from?: string } }) {
  let initial = null as null | { id: string; title: string; pilier?: string; content: string };
  if (searchParams.from) {
    const r = await getNotionPost(searchParams.from);
    if (r) {
      initial = { id: r.summary.id, title: r.summary.title, pilier: r.summary.pilier, content: r.content };
    }
  }
  return <NewPostClient initial={initial} />;
}
