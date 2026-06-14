import CalendarClient from './client';
import { listPostSummaries, EDITORIAL_SOURCE_TYPES } from '@/lib/content-items';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// V52 P0 — Le calendrier est la source de vérité.
// V55 — content_items EST la source. Plus de dépendance Notion : si Notion
// disparaît, le calendrier fonctionne. On n'affiche que l'éditorial (LinkedIn +
// Cadence) ; les notes/archives Notion ne polluent plus le flux. Le toggle
// design_system « calendar.show_notion » survit pour réafficher le legacy si besoin.
async function calendarShowNotion(): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('design_system')
      .select('value')
      .eq('key', 'calendar.show_notion')
      .maybeSingle();
    if (!data) return false; // V55 — défaut : Notion masqué du flux principal
    const v = String(data.value || '').toLowerCase().trim();
    return v === 'true' || v === '1' || v === 'on' || v === 'yes';
  } catch {
    return false;
  }
}

export default async function CalendarPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const showNotion = await calendarShowNotion();
  // Sans Notion par défaut ; le legacy Notion n'est rechargé que si explicitement demandé.
  const posts = await listPostSummaries({
    limit: 500,
    sourceTypes: showNotion ? undefined : EDITORIAL_SOURCE_TYPES,
  });

  // V37.1 — ?d=YYYY-MM-DD ouvre le calendrier sur cette date ; ?source= filtre.
  const rawD = typeof searchParams?.d === 'string' ? searchParams.d : null;
  const initialDate = rawD && /^\d{4}-\d{2}-\d{2}$/.test(rawD) ? rawD : null;
  const rawSource = typeof searchParams?.source === 'string' ? searchParams.source : null;
  const initialSource = (rawSource === 'linkedin' || rawSource === 'notion' || rawSource === 'all') ? rawSource : null;

  return <CalendarClient initialPosts={posts} showNotion={showNotion} initialDate={initialDate} initialSource={initialSource} />;
}
