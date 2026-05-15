import NewPostClient from './client';
import { getNotionPost } from '@/lib/notion';
import { suggestionsList } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function NewPostPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  let initial = null as null | { id?: string; title: string; pilier?: string; content: string; date?: string };
  if (searchParams.from) {
    const r = await getNotionPost(searchParams.from);
    if (r) initial = { id: r.summary.id, title: r.summary.title, pilier: r.summary.pilier, content: searchParams.recycle ? '' : r.content };
  }
  let suggestBrief = searchParams.brief;
  let suggestPilier = searchParams.pilier || undefined;
  let suggestHook = searchParams.hook;
  let suggestSource: string | null = null;
  let suggestId: string | null = null;
  let suggestScore: number | null = null;

  // If no suggest in URL AND no 'from', auto-pick the top pending suggestion (excluding skipIds)
  const skipIdsRaw = searchParams.skip || '';
  const skipIds = skipIdsRaw.split(',').filter(Boolean);
  if (!suggestBrief && !initial) {
    try {
      const top = await suggestionsList('pending', 20);
      const picked = top.find(s => !skipIds.includes(s.id));
      if (picked) {
        suggestBrief = picked.title;
        suggestPilier = picked.pilier || undefined;
        suggestHook = picked.hook || undefined;
        suggestSource = picked.source;
        suggestId = picked.id;
        suggestScore = picked.score;
      }
    } catch {}
  }
  if (!initial && suggestBrief) {
    initial = { title: suggestBrief.slice(0, 80), pilier: suggestPilier, content: suggestHook || '' };
  }
  if (searchParams.date) {
    initial = { ...(initial || { title: '', content: '' }), date: searchParams.date };
  }
  return <NewPostClient initial={initial} prefillBrief={suggestBrief} prefillHook={suggestHook} suggestSource={suggestSource} suggestId={suggestId} suggestScore={suggestScore} suggestPilier={suggestPilier || null} />;
}
