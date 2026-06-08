import NewPostClient from './client';
import { getNotionPost, listNotionPosts } from '@/lib/notion';
import { sanitizeForBrandVoice } from '@/lib/brand-config';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function NewPostPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  let initial = null as null | { id?: string; title: string; pilier?: string; content: string; date?: string };
  if (searchParams.from) {
    const r = await getNotionPost(searchParams.from);
    if (r) initial = { id: r.summary.id, title: r.summary.title, pilier: r.summary.pilier, content: searchParams.recycle ? '' : r.content };
  }
  // V14.8 — Tout ce qui arrive via URL passe par le sanitize anti-pattern
  // (em-dash, smart quotes…). Empêche d'injecter une suggestion polluée
  // dans l'éditeur même si la DB suggestions contient encore des reliquats.
  let suggestBrief = searchParams.brief ? sanitizeForBrandVoice(searchParams.brief) : undefined;
  let suggestPilier = searchParams.pilier || undefined;
  let suggestHook = searchParams.hook ? sanitizeForBrandVoice(searchParams.hook) : undefined;
  let suggestWhy: string | null = null;
  let suggestSource: string | null = null;
  let suggestId: string | null = null;

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

  // V52 — Plus jamais de page blanche. Sans contexte (ni brief, ni post à
  // recycler/éditer), Cadence ne montre pas d'éditeur vide : on renvoie vers
  // Aujourd'hui, la surface de décision (reco du jour, dictée, opportunités).
  // /posts/new est désormais l'atelier, atteint TOUJOURS avec un sujet.
  if (!initial && !suggestBrief) {
    redirect('/');
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
      suggestPilier={suggestPilier || null}
      suggestWhy={suggestWhy}
      filterSource={filterSource}
      recyclables={recyclables}
      proposal={null}
    />
  );
}
