// V9.0 §1 — Vraie planification hebdomadaire intelligente.
// Lit : embeddings (post_embeddings) + suggestions + pilierStats + trackedTopicStatus.
// Décide : pour chaque jour ouvré, quel pilier × quel angle × quel format.
// Sort : un plan structuré avec justification factuelle ("pourquoi ce sujet maintenant ?").

import { supabase } from './supabase';
import { pilierStats, trackedTopicStatus, PilierStat } from './radar-insights';

export type DayPlan = {
  weekday: number;         // 1..5
  label: string;           // 'Lundi'..'Vendredi'
  date: string;            // 'YYYY-MM-DD'
  pilier: string;          // ex: 'Lundi · Cas client'
  topic_hint: string | null;     // ex: 'Decode' ou null
  brief: string;           // brief que /api/generate-post va consommer
  reason: string;          // pourquoi ce sujet, ce jour
  format: string;          // 'opinion' | 'pedagogie' | 'demo' | 'cas' | 'build' | 'text'
  source: 'pilier_silence' | 'topic_revival' | 'topic_never' | 'recyclable' | 'standard';
};

const DAY_LABELS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

// Mapping standard jour → pilier par défaut (override possible si analyse révèle déséquilibre)
const STANDARD_DAY_PILIER: Record<number, string> = {
  1: 'Lundi · Cas client',
  2: 'Mardi · Pédagogie',
  3: 'Mercredi · Produit',
  4: 'Jeudi · Opinion',
  5: 'Vendredi · Build in public',
};

const PILIER_FORMAT: Record<string, string> = {
  'Lundi · Cas client': 'cas',
  'Mardi · Pédagogie': 'pedagogie',
  'Mercredi · Produit': 'demo',
  'Jeudi · Opinion': 'opinion',
  'Vendredi · Build in public': 'build',
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Date d'un jour ouvré N de la semaine prochaine
function nextWeekday(weekday: number, from = new Date()): Date {
  const d = new Date(from);
  d.setHours(7, 30, 0, 0);
  // Avancer jusqu'au lundi suivant
  const dow = d.getDay();
  const daysToNextMonday = ((1 - dow) + 7) % 7 || 7;
  d.setDate(d.getDate() + daysToNextMonday);
  // Puis avancer jusqu'au weekday cible
  const offset = ((weekday - 1) + 7) % 7;
  d.setDate(d.getDate() + offset);
  return d;
}

// Topic helpers — quels sujets sont "frais à parler" ?
type TopicCandidate = { key: string; lastDays: number | null; count60d: number; freshness: number };

async function rankTopics(): Promise<TopicCandidate[]> {
  const topics = await trackedTopicStatus();
  return topics.map(t => {
    let freshness = 0;
    if (t.lastDays === null) freshness = 100; // jamais publié = max
    else if (t.lastDays > 30) freshness = 80;
    else if (t.lastDays > 14) freshness = 60;
    else if (t.lastDays > 7)  freshness = 40;
    else freshness = 10; // récent
    if (t.count60d > 4) freshness -= 30; // saturé
    return { key: t.key, lastDays: t.lastDays, count60d: t.count60d, freshness };
  }).sort((a, b) => b.freshness - a.freshness);
}

// Pilier helpers — lequel mérite le plus d'être touché ?
function rankPiliers(stats: PilierStat[]): PilierStat[] {
  return [...stats].sort((a, b) => {
    // Priorité aux piliers silencieux
    const aDays = a.daysSinceLast === null ? 999 : a.daysSinceLast;
    const bDays = b.daysSinceLast === null ? 999 : b.daysSinceLast;
    return bDays - aDays;
  });
}

// Recyclables — anciens posts performants à reprendre
async function topRecyclables(): Promise<Array<{ title: string; pilier: string | null; lastDays: number; impressions: number }>> {
  const { data } = await supabase
    .from('post_embeddings')
    .select('title, pilier, scheduled_at, meta')
    .eq('status', 'published')
    .order('scheduled_at', { ascending: false, nullsFirst: false })
    .limit(80);
  const ninety = Date.now() - 1000 * 60 * 60 * 24 * 90;
  const out: Array<{ title: string; pilier: string | null; lastDays: number; impressions: number }> = [];
  for (const p of data || []) {
    if (!p.scheduled_at) continue;
    const t = new Date(p.scheduled_at).getTime();
    if (t > ninety) continue;
    const imp = (p.meta as any)?.impressions || 0;
    if (imp < 500) continue;
    out.push({
      title: p.title || 'Sans titre',
      pilier: p.pilier,
      lastDays: Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)),
      impressions: imp
    });
  }
  return out.sort((a, b) => b.impressions - a.impressions).slice(0, 6);
}

// === MAIN PLANNER ===
export async function planNextWeek(): Promise<DayPlan[]> {
  const [stats, topics, recyclables] = await Promise.all([
    pilierStats().catch(() => []),
    rankTopics().catch(() => []),
    topRecyclables().catch(() => [])
  ]);

  const piliersByOpportunity = rankPiliers(stats);
  const plan: DayPlan[] = [];

  // Pool des topics frais disponibles (consommés au fur et à mesure)
  const topicPool = topics.filter(t => t.freshness > 30);
  const usedTopics = new Set<string>();
  const usedPiliers = new Set<string>();

  for (let wd = 1; wd <= 5; wd++) {
    const date = ymd(nextWeekday(wd));
    const labelDay = DAY_LABELS[wd];

    // 1. Pilier par défaut du jour
    let pilier = STANDARD_DAY_PILIER[wd];

    // 2. Si on a déjà couvert ce pilier cette semaine ET qu'un autre est franchement silencieux, swap
    const standardStat = piliersByOpportunity.find(s => s.pilier === pilier);
    const silentAlternative = piliersByOpportunity.find(s =>
      !usedPiliers.has(s.pilier) &&
      s.pilier !== pilier &&
      (s.daysSinceLast === null || (s.daysSinceLast > 21 && (standardStat?.daysSinceLast || 0) < 14))
    );
    if (silentAlternative) {
      pilier = silentAlternative.pilier;
    }
    usedPiliers.add(pilier);

    // 3. Choisir un topic frais qui n'a pas encore été utilisé
    const freshTopic = topicPool.find(t => !usedTopics.has(t.key));
    let topicHint: string | null = null;
    let source: DayPlan['source'] = 'standard';
    let reason = '';

    if (freshTopic) {
      topicHint = freshTopic.key;
      usedTopics.add(freshTopic.key);
      if (freshTopic.lastDays === null) {
        source = 'topic_never';
        reason = `Vous n'avez jamais publié sur ${freshTopic.key}.`;
      } else {
        source = 'topic_revival';
        reason = `Pas parlé de ${freshTopic.key} depuis ${freshTopic.lastDays}j.`;
      }
    } else if (standardStat && standardStat.daysSinceLast !== null && standardStat.daysSinceLast > 14) {
      source = 'pilier_silence';
      reason = `Pas de post "${pilier.split(' · ')[1] || pilier}" depuis ${standardStat.daysSinceLast}j.`;
    } else if (wd === 1 && recyclables.length > 0) {
      // Lundi → cas client : si pas de topic frais, proposer recyclage
      const r = recyclables[0];
      source = 'recyclable';
      reason = `Recyclage de "${r.title.slice(0, 60)}" (${r.impressions} impressions, publié il y a ${r.lastDays}j).`;
      topicHint = r.title;
    } else {
      source = 'standard';
      reason = `Rythme éditorial : ${pilier.split(' · ')[1] || pilier} pour ${labelDay.toLowerCase()}.`;
    }

    // 4. Brief que /api/generate-post va consommer
    const format = PILIER_FORMAT[pilier] || 'text';
    const baseBrief = topicHint
      ? `Sujet : ${topicHint}. Angle ${pilier.split(' · ')[1] || pilier}. ${reason}`
      : `Angle ${pilier.split(' · ')[1] || pilier} pour ${labelDay.toLowerCase()}. ${reason}`;

    plan.push({
      weekday: wd,
      label: labelDay,
      date,
      pilier,
      topic_hint: topicHint,
      brief: baseBrief,
      reason,
      format,
      source
    });
  }

  return plan;
}

// Helper pour le frontend : résumer le plan en 1-2 lignes
export function summarizePlan(plan: DayPlan[]): string {
  const variety = new Set(plan.map(p => p.pilier.split(' · ')[1] || p.pilier)).size;
  const topics = plan.filter(p => p.topic_hint).map(p => p.topic_hint).slice(0, 3);
  if (topics.length) {
    return `${variety} pilier${variety > 1 ? 's' : ''} couvert${variety > 1 ? 's' : ''}, avec ${topics.join(', ')} comme sujets phares.`;
  }
  return `${variety} pilier${variety > 1 ? 's' : ''} couvert${variety > 1 ? 's' : ''} cette semaine.`;
}
