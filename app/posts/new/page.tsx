import NewPostClient from './client';
import { getNotionPost, listNotionPosts } from '@/lib/notion';

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
  let suggestAngle: string | null = null;
  let suggestWhy: string | null = null;
  let suggestVisualIdea: string | null = null;
  let suggestSource: string | null = null;
  let suggestId: string | null = null;
  let suggestScore: number | null = null;

  // Source filter (V8): user can pick a specific source for auto-suggestion
  const filterSource = searchParams.source || null;
  // V14.5 — Plus d'auto-pick d'une suggestion quand l'utilisateur clique
  // "Nouveau post" sans paramètre. Avant : on injectait silencieusement le
  // hook de la suggestion #1 dans l'éditeur, donnant l'impression d'une
  // page cassée avec du texte aléatoire pré-rempli. Maintenant :
  // - /posts/new sans params -> page totalement vierge, StartHint visible
  // - /posts/new?suggest=X -> pré-rempli avec la suggestion choisie
  // - /posts/new?from=Y -> pré-rempli avec le post Y (recyclage)
  // L'utilisateur garde le contrôle sur ce qu'il voit en arrivant.
  if (!initial && suggestBrief) {
    initial = { title: suggestBrief.slice(0, 80), pilier: suggestPilier, content: suggestHook || '' };
  }
  if (searchParams.date) {
    initial = { ...(initial || { title: '', content: '' }), date: searchParams.date };
  }

  // Provide list of recyclable posts (>6mo published) for "Créer à partir d'un ancien post"
  let recyclables: Array<{ id: string; title: string; pilier?: string; impressions?: number; published_at: string }> = [];
  try {
    const all = await listNotionPosts(80);
    const sixMo = Date.now() - 1000 * 60 * 60 * 24 * 180;
    recyclables = all
      .filter(p => p.status === 'published' && p.scheduled_at && new Date(p.scheduled_at).getTime() < sixMo)
      .slice(0, 8)
      .map(p => ({ id: p.id, title: p.title, pilier: p.pilier, impressions: p.impressions, published_at: p.scheduled_at! }));
  } catch {/* silent */}

  return (
    <NewPostClient
      initial={initial}
      prefillBrief={suggestBrief}
      prefillHook={suggestHook}
      suggestSource={suggestSource}
      suggestId={suggestId}
      suggestScore={suggestScore}
      suggestPilier={suggestPilier || null}
      suggestAngle={suggestAngle}
      suggestWhy={suggestWhy}
      suggestVisualIdea={suggestVisualIdea}
      filterSource={filterSource}
      recyclables={recyclables}
    />
  );
}
