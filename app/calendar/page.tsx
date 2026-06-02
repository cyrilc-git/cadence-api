import CalendarClient from './client';
import { notionStatus } from '@/lib/notion';
import { listPostSummaries, ensureFreshContentItems } from '@/lib/content-items';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// V52 P0 — Le calendrier est la source de vérité : il affiche TOUS les posts
// par défaut (publiés, importés, programmés), quelle que soit leur provenance.
// Auparavant le défaut était FALSE, ce qui forçait le filtre source sur
// « linkedin » et vidait le calendrier alors que des dizaines de posts réels
// existaient. Le toggle design_system « calendar.show_notion » ne sert plus
// qu'à MASQUER explicitement (valeur « false ») si l'utilisateur le décide.
async function calendarShowNotion(): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('design_system')
      .select('value')
      .eq('key', 'calendar.show_notion')
      .maybeSingle();
    if (!data) return true;
    const v = String(data.value || '').toLowerCase().trim();
    return !(v === 'false' || v === '0' || v === 'off' || v === 'no');
  } catch {
    return true;
  }
}

// V11.1 — Calendrier lit la couche canonique content_items.
// V37.1 — searchParams ?d=YYYY-MM-DD ouvre le calendrier directement
// sur cette date (utilisé par le CTA post-import "Voir dans calendrier").
//        ?source=linkedin sélectionne le filtre source de départ.
export default async function CalendarPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const status = await notionStatus();
  if (!status.ok) {
    return (
      <div className="space-y-6 max-w-2xl">
        <header>
          <h1 className="text-2xl font-semibold text-ink-900 tracking-tight">Calendrier</h1>
          <p className="mt-1 text-sm text-ink-500 leading-relaxed">Notion ne répond pas pour l&apos;instant. Le calendrier ne peut pas charger les posts.</p>
        </header>
        <div className="border-l-2 border-danger-300 pl-4">
          <p className="text-sm text-ink-700 leading-relaxed">Vérifiez la connexion dans <a href="/sources" className="text-brand-700 hover:text-brand-900 transition">Sources</a>.</p>
        </div>
      </div>
    );
  }
  ensureFreshContentItems(120);
  const posts = await listPostSummaries({ limit: 500 });  // V37.1 — 500 pour absorber les imports historiques de plusieurs années
  const showNotion = await calendarShowNotion();

  // V37.1 — Parse query params pour navigation directe
  const rawD = typeof searchParams?.d === 'string' ? searchParams.d : null;
  const initialDate = rawD && /^\d{4}-\d{2}-\d{2}$/.test(rawD) ? rawD : null;
  const rawSource = typeof searchParams?.source === 'string' ? searchParams.source : null;
  const initialSource = (rawSource === 'linkedin' || rawSource === 'notion' || rawSource === 'all') ? rawSource : null;

  return <CalendarClient initialPosts={posts} showNotion={showNotion} initialDate={initialDate} initialSource={initialSource} />;
}
