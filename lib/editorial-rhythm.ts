// V34.1 — Editorial rhythm engine
//
// Cadence n'est pas qu'un éditeur de posts. C'est un directeur éditorial
// qui regarde la cadence sur 30 jours et signale les déséquilibres :
//
// - "vous n'avez pas raconté de scène concrète depuis 12 jours"
// - "votre 3 derniers posts sont opinion / opinion / opinion : trop monotone"
// - "vous n'avez pas fait de cas client depuis 18 jours"
// - "vous avez 5 posts pédagogiques en 14 jours, vos lecteurs vont saturer"
// - "vous alternez bien preuve → opinion → pédagogie"
//
// Pure logique heuristique. Aucune IA appelée. Lit content_items
// (linkedin_published + linkedin_import_zip + cadence_generated) sur
// les 30 derniers jours et applique des règles éditoriales.

import { supabase } from './supabase';

export type RhythmInsight = {
  kind:
    | 'pilier_gap'              // pas de pilier X depuis N jours
    | 'narrative_gap'           // pas de structure narrative X depuis N jours
    | 'fatigue'                 // 3+ posts consécutifs même pilier
    | 'overconcentration'       // > 60 % d'un seul pilier sur 14 jours
    | 'rotation_healthy'        // alternance saine sur 7 derniers posts
    | 'no_concrete_scene'       // pas de scène concrète récente
    | 'no_proof'                // pas de chiffre / fait récent
    | 'low_data';               // pas assez de posts pour analyser
  message: string;
  severity: 'note' | 'soft' | 'firm';
  data?: any;
};

// Mapping rapide pilier → catégorie large
function categorize(pilier?: string | null): string {
  if (!pilier) return 'autre';
  const p = pilier.toLowerCase();
  if (p.includes('cas client') || p.includes('cas dirigeant')) return 'cas';
  if (p.includes('pédagogie') || p.includes('pedagogie')) return 'pedagogie';
  if (p.includes('produit') || p.includes('démo') || p.includes('demo') || p.includes('release')) return 'produit';
  if (p.includes('opinion') || p.includes('hot take')) return 'opinion';
  if (p.includes('build in public')) return 'build';
  return 'autre';
}

const CAT_LABELS: Record<string, string> = {
  cas:        'cas client',
  pedagogie:  'pédagogie',
  produit:    'produit',
  opinion:    'opinion',
  build:      'build in public',
  autre:      'autre',
};

const CAT_GAP_THRESHOLD: Record<string, number> = {
  // En jours, au-delà desquels on signale "vous n'avez pas fait X depuis"
  cas:       14,
  pedagogie: 14,
  produit:   21,
  opinion:   14,
  build:     14,
  autre:     30,
};

const NARRATIVE_LABELS: Record<string, string> = {
  hook_promet_trop:        'hooks qui promettent trop',
  morale_finale_assenee:   'morale assénée',
  sans_friction_concrete:  'posts sans friction',
  manque_bascule:          'posts sans bascule',
  scene_absente:           'posts sans scène',
  tout_demonstratif:       'posts démonstratifs',
  lineaire_explicatif:     'posts explicatifs',
  ralentit_trop:           'paragraphes trop longs',
};

// V34.1 — Pure : prend une liste de posts publiés/confirmés et renvoie
// les insights. Pas d'IO ici.
export function analyzeRhythm(
  posts: Array<{ pilier?: string | null; published_at?: string | null; text?: string | null; narrative_kind?: string | null }>
): RhythmInsight[] {
  const insights: RhythmInsight[] = [];
  const now = Date.now();
  const DAY = 86_400_000;

  // 1. Tri par date desc
  const sorted = posts
    .filter(p => p.published_at)
    .map(p => ({
      ...p,
      ts: new Date(p.published_at as string).getTime(),
      cat: categorize(p.pilier),
    }))
    .filter(p => Number.isFinite(p.ts) && now - p.ts < 60 * DAY)
    .sort((a, b) => b.ts - a.ts);

  if (sorted.length < 4) {
    insights.push({
      kind: 'low_data',
      severity: 'note',
      message: `Seulement ${sorted.length} post${sorted.length > 1 ? 's' : ''} confirmé${sorted.length > 1 ? 's' : ''} sur 60 jours. Les insights éditoriaux s'enrichiront au fil des publications.`,
    });
    return insights;
  }

  // 2. Gap par pilier (depuis combien de jours pas vu)
  const lastSeen: Record<string, number> = {};
  for (const p of sorted) {
    if (!lastSeen[p.cat]) lastSeen[p.cat] = p.ts;
  }
  const cats = Object.keys(CAT_GAP_THRESHOLD).filter(c => c !== 'autre');
  for (const c of cats) {
    const last = lastSeen[c];
    const days = last ? Math.floor((now - last) / DAY) : 999;
    const threshold = CAT_GAP_THRESHOLD[c];
    if (days >= threshold) {
      insights.push({
        kind: 'pilier_gap',
        severity: days >= threshold * 1.5 ? 'firm' : 'soft',
        message: last
          ? `Vous n'avez pas fait de ${CAT_LABELS[c]} depuis ${days} jours.`
          : `Aucun post ${CAT_LABELS[c]} sur les 60 derniers jours.`,
        data: { cat: c, days, lastTs: last || null },
      });
    }
  }

  // 3. Fatigue : 3+ posts consécutifs même catégorie
  const last5 = sorted.slice(0, 5);
  if (last5.length >= 3) {
    const cat0 = last5[0].cat;
    if (cat0 !== 'autre' && last5[0].cat === last5[1].cat && last5[1].cat === last5[2].cat) {
      insights.push({
        kind: 'fatigue',
        severity: 'firm',
        message: `Vos 3 derniers posts sont ${CAT_LABELS[cat0]}. Variez le pilier pour ne pas saturer votre audience.`,
        data: { cat: cat0 },
      });
    }
  }

  // 4. Overconcentration sur 14 jours
  const window14 = sorted.filter(p => now - p.ts < 14 * DAY);
  if (window14.length >= 4) {
    const counts: Record<string, number> = {};
    for (const p of window14) {
      counts[p.cat] = (counts[p.cat] || 0) + 1;
    }
    const total = window14.length;
    const topEntry = Object.entries(counts).filter(([k]) => k !== 'autre').sort((a, b) => b[1] - a[1])[0];
    if (topEntry && topEntry[1] / total >= 0.6 && topEntry[1] >= 3) {
      insights.push({
        kind: 'overconcentration',
        severity: 'soft',
        message: `${topEntry[1]} de vos ${total} posts récents sont ${CAT_LABELS[topEntry[0]]}. Une alternance ferait respirer le flux.`,
        data: { cat: topEntry[0], ratio: topEntry[1] / total },
      });
    }
  }

  // 5. No concrete scene récente : aucun post des 14 derniers jours
  //    n'a un kind "scene" / "cas" ou ne contient les marqueurs de scène
  const sceneRecent = window14.find(p => {
    if (p.cat === 'cas') return true;
    const t = (p.text || '').toLowerCase();
    return /\b(hier|ce matin|un\s+(?:dirigeant|client|banquier)|m['e]?a\s+(?:dit|appelé|écrit))/i.test(t);
  });
  if (!sceneRecent && window14.length >= 3) {
    insights.push({
      kind: 'no_concrete_scene',
      severity: 'soft',
      message: 'Aucune scène concrète dans vos 14 derniers jours. Un cas dirigeant raconté ancrerait le flux.',
    });
  }

  // 6. No proof : aucun chiffre / fait précis dans les 14 derniers jours
  const hasProofRecent = window14.some(p => {
    const t = p.text || '';
    return /\b\d{1,3}(?:[\s.,]\d{3})*\s*(?:%|€|k€|jours?|mois|fois|ans?)\b/i.test(t);
  });
  if (!hasProofRecent && window14.length >= 3) {
    insights.push({
      kind: 'no_proof',
      severity: 'soft',
      message: 'Aucun chiffre concret dans vos 14 derniers posts. Un montant, un délai, un ratio ré-ancrerait le terrain.',
    });
  }

  // 7. Rotation saine — bonus positif si alternance détectée
  const last7 = sorted.slice(0, 7);
  const cats7 = last7.map(p => p.cat).filter(c => c !== 'autre');
  const uniqueCats = new Set(cats7);
  if (last7.length >= 5 && uniqueCats.size >= 3) {
    insights.push({
      kind: 'rotation_healthy',
      severity: 'note',
      message: `Vos 7 derniers posts couvrent ${uniqueCats.size} piliers différents. L'alternance est saine.`,
    });
  }

  // 8. Narrative gap : si on a une narrative_kind dominante depuis longtemps
  const narrativeCount: Record<string, number> = {};
  for (const p of sorted) {
    if (p.narrative_kind) narrativeCount[p.narrative_kind] = (narrativeCount[p.narrative_kind] || 0) + 1;
  }
  // Si plus de 50 % des posts récents partagent le même narrative_kind, c'est trop
  const totalWithKind = Object.values(narrativeCount).reduce((a, b) => a + b, 0);
  if (totalWithKind >= 5) {
    const topNarr = Object.entries(narrativeCount).sort((a, b) => b[1] - a[1])[0];
    if (topNarr && topNarr[1] / totalWithKind >= 0.5) {
      insights.push({
        kind: 'narrative_gap',
        severity: 'note',
        message: `${topNarr[1]} de vos ${totalWithKind} posts récents partagent la structure « ${NARRATIVE_LABELS[topNarr[0]] || topNarr[0]} ». Variez l'angle narratif.`,
        data: { narrative_kind: topNarr[0], ratio: topNarr[1] / totalWithKind },
      });
    }
  }

  return insights;
}

// V34.1 — Wrapper async : récupère les posts récents depuis content_items
// et appelle analyzeRhythm. Utilisé par /api/editorial-rhythm.
export async function fetchEditorialRhythm(): Promise<RhythmInsight[]> {
  try {
    const { data, error } = await supabase
      .from('content_items')
      .select('content, pilier, published_at, meta, source_type')
      .or('source_type.eq.linkedin_published,source_type.eq.linkedin_import_zip,source_type.eq.cadence_generated')
      .not('published_at', 'is', null)
      .gte('published_at', new Date(Date.now() - 60 * 86_400_000).toISOString())
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(60);
    if (error) return [{ kind: 'low_data', severity: 'note', message: 'Lecture des posts impossible (table content_items indisponible).' }];
    const posts = (data || []).map((r: any) => ({
      pilier: r.pilier as string | null,
      published_at: r.published_at as string | null,
      text: r.content as string | null,
      narrative_kind: (r.meta as any)?.narrative_kind || null,
    }));
    return analyzeRhythm(posts);
  } catch (e: any) {
    return [{ kind: 'low_data', severity: 'note', message: 'Analyse impossible : ' + (e?.message || 'erreur inconnue') }];
  }
}
