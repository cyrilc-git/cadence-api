import NewPostClient from './client';
import { getNotionPost } from '@/lib/notion';
import { suggestionsList } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function NewPostPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  let initial = null as null | { id?: string; title: string; pilier?: string; content: string; date?: string };
  if (searchParams.from) {
    const r = await getNotionPost(searchParams.from);
    if (r) initial = { id: r.summary.id, title: r.summary.title, pilier: r.summary.pilier, content: r.content };
  }
  let suggestBrief = searchParams.brief;
  let suggestPilier = searchParams.pilier || undefined;
  let suggestHook = searchParams.hook;
  // If no suggest in URL, auto-pick the top pending suggestion to seed the form
  if (!suggestBrief && !initial) {
    try {
      const top = await suggestionsList('pending', 1);
      if (top[0]) {
        suggestBrief = top[0].title;
        suggestPilier = top[0].pilier || undefined;
        suggestHook = top[0].hook || undefined;
      }
    } catch {}
  }
  if (!initial && suggestBrief) {
    initial = { title: suggestBrief.slice(0, 80), pilier: suggestPilier, content: suggestHook || '' };
  }
  if (searchParams.date) {
    initial = { ...(initial || { title: '', content: '' }), date: searchParams.date };
  }
  return <NewPostClient initial={initial} prefillBrief={suggestBrief} prefillHook={suggestHook} />;
}
