// V8.9 §3 — Radar insights : analyses dérivées des embeddings + posts indexés.
// Sortie : sujets dominants/oubliés/saturés, piliers sous-utilisés, angles performants, "why now" factuel.
// Pas d'invention : si données insuffisantes, on retourne un flag explicite.

import { supabase } from './supabase';
import { listIndexed, indexedCount, semanticSearch, EmbeddingHit } from './embeddings';

export type PilierStat = {
  pilier: string;
  count: number;
  daysSinceLast: number | null;
  lastTitle: string | null;
  lastDate: string | null;
  avgImpressions: number | null;
};

export type TopicCluster = {
  theme: string;
  count: number;
  saturated: boolean; // > 3 posts en 60j sur ce thème
  recyclable: boolean; // > 1 post mais > 90j depuis le dernier
  lastDate: string | null;
};

export type RadarInsight = {
  kind: 'pilier_silence' | 'topic_recyclable' | 'topic_saturated' | 'topic_never' | 'angle_winning' | 'weekday_opportunity' | 'low_data';
  message: string;
  cta_label?: string;
  cta_href?: string;
  data?: any;
};

const KNOWN_PILIERS = [
  'Lundi · Cas client',
  'Mardi · Pédagogie',
  'Mercredi · Produit',
  'Jeudi · Opinion',
  'Vendredi · Build in public'
];

// Mots-clés des projets / sujets attendus de Cyril. Ajustables au fil du temps.
export const TRACKED_TOPICS = [
  { key: 'Heelio', synonyms: ['heelio', 'trésorerie', 'tréso', 'cashflow'] },
  { key: 'Decode', synonyms: ['decode', 'therapilot', 'thérapeute'] },
  { key: 'Studio OS', synonyms: ['studio os', 'studio-os', 'plateforme apps'] },
  { key: 'DSO', synonyms: ['dso', 'délai de paiement', 'recouvrement'] },
  { key: 'DAF freelance', synonyms: ['daf freelance', 'daf externalisé', 'fractional'] },
  { key: 'IA / Claude', synonyms: ['claude', 'anthropic', 'agent ia', 'mcp'] }
];

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24));
}

// === 1. Stats par pilier ===
export async function pilierStats(): Promise<PilierStat[]> {
  const { data: posts } = await supabase
    .from('post_embeddings')
    .select('pilier, title, scheduled_at, meta')
    .eq('status', 'published')
    .order('scheduled_at', { ascending: false, nullsFirst: false })
    .limit(300);
  const stats: Record<string, PilierStat> = {};
  for (const p of KNOWN_PILIERS) {
    stats[p] = { pilier: p, count: 0, daysSinceLast: null, lastTitle: null, lastDate: null, avgImpressions: null };
  }
  let totalImpressions: Record<string, number[]> = {};
  for (const row of posts || []) {
    const pil = row.pilier;
    if (!pil) continue;
    // Match label exact OR substring (gère les libellés avec emoji)
    const matched = KNOWN_PILIERS.find(p => pil === p || pil.includes(p.split(' · ')[1]));
    if (!matched) continue;
    stats[matched].count++;
    if (!stats[matched].lastDate && row.scheduled_at) {
      stats[matched].lastDate = row.scheduled_at;
      stats[matched].lastTitle = row.title;
      stats[matched].daysSinceLast = daysAgo(row.scheduled_at);
    }
    const imp = (row.meta as any)?.impressions;
    if (typeof imp === 'number') {
      if (!totalImpressions[matched]) totalImpressions[matched] = [];
      totalImpressions[matched].push(imp);
    }
  }
  for (const p of KNOWN_PILIERS) {
    const arr = totalImpressions[p];
    if (arr && arr.length) stats[p].avgImpressions = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  }
  return Object.values(stats);
}

// === 2. Tracking topics (Heelio / Decode / Studio OS / etc.) ===
export async function trackedTopicStatus(): Promise<Array<{ topic: string; lastDays: number | null; count60d: number }>> {
  const { data: posts } = await supabase
    .from('post_embeddings')
    .select('title, content_excerpt, scheduled_at')
    .order('scheduled_at', { ascending: false, nullsFirst: false })
    .limit(150);
  const sixty = Date.now() - 1000 * 60 * 60 * 24 * 60;
  const out: Array<{ topic: string; lastDays: number | null; count60d: number }> = [];
  for (const t of TRACKED_TOPICS) {
    let lastDays: number | null = null;
    let count60d = 0;
    for (const row of posts || []) {
      const hay = `${row.title || ''} ${row.content_excerpt || ''}`.toLowerCase();
      const match = t.synonyms.some(s => hay.includes(s.toLowerCase()));
      if (!match) continue;
      const d = row.scheduled_at ? daysAgo(row.scheduled_at) : null;
      if (lastDays === null && d !== null) lastDays = d;
      if (row.scheduled_at && new Date(row.scheduled_at).getTime() > sixty) count60d++;
    }
    out.push({ topic: t.key, lastDays, count60d });
  }
  return out;
}

// === 3. Insights compilation ===
export async function computeRadarInsights(): Promise<RadarInsight[]> {
  const insights: RadarInsight[] = [];
  const total = await indexedCount();
  if (total < 10) {
    insights.push({
      kind: 'low_data',
      message: `Seulement ${total} posts indexés. Lancez l'indexation pour activer le cerveau du radar.`,
      cta_label: 'Indexer mes posts',
      cta_href: '/sources/linkedin'
    });
    return insights;
  }

  // 3a. Piliers silencieux (> 14j sans post) — V15.7 ton éditorial
  try {
    const stats = await pilierStats();
    for (const s of stats) {
      if (s.daysSinceLast !== null && s.daysSinceLast > 14) {
        const weeks = Math.round(s.daysSinceLast / 7);
        insights.push({
          kind: 'pilier_silence',
          message: weeks <= 1
            ? `Pas de post sur « ${s.pilier} » depuis ${s.daysSinceLast} jours.`
            : `Pas de post sur « ${s.pilier} » depuis ${weeks} semaines.`,
          cta_label: 'Voir les idées',
          cta_href: `/suggestions?pilier=${encodeURIComponent(s.pilier)}`,
          data: { pilier: s.pilier, daysSinceLast: s.daysSinceLast, lastTitle: s.lastTitle }
        });
      } else if (s.count === 0) {
        insights.push({
          kind: 'pilier_silence',
          message: `Vous n'avez encore rien publié sur « ${s.pilier} ».`,
          cta_label: 'Ouvrir un brouillon',
          cta_href: `/posts/new?pilier=${encodeURIComponent(s.pilier)}`,
          data: { pilier: s.pilier, count: 0 }
        });
      }
    }
  } catch { /* silent */ }

  // 3b. Topics silencieux (Decode/Heelio/etc.) — V15.7 ton éditorial
  try {
    const topics = await trackedTopicStatus();
    for (const t of topics) {
      if (t.lastDays === null) {
        insights.push({
          kind: 'topic_never',
          message: `« ${t.topic} » n'a jamais été un sujet de post chez vous. Premier angle à poser.`,
          cta_label: 'Écrire le premier',
          cta_href: `/posts/new?brief=${encodeURIComponent(`Premier post sur ${t.topic}`)}`,
          data: { topic: t.topic }
        });
      } else if (t.lastDays > 21) {
        const weeks = Math.round(t.lastDays / 7);
        insights.push({
          kind: 'topic_recyclable',
          message: weeks <= 4
            ? `${weeks} semaines sans parler de ${t.topic}. Vos lecteurs ont peut-être oublié.`
            : `Plus de ${weeks} semaines sans parler de ${t.topic}. Un retour sur ce sujet réveillerait l'audience.`,
          cta_label: 'Reprendre le sujet',
          cta_href: `/posts?q=${encodeURIComponent(t.topic)}`,
          data: { topic: t.topic, lastDays: t.lastDays }
        });
      } else if (t.count60d > 4) {
        insights.push({
          kind: 'topic_saturated',
          message: `${t.count60d} posts sur ${t.topic} en 60 jours : le sujet sature, mieux vaut changer d'angle.`,
          data: { topic: t.topic, count60d: t.count60d }
        });
      }
    }
  } catch { /* silent */ }

  // 3c. Angle gagnant (post court > post long si data)
  try {
    const { data: pubs } = await supabase
      .from('post_embeddings')
      .select('title, content_excerpt, meta')
      .eq('status', 'published')
      .limit(100);
    const withImpressions = (pubs || []).filter(p => typeof (p.meta as any)?.impressions === 'number');
    if (withImpressions.length >= 10) {
      const short = withImpressions.filter(p => (p.content_excerpt || '').length < 500);
      const long = withImpressions.filter(p => (p.content_excerpt || '').length >= 500);
      const avgShort = short.length ? short.reduce((a, b) => a + ((b.meta as any).impressions || 0), 0) / short.length : 0;
      const avgLong = long.length ? long.reduce((a, b) => a + ((b.meta as any).impressions || 0), 0) / long.length : 0;
      if (avgShort > avgLong * 1.3 && short.length >= 5) {
        insights.push({
          kind: 'angle_winning',
          message: `Vos posts courts (<500 chars) performent ~${Math.round(avgShort / Math.max(avgLong, 1) * 100 - 100)}% mieux que les longs.`,
          data: { avgShort: Math.round(avgShort), avgLong: Math.round(avgLong) }
        });
      } else if (avgLong > avgShort * 1.3 && long.length >= 5) {
        insights.push({
          kind: 'angle_winning',
          message: `Vos posts longs (>500 chars) performent ~${Math.round(avgLong / Math.max(avgShort, 1) * 100 - 100)}% mieux que les courts.`,
          data: { avgShort: Math.round(avgShort), avgLong: Math.round(avgLong) }
        });
      }
    }
  } catch { /* silent */ }

  // 3d. V11.4 §7 — Weekday opportunity : si on n'a aucun post prévu dans les 7
  // prochains jours pour le meilleur weekday détecté, on signale l'opportunité.
  try {
    const { data: pubs } = await supabase
      .from('post_embeddings')
      .select('scheduled_at, meta')
      .eq('status', 'published')
      .limit(120);
    const dayPerf: Record<number, { sum: number; n: number }> = {};
    const FR_DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    for (const p of (pubs || [])) {
      const imp = typeof (p.meta as any)?.impressions === 'number' ? (p.meta as any).impressions : 0;
      if (!p.scheduled_at || imp <= 0) continue;
      const dow = new Date(p.scheduled_at).getDay();
      if (!dayPerf[dow]) dayPerf[dow] = { sum: 0, n: 0 };
      dayPerf[dow].sum += imp;
      dayPerf[dow].n += 1;
    }
    const sorted = Object.entries(dayPerf)
      .filter(([, v]) => v.n >= 3)
      .map(([d, v]) => ({ dow: parseInt(d, 10), avg: v.sum / v.n }))
      .sort((a, b) => b.avg - a.avg);
    if (sorted.length >= 2) {
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      // Seulement si le meilleur jour fait au moins +30% vs la moyenne
      if (best.avg > worst.avg * 1.3) {
        // Cherche-t-on déjà un post programmé sur ce jour dans les 7 prochains ?
        const { data: planned } = await supabase
          .from('post_embeddings')
          .select('scheduled_at')
          .gte('scheduled_at', new Date().toISOString())
          .lte('scheduled_at', new Date(Date.now() + 7 * 86_400_000).toISOString());
        const hasPlanned = (planned || []).some(p => p.scheduled_at && new Date(p.scheduled_at).getDay() === best.dow);
        if (!hasPlanned) {
          // Date du prochain "best day"
          const today = new Date();
          const offset = (best.dow - today.getDay() + 7) % 7 || 7;
          const next = new Date(today.getTime() + offset * 86_400_000);
          const niceDay = FR_DAYS[best.dow];
          const niceDate = next.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' });
          insights.push({
            kind: 'weekday_opportunity',
            message: `Vos posts du ${niceDay} performent environ ${Math.round(best.avg / Math.max(worst.avg, 1) * 100 - 100)}% mieux. Rien n'est prévu pour le prochain (${niceDate}).`,
            cta_label: 'Préparer un post',
            cta_href: `/posts/new?date=${next.toISOString().slice(0, 10)}`,
            data: { dow: best.dow, dayLabel: niceDay, nextDate: next.toISOString().slice(0, 10), avgBest: Math.round(best.avg) },
          });
        }
      }
    }
  } catch { /* silent */ }

  return insights;
}

// === 4. Enriched "why now" pour une suggestion donnée ===
// Si on a une suggestion brute (depuis radar.ts), on peut enrichir son "why" en cross-référençant.
export async function whyNowFor(suggestion: { title: string; pilier?: string | null; payload?: any }): Promise<string | null> {
  try {
    const reasons: string[] = [];

    // 1. Pilier silence
    if (suggestion.pilier) {
      const stats = await pilierStats();
      const s = stats.find(x => x.pilier === suggestion.pilier || (suggestion.pilier && x.pilier.includes(suggestion.pilier.split(' · ')[1] || '')));
      if (s && s.daysSinceLast !== null && s.daysSinceLast > 10) {
        reasons.push(`Pas de post "${s.pilier.split(' · ')[1]}" depuis ${s.daysSinceLast}j.`);
      }
    }

    // 2. Topic match
    const titleLower = suggestion.title.toLowerCase();
    const topics = await trackedTopicStatus();
    for (const t of topics) {
      const matched = TRACKED_TOPICS.find(x => x.key === t.topic);
      if (!matched) continue;
      if (matched.synonyms.some(s => titleLower.includes(s.toLowerCase()))) {
        if (t.lastDays === null) reasons.push(`Premier post sur ${t.topic}.`);
        else if (t.lastDays > 21) reasons.push(`Pas parlé de ${t.topic} depuis ${t.lastDays}j.`);
        break;
      }
    }

    // 3. Saturation sémantique
    if ((suggestion.payload as any)?.saturation > 2) {
      reasons.push(`Sujet ressemble à ${(suggestion.payload as any).saturation} posts récents — préférez l'angle opinion.`);
    } else if ((suggestion.payload as any)?.novelty > 0.7) {
      reasons.push(`Angle inédit dans vos archives.`);
    }

    return reasons.length ? reasons.join(' ') : null;
  } catch { return null; }
}
