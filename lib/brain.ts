// V9.2 §1 — Mémoire éditoriale visible.
// Agrège tout ce que Cadence sait : posts indexés, sources, couverture piliers, sujets dominants/oubliés, recyclables.
// Sortie pensée pour une page prose calme. Aucune donnée fabriquée : si vide, on dit "rien à montrer".

import { supabase } from './supabase';
import { indexedCount } from './embeddings';
import { pilierStats, trackedTopicStatus, computeRadarInsights, TRACKED_TOPICS, type PilierStat, type RadarInsight } from './radar-insights';
import { computeHumanInsights, type HumanInsight } from './analytics-insights';

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

  // V10.2 — Score de confiance global (0-100) + composantes
  confidenceScore: {
    overall: number;
    memory: number;        // couverture mémoire (volume indexé)
    linkedin: number;      // couverture LinkedIn (% confirmé)
    embeddings: number;    // freshness embeddings
  };

  // V10.2 — Apprentissage récent (semaine en cours vs semaine d'avant)
  weeklyLearnings: BrainLearning[];

  // V10.2 — Timeline éditoriale (12 derniers mois)
  timeline: BrainTimelinePoint[];

  // V10.6.2 — Formats qui progressent / fatiguent (extraits de computeHumanInsights)
  formatTrends: FormatTrend[];

  // V11.3 — Drift éditorial : hooks plus génériques, ton plus corporate, etc.
  editorialDrifts: EditorialDrift[];
};

export type EditorialDrift = {
  kind: 'hook_length' | 'hook_generic' | 'corporate_tone' | 'pilier_concentration' | 'format_dropoff' | 'topic_avoidance';
  message: string;
  severity: 'low' | 'medium';
};

export type FormatTrend = {
  pilier: string;
  direction: 'progresse' | 'fatigue';
  deltaPct: number;       // -100..+999 (signé)
  message: string;
};

export type BrainTimelinePoint = {
  yearMonth: string;       // 'YYYY-MM'
  label: string;           // 'janv. 26'
  count: number;
};

export type BrainLearning = {
  kind: 'volume_change' | 'format_rising' | 'format_fatiguing' | 'pilier_shift' | 'topic_new';
  message: string;
};

const SOURCE_LABELS: Record<string, string> = {
  notion: 'Notion',
  linkedin_archive: 'archive LinkedIn',
  inspiration: 'inspirations',
  manual: 'saisie directe',
};

const PRIORITY: Record<RadarInsight['kind'], number> = {
  weekday_opportunity: 0,
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

  // V10.2 — Score de confiance global (0-100)
  // Trois composantes pondérées : memory 30% / linkedin 50% / embeddings 20%.
  const memoryScore = Math.min(100, Math.round((total / 100) * 100)); // 100 posts = 100%
  const linkedinScore = confirmedPct;                                  // déjà 0-100
  const daysSinceEmbed = lastIndexedAt ? Math.floor((Date.now() - new Date(lastIndexedAt).getTime()) / 86_400_000) : 999;
  const embeddingsScore = total === 0 ? 0 : Math.max(0, Math.min(100, 100 - daysSinceEmbed * 4)); // -4 pts / jour
  const overallScore = Math.round(memoryScore * 0.3 + linkedinScore * 0.5 + embeddingsScore * 0.2);

  // V10.2 — Ce que Cadence a appris cette semaine
  const weeklyLearnings: BrainLearning[] = [];
  try {
    const sevenDays = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const fourteenDays = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const { count: thisWeek } = await supabase
      .from('post_embeddings').select('id', { count: 'exact', head: true })
      .gte('indexed_at', sevenDays);
    const { count: lastWeek } = await supabase
      .from('post_embeddings').select('id', { count: 'exact', head: true })
      .gte('indexed_at', fourteenDays).lt('indexed_at', sevenDays);
    const tw = thisWeek || 0, lw = lastWeek || 0;
    if (tw + lw > 0) {
      if (tw > lw && lw > 0) {
        weeklyLearnings.push({
          kind: 'volume_change',
          message: `${tw} post${tw > 1 ? 's' : ''} indexé${tw > 1 ? 's' : ''} cette semaine, contre ${lw} la semaine dernière. Vous accélérez.`,
        });
      } else if (lw > tw && tw > 0) {
        weeklyLearnings.push({
          kind: 'volume_change',
          message: `${tw} post${tw > 1 ? 's' : ''} cette semaine contre ${lw} la précédente. Rythme en baisse.`,
        });
      } else if (tw > 0 && lw === 0) {
        weeklyLearnings.push({
          kind: 'volume_change',
          message: `Reprise cette semaine avec ${tw} post${tw > 1 ? 's' : ''} indexé${tw > 1 ? 's' : ''} après une semaine sans signal.`,
        });
      }
    }
    // Sujet nouveau cette semaine : topic dont count60d > 0 mais lastDays <= 7
    for (const t of topics) {
      if (t.lastDays !== null && t.lastDays <= 7 && t.count60d <= 2) {
        weeklyLearnings.push({
          kind: 'topic_new',
          message: `${t.topic} fait son retour après une absence. C’est le moment de creuser un angle inédit.`,
        });
        break;
      }
    }
  } catch { /* silent */ }

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
    confidenceScore: {
      overall: overallScore,
      memory: memoryScore,
      linkedin: linkedinScore,
      embeddings: embeddingsScore,
    },
    weeklyLearnings,
    timeline: buildTimeline(bySource),
    formatTrends: await buildFormatTrends().catch(() => []),
    editorialDrifts: await buildEditorialDrifts().catch(() => []),
  };
}

// V11.3 — Détection drift éditorial : compare 60 derniers jours vs les 60
// précédents sur 3 dimensions : longueur hook, ton corporate, concentration
// pilier. Sortie : phrases prose courtes, max 3 messages.
const CORPORATE_WORDS = new Set([
  'roi', 'kpi', 'scalable', 'pipeline', 'leverage', 'synergies', 'synergie',
  'ecosystème', 'écosystème', 'verticale', 'leadership', 'mindset', 'best practice',
  'best practices', 'agile', 'framework', 'process', 'workflow', 'stack',
  'enabler', 'enabling', 'value proposition', 'go-to-market', 'gtm',
]);
const PERSONAL_WORDS = new Set([
  'moi', 'mes', 'mon', 'ma', 'je', "j'", 'nous', 'nos', 'notre',
  'hier', 'aujourd', 'parfois', 'souvent', 'jamais', 'toujours',
]);

function countMatches(text: string, dict: Set<string>): number {
  const words = text.toLowerCase().split(/\s+/);
  let n = 0;
  for (const w of words) {
    if (!w) continue;
    if (dict.has(w) || dict.has(w.replace(/[^a-zàâçéèêëîïôûùüÿñæœ-]/g, ''))) n++;
  }
  return n;
}

export async function buildEditorialDrifts(): Promise<EditorialDrift[]> {
  const drifts: EditorialDrift[] = [];
  try {
    const sixtyAgo = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const oneTwentyAgo = new Date(Date.now() - 120 * 86_400_000).toISOString();
    const { data: recent } = await supabase
      .from('post_embeddings')
      .select('title, content_excerpt, pilier, scheduled_at')
      .gte('scheduled_at', sixtyAgo)
      .limit(60);
    const { data: previous } = await supabase
      .from('post_embeddings')
      .select('title, content_excerpt, pilier, scheduled_at')
      .gte('scheduled_at', oneTwentyAgo)
      .lt('scheduled_at', sixtyAgo)
      .limit(60);

    const rec = recent || [];
    const prev = previous || [];
    if (rec.length < 4 || prev.length < 4) return drifts;

    // 1. Longueur du hook (première ligne)
    const hookLen = (rows: any[]) => {
      const lens = rows
        .map(r => (r.content_excerpt || r.title || '').split('\n')[0]?.length || 0)
        .filter(n => n > 0);
      return lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
    };
    const hookRec = hookLen(rec);
    const hookPrev = hookLen(prev);
    if (hookPrev > 0 && hookRec / hookPrev > 1.25) {
      drifts.push({
        kind: 'hook_length',
        severity: 'low',
        message: `Vos hooks s'allongent : en moyenne ${Math.round(hookRec)} caractères ces 60 derniers jours contre ${Math.round(hookPrev)} avant. Un hook plus court accroche souvent mieux.`,
      });
    } else if (hookPrev > 0 && hookRec / hookPrev < 0.8) {
      drifts.push({
        kind: 'hook_length',
        severity: 'low',
        message: `Vos hooks raccourcissent : en moyenne ${Math.round(hookRec)} caractères ces 60 derniers jours contre ${Math.round(hookPrev)} avant. Resserrement intéressant à confirmer.`,
      });
    }

    // 2. Ton corporate (heuristique)
    const tally = (rows: any[]) => {
      let corp = 0, pers = 0, total = 0;
      for (const r of rows) {
        const txt = (r.content_excerpt || '') + ' ' + (r.title || '');
        corp += countMatches(txt, CORPORATE_WORDS);
        pers += countMatches(txt, PERSONAL_WORDS);
        total += txt.split(/\s+/).length;
      }
      return { corp, pers, total };
    };
    const tRec = tally(rec);
    const tPrev = tally(prev);
    const corpRecRatio = tRec.total ? tRec.corp / tRec.total : 0;
    const corpPrevRatio = tPrev.total ? tPrev.corp / tPrev.total : 0;
    if (corpPrevRatio > 0 && corpRecRatio / corpPrevRatio > 1.5 && tRec.corp >= 3) {
      drifts.push({
        kind: 'corporate_tone',
        severity: 'medium',
        message: `Votre vocabulaire devient plus corporate : ${tRec.corp} mots type "ROI / KPI / framework" ces 60 derniers jours, contre ${tPrev.corp} avant. À surveiller si vos meilleurs posts sont plus personnels.`,
      });
    } else if (corpRecRatio > 0 && corpPrevRatio / corpRecRatio > 1.5 && tPrev.corp >= 3) {
      drifts.push({
        kind: 'corporate_tone',
        severity: 'low',
        message: `Votre vocabulaire s'allège du jargon corporate : ${tRec.corp} mots techniques ces 60 derniers jours contre ${tPrev.corp} avant.`,
      });
    }

    // 3. Concentration pilier (un seul pilier > 60% des posts récents)
    const pilierCount: Record<string, number> = {};
    const pilierCountPrev: Record<string, number> = {};
    for (const r of rec) {
      const p = r.pilier?.split(' · ')[1]?.trim() || r.pilier || 'sans pilier';
      pilierCount[p] = (pilierCount[p] || 0) + 1;
    }
    for (const r of prev) {
      const p = r.pilier?.split(' · ')[1]?.trim() || r.pilier || 'sans pilier';
      pilierCountPrev[p] = (pilierCountPrev[p] || 0) + 1;
    }
    const top = Object.entries(pilierCount).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] / rec.length > 0.6) {
      drifts.push({
        kind: 'pilier_concentration',
        severity: 'medium',
        message: `Le pilier "${top[0]}" concentre ${Math.round(top[1] / rec.length * 100)}% de vos posts récents. Diversifier les angles renforcerait la perception générale.`,
      });
    }

    // 4. V11.3 — Hook genericity : ratio des hooks commençant par formules
    // génériques (Voici, Comment, 5 erreurs, X choses, Pourquoi…)
    const GENERIC_HOOK_REGEX = /^(voici|comment|pourquoi|\d+\s+(erreurs|raisons|choses|astuces|étapes|leçons|conseils)|les?\s+\d+|ce que|c'est ce que)/i;
    const countGeneric = (rows: any[]) => {
      let g = 0, t = 0;
      for (const r of rows) {
        const hook = (r.content_excerpt || r.title || '').split('\n')[0]?.trim() || '';
        if (!hook) continue;
        t++;
        if (GENERIC_HOOK_REGEX.test(hook)) g++;
      }
      return { g, t };
    };
    const genRec = countGeneric(rec);
    const genPrev = countGeneric(prev);
    if (genRec.t >= 5 && genPrev.t >= 5) {
      const rRec = genRec.g / genRec.t;
      const rPrev = genPrev.g / genPrev.t;
      if (rRec > 0.4 && rRec / Math.max(rPrev, 0.01) > 1.5) {
        drifts.push({
          kind: 'hook_generic',
          severity: 'medium',
          message: `Vos hooks deviennent plus génériques : ${Math.round(rRec * 100)}% commencent par "Voici", "Comment", "5 X…" ces 60 derniers jours, contre ${Math.round(rPrev * 100)}% avant. Un hook plus pointu se démarque davantage.`,
        });
      }
    }

    // 5. V11.3 — Format dropoff : un pilier qui disparait complètement entre
    // les 60 jours précédents et les 60 récents.
    for (const p of Object.keys(pilierCountPrev)) {
      if (pilierCountPrev[p] >= 3 && !pilierCount[p]) {
        drifts.push({
          kind: 'format_dropoff',
          severity: 'medium',
          message: `Vos posts "${p}" ont disparu : ${pilierCountPrev[p]} sur les 60 jours précédents, zéro ces 60 derniers jours.`,
        });
        break; // un seul max
      }
    }

    // 6. V11.3 — Topic avoidance : un sujet tracké absent depuis plus de 42 jours
    // alors qu'il était présent avant. (utilise content_excerpt + title)
    const TRACKED_KEYWORDS = ['trésorerie', 'tresorerie', 'dso', 'cash', 'recouvrement', 'agent ia', 'agent', 'cadence', 'heelio'];
    const sixWeeksAgo = Date.now() - 42 * 86_400_000;
    const recentTouches: Record<string, boolean> = {};
    const olderLatest: Record<string, number> = {};
    const scan = (rows: any[]) => {
      for (const r of rows) {
        const txt = ((r.title || '') + ' ' + (r.content_excerpt || '')).toLowerCase();
        const t = r.scheduled_at ? new Date(r.scheduled_at).getTime() : 0;
        for (const k of TRACKED_KEYWORDS) {
          if (txt.includes(k)) {
            if (t >= sixWeeksAgo) recentTouches[k] = true;
            else if (t > (olderLatest[k] || 0)) olderLatest[k] = t;
          }
        }
      }
    };
    scan(rec); scan(prev);
    const avoidedTopic = Object.keys(olderLatest).find(k => !recentTouches[k] && olderLatest[k] > 0);
    if (avoidedTopic) {
      const weeks = Math.floor((Date.now() - olderLatest[avoidedTopic]) / (7 * 86_400_000));
      drifts.push({
        kind: 'topic_avoidance',
        severity: 'low',
        message: `Vous n'avez plus parlé de "${avoidedTopic}" depuis ${weeks} semaines. Un angle frais sur ce sujet pourrait surprendre votre audience.`,
      });
    }
  } catch { /* silent */ }

  return drifts.slice(0, 4);
}

// V10.6.2 — Extrait les piliers qui progressent ou fatiguent depuis humanInsights.
async function buildFormatTrends(): Promise<FormatTrend[]> {
  const insights = await computeHumanInsights();
  const trends: FormatTrend[] = [];
  for (const ins of insights) {
    if (ins.kind !== 'pilier') continue;
    const msg = ins.message || '';
    const data = (ins as any).data || {};
    if (/progressent/.test(msg) && data.pilier && typeof data.avgRec === 'number' && typeof data.avgPrev === 'number') {
      const delta = Math.round((data.avgRec / Math.max(data.avgPrev, 1) - 1) * 100);
      trends.push({ pilier: data.pilier, direction: 'progresse', deltaPct: delta, message: msg });
    } else if (/fatiguent/.test(msg) && data.pilier && typeof data.avgRec === 'number' && typeof data.avgPrev === 'number') {
      const delta = Math.round((data.avgRec / Math.max(data.avgPrev, 1) - 1) * 100);
      trends.push({ pilier: data.pilier, direction: 'fatigue', deltaPct: delta, message: msg });
    }
  }
  // Tri : progressions d'abord (positif), puis fatigues (négatif)
  trends.sort((a, b) => b.deltaPct - a.deltaPct);
  return trends.slice(0, 4);
}

// V10.2 — Timeline des 12 derniers mois construite depuis les posts indexés.
function buildTimeline(rows: any[] | null): BrainTimelinePoint[] {
  const points: BrainTimelinePoint[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }).replace('.', '');
    points.push({ yearMonth: ym, label, count: 0 });
  }
  for (const r of rows || []) {
    const iso = r.scheduled_at || r.indexed_at;
    if (!iso) continue;
    const t = new Date(iso);
    if (Number.isNaN(t.getTime())) continue;
    const ym = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
    const p = points.find(x => x.yearMonth === ym);
    if (p) p.count++;
  }
  return points;
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
