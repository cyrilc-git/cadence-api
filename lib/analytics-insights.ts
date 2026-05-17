// V9.0 §3 — Analyses humaines : extrait des patterns des posts publiés et indexés.
// Sortie : phrases lisibles ("Vos posts du mardi matin performent +35%…").
// Si données insuffisantes : retourne un flag low_data avec la raison.

import { supabase } from './supabase';

export type HumanInsight = {
  kind: 'length' | 'pilier' | 'weekday' | 'visual' | 'hook' | 'low_data';
  message: string;
  data?: any;
};

const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

type IndexedPost = {
  title: string;
  content_excerpt: string;
  pilier: string | null;
  scheduled_at: string | null;
  meta: any;
};

export async function computeHumanInsights(): Promise<HumanInsight[]> {
  const insights: HumanInsight[] = [];

  const { data: posts } = await supabase
    .from('post_embeddings')
    .select('title, content_excerpt, pilier, scheduled_at, meta')
    .eq('status', 'published')
    .order('scheduled_at', { ascending: false, nullsFirst: false })
    .limit(300);

  const withMetrics = (posts || []).filter((p): p is IndexedPost => {
    const m = (p.meta as any);
    return typeof m?.impressions === 'number' && m.impressions > 0;
  });

  if (withMetrics.length < 5) {
    insights.push({
      kind: 'low_data',
      message: `Données insuffisantes (${withMetrics.length} posts avec impressions). Renseignez les métriques dans Notion pour voir les patterns.`
    });
    return insights;
  }

  // 1. Length pattern
  const short = withMetrics.filter(p => (p.content_excerpt || '').length < 500);
  const long  = withMetrics.filter(p => (p.content_excerpt || '').length >= 500);
  if (short.length >= 3 && long.length >= 3) {
    const avgShort = avg(short.map(p => p.meta.impressions));
    const avgLong  = avg(long.map(p => p.meta.impressions));
    const ratio = avgShort / Math.max(avgLong, 1);
    if (ratio > 1.2) {
      insights.push({
        kind: 'length',
        message: `Vos posts courts (moins de 500 caractères) performent +${Math.round((ratio - 1) * 100)}% en impressions par rapport aux longs.`,
        data: { avgShort: Math.round(avgShort), avgLong: Math.round(avgLong), shortN: short.length, longN: long.length }
      });
    } else if (ratio < 0.8) {
      insights.push({
        kind: 'length',
        message: `Vos posts longs (500+ caractères) performent +${Math.round((1/ratio - 1) * 100)}% en impressions par rapport aux courts.`,
        data: { avgShort: Math.round(avgShort), avgLong: Math.round(avgLong), shortN: short.length, longN: long.length }
      });
    }
  }

  // 2. Pilier pattern
  const byPilier: Record<string, { count: number; total: number; comments: number; likes: number }> = {};
  for (const p of withMetrics) {
    const pil = p.pilier?.split(' · ')[1]?.trim() || p.pilier || 'sans pilier';
    if (!byPilier[pil]) byPilier[pil] = { count: 0, total: 0, comments: 0, likes: 0 };
    byPilier[pil].count++;
    byPilier[pil].total += p.meta.impressions;
    byPilier[pil].comments += p.meta.comments || 0;
    byPilier[pil].likes += p.meta.likes || 0;
  }
  const pilierAvg = Object.entries(byPilier)
    .filter(([, v]) => v.count >= 3)
    .map(([k, v]) => ({ pilier: k, avgImpressions: v.total / v.count, avgComments: v.comments / v.count, avgLikes: v.likes / v.count, count: v.count }));
  if (pilierAvg.length >= 2) {
    const sortedByImp = [...pilierAvg].sort((a, b) => b.avgImpressions - a.avgImpressions);
    const best = sortedByImp[0], worst = sortedByImp[sortedByImp.length - 1];
    if (best.avgImpressions > worst.avgImpressions * 1.3) {
      insights.push({
        kind: 'pilier',
        message: `Vos posts "${best.pilier}" génèrent en moyenne ${Math.round(best.avgImpressions / Math.max(worst.avgImpressions, 1) * 100 - 100)}% plus d'impressions que vos posts "${worst.pilier}".`,
        data: { best: best.pilier, worst: worst.pilier, bestAvg: Math.round(best.avgImpressions), worstAvg: Math.round(worst.avgImpressions) }
      });
    }
    // Engagement (comments) pattern
    const sortedByComments = [...pilierAvg].filter(p => p.avgComments > 0).sort((a, b) => b.avgComments - a.avgComments);
    if (sortedByComments.length >= 2) {
      const bestC = sortedByComments[0], worstC = sortedByComments[sortedByComments.length - 1];
      if (bestC.avgComments > worstC.avgComments * 1.5) {
        insights.push({
          kind: 'pilier',
          message: `Les posts "${bestC.pilier}" déclenchent ${(bestC.avgComments / Math.max(worstC.avgComments, 1)).toFixed(1)}× plus de commentaires que les posts "${worstC.pilier}".`,
          data: { best: bestC.pilier, worst: worstC.pilier }
        });
      }
    }
  }

  // 3. Weekday pattern
  const byWeekday: Record<number, { count: number; total: number }> = {};
  for (const p of withMetrics) {
    if (!p.scheduled_at) continue;
    const dow = new Date(p.scheduled_at).getDay();
    if (!byWeekday[dow]) byWeekday[dow] = { count: 0, total: 0 };
    byWeekday[dow].count++;
    byWeekday[dow].total += p.meta.impressions;
  }
  const weekdayAvg = Object.entries(byWeekday)
    .filter(([, v]) => v.count >= 3)
    .map(([k, v]) => ({ weekday: parseInt(k), avg: v.total / v.count, count: v.count }));
  if (weekdayAvg.length >= 2) {
    const sorted = [...weekdayAvg].sort((a, b) => b.avg - a.avg);
    const best = sorted[0], worst = sorted[sorted.length - 1];
    if (best.avg > worst.avg * 1.2) {
      insights.push({
        kind: 'weekday',
        message: `Vos posts publiés le ${DAY_NAMES[best.weekday]} performent ${(best.avg / Math.max(worst.avg, 1)).toFixed(1)}× mieux que le ${DAY_NAMES[worst.weekday]}.`,
        data: { best: DAY_NAMES[best.weekday], worst: DAY_NAMES[worst.weekday], bestAvg: Math.round(best.avg) }
      });
    }
  }

  // 4. Hook (1ère ligne) pattern
  const hookLengths = withMetrics.map(p => ({
    hookLen: (p.title || p.content_excerpt.split('\n')[0] || '').length,
    impressions: p.meta.impressions
  })).filter(x => x.hookLen > 0);
  if (hookLengths.length >= 8) {
    const shortHooks = hookLengths.filter(x => x.hookLen < 60);
    const longHooks  = hookLengths.filter(x => x.hookLen >= 60);
    if (shortHooks.length >= 3 && longHooks.length >= 3) {
      const avgS = avg(shortHooks.map(x => x.impressions));
      const avgL = avg(longHooks.map(x => x.impressions));
      if (avgS > avgL * 1.2) {
        insights.push({
          kind: 'hook',
          message: `Vos hooks courts (moins de 60 caractères) performent +${Math.round((avgS / avgL - 1) * 100)}% en impressions.`,
          data: { avgShort: Math.round(avgS), avgLong: Math.round(avgL) }
        });
      } else if (avgL > avgS * 1.2) {
        insights.push({
          kind: 'hook',
          message: `Vos hooks longs (60+ caractères) performent +${Math.round((avgL / avgS - 1) * 100)}% en impressions.`,
          data: { avgShort: Math.round(avgS), avgLong: Math.round(avgL) }
        });
      }
    }
  }

  if (insights.length === 0) {
    insights.push({
      kind: 'low_data',
      message: `Aucun pattern statistiquement significatif détecté sur ${withMetrics.length} posts. Continuez à publier — les patterns émergeront.`
    });
  }

  return insights;
}

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((s, n) => s + n, 0) / arr.length;
}
