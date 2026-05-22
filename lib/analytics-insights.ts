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

  // 5. V9.1 §4 — Engagement par pilier (commentaires + likes pondérés)
  const engagement: Record<string, { count: number; comments: number; likes: number }> = {};
  for (const p of withMetrics) {
    const pil = p.pilier?.split(' · ')[1]?.trim() || p.pilier || 'sans pilier';
    if (!engagement[pil]) engagement[pil] = { count: 0, comments: 0, likes: 0 };
    engagement[pil].count++;
    engagement[pil].comments += p.meta.comments || 0;
    engagement[pil].likes += p.meta.likes || 0;
  }
  const engageAvg = Object.entries(engagement)
    .filter(([, v]) => v.count >= 3)
    .map(([k, v]) => ({ pilier: k, avgEngagement: (v.comments + v.likes * 0.3) / v.count, count: v.count }));
  if (engageAvg.length >= 2) {
    const sorted = [...engageAvg].sort((a, b) => b.avgEngagement - a.avgEngagement);
    const best = sorted[0], worst = sorted[sorted.length - 1];
    if (best.avgEngagement > worst.avgEngagement * 1.5 && best.avgEngagement > 5) {
      insights.push({
        kind: 'pilier',
        message: `Vos posts "${best.pilier}" déclenchent ${(best.avgEngagement / Math.max(worst.avgEngagement, 1)).toFixed(1)}× plus d'engagement (commentaires + likes pondérés) que vos "${worst.pilier}".`,
        data: { best: best.pilier, worst: worst.pilier, bestE: Math.round(best.avgEngagement) }
      });
    }
  }

  // 6. V9.1 §4 — Cadence éditoriale : posts/semaine sur 30j vs 90j
  const now = Date.now();
  const last30 = withMetrics.filter(p => p.scheduled_at && new Date(p.scheduled_at).getTime() > now - 30 * 86400000);
  const last90 = withMetrics.filter(p => p.scheduled_at && new Date(p.scheduled_at).getTime() > now - 90 * 86400000);
  if (last90.length >= 6) {
    const rate30 = last30.length / 4.3;   // posts/semaine sur 30j
    const rate90 = last90.length / 12.9;  // posts/semaine sur 90j
    if (rate30 < rate90 * 0.7 && rate90 > 1) {
      insights.push({
        kind: 'pilier',
        message: `Votre cadence baisse : ${rate30.toFixed(1)} post/semaine sur 30j vs ${rate90.toFixed(1)} sur 90j.`,
        data: { rate30: rate30.toFixed(1), rate90: rate90.toFixed(1) }
      });
    } else if (rate30 > rate90 * 1.3) {
      insights.push({
        kind: 'pilier',
        message: `Votre cadence accélère : ${rate30.toFixed(1)} post/semaine sur 30j vs ${rate90.toFixed(1)} sur 90j.`,
        data: { rate30: rate30.toFixed(1), rate90: rate90.toFixed(1) }
      });
    }
  }

  // 7. V9.1 §4 — Hour-of-day pattern (matin vs après-midi vs soir)
  const byBucket: Record<string, { count: number; total: number }> = { matin: { count: 0, total: 0 }, midi: { count: 0, total: 0 }, soir: { count: 0, total: 0 } };
  for (const p of withMetrics) {
    if (!p.scheduled_at) continue;
    const h = new Date(p.scheduled_at).getHours();
    const bucket = h < 11 ? 'matin' : h < 17 ? 'midi' : 'soir';
    byBucket[bucket].count++;
    byBucket[bucket].total += p.meta.impressions;
  }
  const bucketAvg = Object.entries(byBucket)
    .filter(([, v]) => v.count >= 3)
    .map(([k, v]) => ({ bucket: k, avg: v.total / v.count }));
  if (bucketAvg.length >= 2) {
    const sorted = [...bucketAvg].sort((a, b) => b.avg - a.avg);
    if (sorted[0].avg > sorted[sorted.length - 1].avg * 1.2) {
      insights.push({
        kind: 'weekday',
        message: `Vos posts publiés le ${sorted[0].bucket} (avant 11h pour matin, 17h pour midi, après 17h pour soir) performent mieux.`,
        data: { best: sorted[0].bucket }
      });
    }
  }

  // 8. V10.6.1 — Fatigue / progression par pilier (30 derniers jours vs 30-60 jours)
  // Compare la perf moyenne d'un pilier sur la fenêtre récente à la précédente.
  // Si delta >= +30% : ce pilier progresse. Si delta <= -30% : ce pilier fatigue.
  const thirtyAgo = now - 30 * 86_400_000;
  const sixtyAgo = now - 60 * 86_400_000;
  const recentByPilier: Record<string, number[]> = {};
  const previousByPilier: Record<string, number[]> = {};
  for (const p of withMetrics) {
    if (!p.scheduled_at) continue;
    const t = new Date(p.scheduled_at).getTime();
    if (t < sixtyAgo) continue;
    const pil = p.pilier?.split(' · ')[1]?.trim() || p.pilier || 'sans pilier';
    if (t >= thirtyAgo) (recentByPilier[pil] = recentByPilier[pil] || []).push(p.meta.impressions);
    else (previousByPilier[pil] = previousByPilier[pil] || []).push(p.meta.impressions);
  }
  for (const pil of Object.keys(recentByPilier)) {
    const rec = recentByPilier[pil];
    const prev = previousByPilier[pil];
    if (!rec || !prev || rec.length < 2 || prev.length < 2) continue;
    const avgRec = avg(rec), avgPrev = avg(prev);
    if (avgPrev === 0) continue;
    const delta = avgRec / avgPrev - 1;
    if (delta >= 0.3) {
      insights.push({
        kind: 'pilier',
        message: `Vos posts "${pil}" progressent : +${Math.round(delta * 100)}% d'impressions sur les 30 derniers jours vs les 30 précédents.`,
        data: { pilier: pil, avgRec: Math.round(avgRec), avgPrev: Math.round(avgPrev) }
      });
    } else if (delta <= -0.3) {
      insights.push({
        kind: 'pilier',
        message: `Vos posts "${pil}" fatiguent : ${Math.round(delta * 100)}% d'impressions sur les 30 derniers jours vs les 30 précédents. Tester un autre angle ou une autre fréquence.`,
        data: { pilier: pil, avgRec: Math.round(avgRec), avgPrev: Math.round(avgPrev) }
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      kind: 'low_data',
      message: `Aucun pattern statistiquement significatif détecté sur ${withMetrics.length} posts. Continuez à publier, les patterns émergeront.`
    });
  }

  return insights;
}

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((s, n) => s + n, 0) / arr.length;
}
