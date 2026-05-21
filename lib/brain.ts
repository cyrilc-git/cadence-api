// V9.2 §1 — Mémoire éditoriale visible.
// Agrège tout ce que Cadence sait : posts indexés, sources, couverture piliers, sujets dominants/oubliés, recyclables.
// Sortie pensée pour une page prose calme. Aucune donnée fabriquée : si vide, on dit "rien à montrer".

import { supabase } from './supabase';
import { indexedCount } from './embeddings';
import { pilierStats, trackedTopicStatus, computeRadarInsights, TRACKED_TOPICS, type PilierStat, type RadarInsight } from './radar-insights';

export type BrainSourceBreakdown = {
  source: string;
  label: string;
  count: number;
};

export type BrainTopic = {
  topic: string;
  lastDays: number | null;
  count60d: number;
};

export type BrainUncertainty = {
  kind: 'no_linkedin_import' | 'no_analytics' | 'orphan_published' | 'embeddings_stale' | 'low_volume';
  message: string;
  severity: 'low' | 'medium' | 'high';
};

export type BrainRecyclable = {
  id: string;
  source: string;
  source_ref: string;
  title: string;
  pilier: string | null;
  scheduledAt: string | null;
  daysSince: number;
};

export type BrainState = {
  // Méta indexation
  totalIndexed: number;
  sources: BrainSourceBreakdown[];
  lastIndexedAt: string | null;
  oldestPostAt: string | null;
  newestPostAt: string | null;
  publishedKnown: number;
  draftKnown: number;

  // V9.2 §2.5 — Distinction provenance certifiée vs déduite
  confirmedCount: number;          // Imports LinkedIn ZIP + publis confirmées URL
  inferredCount: number;           // Notion brouillons / archives non certifiées
  confirmedSources: BrainSourceBreakdown[];
  inferredSources: BrainSourceBreakdown[];

  // V9.5 — Couverture par source + zones d'incertitude
  coverage: {
    linkedinCount: number;         // imports LinkedIn (archive)
    notionCount: number;           // posts indexés depuis Notion
    embeddingsTotal: number;       // total indexé
    confirmedPct: number;          // 0-100, ratio confirmedCount / total
  };
  uncertainties: BrainUncertainty[];

  // Couverture
  piliers: PilierStat[];
  pilierActiveCount: number;
  pilierSilentCount: number;

  // Sujets
  topicsDominant: BrainTopic[];   // count60d desc, count60d > 0
  topicsForgotten: BrainTopic[];  // lastDays > 21 ou jamais publié
  topicsNeverPublished: string[]; // jamais touchés

  // Recyclables : publiés depuis > 90j
  recyclables: BrainRecyclable[];

  // Saturation : top topic 60j si élevé
  saturationNote: string | null;

  // Opportunité principale (1 insight) + autres
  topInsight: RadarInsight | null;
  otherInsights: RadarInsight[];

  // Sources non connectées vues comme angle mort
  unknownSources: { kind: string; label: string }[];
};

const SOURCE_LABELS: Record<string, string> = {
  notion: 'Notion',
  linkedin_archive: 'archive LinkedIn',
  inspiration: 'inspirations',
  manual: 'saisie directe',
};

const PRIORITY: Record<RadarInsight['kind'], number> = {
  topic_never: 1,
  pilier_silence: 2,
  topic_saturated: 3,
  topic_recyclable: 4,
  angle_winning: 5,
  low_data: 9,
};

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

export async function computeBrainState(unknownSourcesInput?: { kind: string; label: string }[]): Promise<BrainState> {
  // 1. Comptage et répartition par source
  const total = await indexedCount();

  const { data: bySource } = await supabase
    .from('post_embeddings')
    .select('source, status, scheduled_at, indexed_at')
    .order('indexed_at', { ascending: false })
    .limit(2000);

  const sourceCounts: Record<string, number> = {};
  let lastIndexedAt: string | null = null;
  let oldestPostAt: string | null = null;
  let newestPostAt: string | null = null;
  let publishedKnown = 0;
  let draftKnown = 0;

  for (const row of bySource || []) {
    const s = row.source || 'inconnue';
    sourceCounts[s] = (sourceCounts[s] || 0) + 1;
    if (!lastIndexedAt && row.indexed_at) lastIndexedAt = row.indexed_at;
    if (row.scheduled_at) {
      if (!oldestPostAt || row.scheduled_at < oldestPostAt) oldestPostAt = row.scheduled_at;
      if (!newestPostAt || row.scheduled_at > newestPostAt) newestPostAt = row.scheduled_at;
    }
    if (row.status === 'published') publishedKnown++;
    else if (row.status === 'draft') draftKnown++;
  }

  const sources: BrainSourceBreakdown[] = Object.entries(sourceCounts)
    .map(([source, count]) => ({ source, label: SOURCE_LABELS[source] || source, count }))
    .sort((a, b) => b.count - a.count);

  // V9.2 §2.5 — Provenance certifiée vs déduite
  // confirmed : archive LinkedIn (la seule certaine au niveau embeddings actuel)
  // inferred  : tout le reste (Notion, inspiration, manual sans signal LinkedIn)
  const CONFIRMED_SOURCES = new Set(['linkedin_archive']);
  const confirmedSources = sources.filter(s => CONFIRMED_SOURCES.has(s.source));
  const inferredSources = sources.filter(s => !CONFIRMED_SOURCES.has(s.source));
  const confirmedCount = confirmedSources.reduce((a, b) => a + b.count, 0);
  const inferredCount = inferredSources.reduce((a, b) => a + b.count, 0);

  // 2. Piliers
  let piliers: PilierStat[] = [];
  try { piliers = await pilierStats(); } catch { piliers = []; }
  const pilierActiveCount = piliers.filter(p => p.daysSinceLast !== null && p.daysSinceLast <= 14).length;
  const pilierSilentCount = piliers.filter(p => p.count === 0 || (p.daysSinceLast !== null && p.daysSinceLast > 14)).length;

  // 3. Sujets suivis
  let topics: BrainTopic[] = [];
  try { topics = await trackedTopicStatus(); } catch { topics = []; }
  const topicsDominant = [...topics]
    .filter(t => t.count60d > 0)
    .sort((a, b) => b.count60d - a.count60d)
    .slice(0, 5);
  const topicsForgotten = topics
    .filter(t => t.lastDays !== null && t.lastDays > 21)
    .sort((a, b) => (b.lastDays || 0) - (a.lastDays || 0));
  const topicsNeverPublished = topics
    .filter(t => t.lastDays === null)
    .map(t => t.topic);

  // 4. Recyclables : posts publiés depuis plus de 90 jours
  const ninety = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const { data: recyclablesRaw } = await supabase
    .from('post_embeddings')
    .select('id, source, source_ref, title, pilier, scheduled_at')
    .eq('status', 'published')
    .lt('scheduled_at', ninety)
    .order('scheduled_at', { ascending: false })
    .limit(8);
  const recyclables: BrainRecyclable[] = (recyclablesRaw || [])
    .map(r => ({
      id: r.id as string,
      source: r.source as string,
      source_ref: r.source_ref as string,
      title: (r.title as string) || 'Sans titre',
      pilier: (r.pilier as string) || null,
      scheduledAt: r.scheduled_at as string | null,
      daysSince: daysAgo(r.scheduled_at as string) || 0,
    }))
    .filter(r => r.daysSince >= 90)
    .slice(0, 5);

  // 5. Saturation : si un topic dépasse 4 posts sur 60j, on le signale
  let saturationNote: string | null = null;
  const oversaturated = topics.filter(t => t.count60d > 4).sort((a, b) => b.count60d - a.count60d);
  if (oversaturated.length === 1) {
    saturationNote = `${oversaturated[0].topic} occupe ${oversaturated[0].count60d} de vos derniers posts. Reposer le sujet une à deux semaines aiderait à varier la perception.`;
  } else if (oversaturated.length > 1) {
    const list = oversaturated.slice(0, 3).map(t => `${t.topic} (${t.count60d})`).join(', ');
    saturationNote = `Trois sujets concentrent vos publications récentes : ${list}. Un angle nouveau ferait du bien.`;
  }

  // 6. Opportunités du moment
  let insights: RadarInsight[] = [];
  try { insights = await computeRadarInsights(); } catch { insights = []; }
  const sorted = [...insights].sort((a, b) => (PRIORITY[a.kind] || 99) - (PRIORITY[b.kind] || 99));
  const topInsight = sorted[0] || null;
  const otherInsights = sorted.slice(1, 4);

  // V9.5 — Couverture
  const linkedinCount = sourceCounts['linkedin_archive'] || 0;
  const notionCount = sourceCounts['notion'] || 0;
  const confirmedPct = total > 0 ? Math.round((confirmedCount / total) * 100) : 0;

  // V9.5 — Zones d'incertitude : ce que Cadence ne peut pas certifier
  const uncertainties: BrainUncertainty[] = [];
  if (total < 10) {
    uncertainties.push({
      kind: 'low_volume',
      severity: 'high',
      message: `Seulement ${total} post${total > 1 ? 's' : ''} en mémoire. Les patterns détectés ne sont pas représentatifs tant que vous n'avez pas indexé une trentaine de posts.`,
    });
  }
  if (linkedinCount === 0 && notionCount > 0) {
    uncertainties.push({
      kind: 'no_linkedin_import',
      severity: 'high',
      message: 'Aucun import LinkedIn n\'a été fait. Cadence ne peut pas certifier ce qui a réellement été publié ni mesurer les performances réelles.',
    });
  }
  // Posts Notion publiés sans URL : compte via notionPosts si on en a déjà chargés ailleurs.
  // Approximation côté embeddings : status published mais source notion (déduit, pas confirmé).
  const orphanPublished = (bySource || []).filter((r: any) => r.source === 'notion' && r.status === 'published').length;
  if (orphanPublished >= 3) {
    uncertainties.push({
      kind: 'orphan_published',
      severity: 'medium',
      message: `${orphanPublished} posts Notion sont marqués publié sans URL LinkedIn vérifiée. Ils restent en archive Notion, pas en publication confirmée.`,
    });
  }
  if (lastIndexedAt) {
    const daysSinceIndex = Math.floor((Date.now() - new Date(lastIndexedAt).getTime()) / 86_400_000);
    if (daysSinceIndex > 14) {
      uncertainties.push({
        kind: 'embeddings_stale',
        severity: 'low',
        message: `La dernière indexation date d'il y a ${daysSinceIndex} jours. Une réindexation rendra le radar et les insights plus pertinents.`,
      });
    }
  }
  // Analytics manquantes : approximation via post_embeddings.meta?.impressions
  const { count: withImpressions } = await supabase
    .from('post_embeddings')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published')
    .not('meta->impressions', 'is', null);
  const publishedTotal = publishedKnown;
  if (publishedTotal > 0 && (withImpressions || 0) < publishedTotal * 0.3) {
    uncertainties.push({
      kind: 'no_analytics',
      severity: 'medium',
      message: `Cadence connaît les impressions de ${withImpressions || 0} post${(withImpressions || 0) > 1 ? 's' : ''} sur ${publishedTotal} publiés. Les patterns de performance restent partiels.`,
    });
  }

  return {
    totalIndexed: total,
    sources,
    lastIndexedAt,
    oldestPostAt,
    newestPostAt,
    publishedKnown,
    draftKnown,
    confirmedCount,
    inferredCount,
    confirmedSources,
    inferredSources,
    coverage: {
      linkedinCount,
      notionCount,
      embeddingsTotal: total,
      confirmedPct,
    },
    uncertainties,
    piliers,
    pilierActiveCount,
    pilierSilentCount,
    topicsDominant,
    topicsForgotten,
    topicsNeverPublished,
    recyclables,
    saturationNote,
    topInsight,
    otherInsights,
    unknownSources: unknownSourcesInput || [],
  };
}

// Helper format date FR court : "le 14 mars 2025" → utilisé côté page.
export function formatDateFr(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return iso; }
}

// Re-export pour usage page (évite import croisé direct)
export { TRACKED_TOPICS };
