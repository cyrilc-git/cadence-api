import NewPostClient from './client';
import ComposerClient from './composer';
import { getNotionPost } from '@/lib/notion';
import { listPostSummaries, EDITORIAL_SOURCE_TYPES } from '@/lib/content-items';
import { sanitizeForBrandVoice } from '@/lib/brand-config';

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
  // Routing du flux Écrire (V57) :
  // - /posts/new sans params        -> ComposerClient : la conversation avec Cadence
  // - /posts/new?brief=X (&pilier=) -> NewPostClient pré-rempli avec le brief
  // - /posts/new?from=Y (&recycle=) -> NewPostClient pré-rempli avec le post Y
  // - /posts/new?date=Z             -> NewPostClient avec la date imposée
  // L'utilisateur garde le contrôle sur ce qu'il voit en arrivant.
  // NB (V58.9) : StartHint (composant en bas de client.tsx) et la section
  // « À recycler » qu'il contient ne sont plus montés depuis V57. Le recyclage
  // n'a donc pas de surface vivante ici — chantier de revival à part.
  if (!initial && suggestBrief) {
    initial = { title: suggestBrief.slice(0, 80), pilier: suggestPilier, content: suggestHook || '' };
  }
  if (searchParams.date) {
    initial = { ...(initial || { title: '', content: '' }), date: searchParams.date };
  }

  // V57 — Sans contexte (ni brief, ni post à recycler/éditer), Écrire ouvre la
  // CONVERSATION avec Cadence : on discute, on demande des idées / des posts /
  // des infographies, puis on ouvre dans l'éditeur. Remplace l'ancien renvoi
  // vers Aujourd'hui (qui forçait à arriver avec un sujet déjà fait).
  if (!initial && !suggestBrief) {
    return <ComposerClient />;
  }

  // Provide list of recyclable posts (>6mo published) for "Créer à partir d'un ancien post"
  let recyclables: Array<{ id: string; title: string; pilier?: string; impressions?: number; published_at: string }> = [];
  try {
    // V58.8 — Recyclables lus depuis content_items (couche canonique) au lieu de
    // Notion deconnecte : la liste « recycler un ancien post » etait toujours vide
    // alors que 170+ posts LinkedIn reels y sont.
    const all = await listPostSummaries({ limit: 300, sourceTypes: EDITORIAL_SOURCE_TYPES });
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
