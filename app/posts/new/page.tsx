import NewPostClient from './client';
import { getNotionPost } from '@/lib/notion';

export const dynamic = 'force-dynamic';

export default async function NewPostPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  let initial = null as null | { id?: string; title: string; pilier?: string; content: string; date?: string };
  if (searchParams.from) {
    const r = await getNotionPost(searchParams.from);
    if (r) initial = { id: r.summary.id, title: r.summary.title, pilier: r.summary.pilier, content: r.content };
  }
  // Prefill from a suggestion
  const suggestBrief = searchParams.brief;
  const suggestPilier = searchParams.pilier || undefined;
  const suggestHook = searchParams.hook;
  if (!initial && suggestBrief) {
    initial = { title: suggestBrief.slice(0, 80), pilier: suggestPilier, content: suggestHook || '' };
  }
  if (searchParams.date) {
    initial = { ...(initial || { title: '', content: '' }), date: searchParams.date };
  }
  return <NewPostClient initial={initial} prefillBrief={suggestBrief} prefillHook={suggestHook} />;
}
