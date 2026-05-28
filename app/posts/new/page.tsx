import NewPostClient from './client';
import { getNotionPost, listNotionPosts } from '@/lib/notion';
import { sanitizeForBrandVoice } from '@/lib/brand-config';
import { suggestionsList } from '@/lib/db';

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

  // V51 §2 — Proposition proactive. Quand l'utilisateur arrive sur une page
  // vierge (pas de recyclage, pas de brief), Cadence propose UNE idée en
  // attente (la mieux notée) sous forme de bande discrète au-dessus de la zone
  // d'écriture. Remplace l'ancien dashboard "Aujourd'hui" sans réintroduire de
  // grille admin. ?skip=ID fait défiler vers la suivante.
  let proposal: { id: string; title: string; hook: string | null; why: string | null; pilier: string | null } | null = null;
  if (!initial && !suggestBrief) {
    try {
      const skip = searchParams.skip || null;
      const pending = await suggestionsList('pending', skip ? 4 : 1);
      const pick = pending.find(s => s.id !== skip) || null;
      if (pick) {
        proposal = {
          id: pick.id,
          title: sanitizeForBrandVoice(pick.title || ''),
          hook: pick.hook ? sanitizeForBrandVoice(pick.hook) : null,
          why: pick.why ? sanitizeForBrandVoice(pick.why) : null,
          pilier: pick.pilier || null,
        };
      }
    } catch {/* silent — pas de proposition, page vierge */}
  }

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
      proposal={proposal}
    />
  );
}
