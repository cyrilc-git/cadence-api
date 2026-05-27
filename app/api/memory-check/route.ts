// V11.2 — Memory check : appelle noveltyScore + retourne un signal éditorial
// lisible. Utilisé par CadenceEditor (debounce côté client) pour afficher une
// ligne discrète "Cadence se souvient de…" ou "Angle inédit" pendant la frappe.

import { NextResponse } from 'next/server';
import { noveltyScore } from '@/lib/embeddings';
import { analyzeNarrative } from '@/lib/narrative-check';
import { readStyleMemory, scoreStyleSimilarity } from '@/lib/style-memory';
import { planSlides } from '@/lib/carousel';

export const runtime = 'nodejs';
export const maxDuration = 15;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (text.length < 40) {
      return NextResponse.json({ kind: 'none', message: null });
    }
    const { novelty, saturation, nearest } = await noveltyScore(text);

    let kind: 'saturation' | 'novelty' | 'familiar' | 'none' = 'none';
    let message: string | null = null;
    let nearestInfo: { title: string; scheduled_at: string | null; daysAgo: number | null } | null = null;

    if (nearest && nearest.scheduled_at) {
      const d = new Date(nearest.scheduled_at).getTime();
      const daysAgo = Number.isFinite(d) ? Math.floor((Date.now() - d) / 86_400_000) : null;
      nearestInfo = {
        title: nearest.title || 'post sans titre',
        scheduled_at: nearest.scheduled_at,
        daysAgo,
      };
    }

    // V11.5 + V15.7 — contre-angle proposé si saturation détectée.
    // Messages reformulés pour parler comme un éditeur, pas comme un système.
    let counterAngle: string | null = null;
    if (saturation >= 2) {
      kind = 'saturation';
      if (nearestInfo) {
        const recent = nearestInfo.daysAgo !== null && nearestInfo.daysAgo < 30;
        message = recent
          ? `Vous revenez sur un sujet déjà traité il y a ${nearestInfo.daysAgo} jours : « ${nearestInfo.title.slice(0, 60)} ».`
          : `Sujet déjà traité ${saturation} fois dans vos archives, dont « ${nearestInfo.title.slice(0, 60)} »${nearestInfo.daysAgo !== null ? ` il y a ${nearestInfo.daysAgo} jours` : ''}.`;
      } else {
        message = `Sujet déjà traité ${saturation} fois dans vos archives.`;
      }
      const lower = text.toLowerCase();
      if (/\bcas\b|client|histoire|témoignage|vécu/.test(lower)) {
        counterAngle = 'Pour éviter la répétition, prenez l\'angle opinion ou contre-exemple.';
      } else if (/\bopinion\b|à mon avis|je pense|hot take/.test(lower)) {
        counterAngle = 'Pour varier, racontez un cas anonymisé chiffré plutôt que de défendre.';
      } else if (/comment|pourquoi|étape|leçon|conseil/.test(lower)) {
        counterAngle = 'Pour varier, partez d\'un build in public ou d\'un retour d\'expérience.';
      } else {
        counterAngle = 'Décalez l\'angle : opinion tranchée, contre-exemple ou retour chiffré.';
      }
    } else if (novelty >= 0.7) {
      kind = 'novelty';
      message = 'Premier post sur ce sujet — angle inédit pour vos lecteurs.';
    } else if (nearestInfo && nearestInfo.daysAgo !== null && nearestInfo.daysAgo < 90) {
      kind = 'familiar';
      const dateStr = new Date(nearestInfo.scheduled_at!).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' });
      message = nearestInfo.daysAgo < 14
        ? `Vous avez touché ce sujet le ${dateStr} (il y a ${nearestInfo.daysAgo} jours).`
        : `Sujet déjà abordé le ${dateStr}, mais l'angle peut être renouvelé.`;
    }

    // V12.6 — Visual hint : Cadence suggère un format graphique selon le texte.
    // Heuristique simple, jamais bavarde (un seul message court si pertinent).
    const visualHint = inferVisualHint(text);

    // V16.5 — Narrative signal : 0 ou 1 signal narratif (tension, friction,
    // bascule, hook qui promet trop, morale assénée…). Renvoyé en plus du
    // memory signal. CadenceEditor décide de l'affichage en priorité.
    const narrativeSignal = analyzeNarrative(text);
    const narrative = narrativeSignal.kind !== 'none' ? {
      kind: narrativeSignal.kind,
      message: narrativeSignal.message,
      severity: narrativeSignal.severity,
    } : null;

    // V18.5 — Détection de répétition stylistique : si la 1ère ligne
    // commence par les MÊMES mots que des hooks ou des openings récurrents
    // de la signature personnelle, on signale doucement. Cadence pousse
    // la variété sans bloquer (toujours dismissable côté éditeur).
    let styleRepetition: { kind: 'opening' | 'hook' | 'closing'; message: string } | null = null;
    // V21.1 — Similarity score : "très vous / un peu vous / éloigné"
    let styleSimilarity: { score: number; label: string; message: string; reasons: string[] } | null = null;
    try {
      // V31.3 — withFingerprints permet d'enrichir les raisons du
      // similarity score avec des comparaisons qualitatives (hook habituel
      // vs hook draft, rythme habituel vs rythme draft).
      const mem = await readStyleMemory({ withFingerprints: true });
      // V21.1 — Score de similarité (à partir de 5 posts analysés)
      if (mem && mem.posts_analyzed >= 5 && text.length >= 200) {
        const sim = scoreStyleSimilarity(text, mem);
        if (sim.label !== 'inconnu') {
          styleSimilarity = {
            score: sim.score,
            label: sim.label,
            message: sim.message,
            reasons: sim.reasons,
          };
        }
      }
      if (mem && mem.confidence_score >= 0.3) {
        const firstLine = text.split('\n').find((l: string) => l.trim().length > 0) || '';
        const firstWords4 = firstLine.toLowerCase().split(/\s+/).slice(0, 4).join(' ');
        const firstWords5 = firstLine.toLowerCase().split(/\s+/).slice(0, 5).join(' ');
        // Match contre les openings récurrents (déjà en lowercase normalisé)
        const matchOpening = mem.top_openings.find(o => {
          const oNorm = o.toLowerCase();
          return oNorm === firstWords4 || oNorm === firstWords5 ||
                 (firstWords4.length > 8 && oNorm.startsWith(firstWords4));
        });
        if (matchOpening) {
          styleRepetition = {
            kind: 'opening',
            message: `Vous commencez souvent par « ${matchOpening}… ». Tentez un opening différent pour varier le rythme.`,
          };
        } else {
          // Phrases répétées (top_closings ou repeated_phrases) — match
          // approximatif sur les 5 derniers mots non-vides.
          const lastLine = text.split('\n').reverse().find((l: string) => l.trim().length > 0) || '';
          const lastWords5 = lastLine.toLowerCase().split(/\s+/).slice(-5).join(' ');
          const matchClosing = mem.top_closings.find(c => {
            const cNorm = c.toLowerCase();
            return lastWords5.endsWith(cNorm) || cNorm.endsWith(lastWords5.slice(-12));
          });
          if (matchClosing && text.length > 300) {
            styleRepetition = {
              kind: 'closing',
              message: `Vous fermez souvent par « ${matchClosing}… ». Une chute différente surprendrait votre audience.`,
            };
          }
        }
      }
    } catch { /* silent : table peut ne pas exister */ }

    // V18.9 — Carousel hint : si le texte structure naturellement un
    // carrousel (liste / framework / étapes / comparaison / timeline /
    // case-study), on signale doucement la possibilité d'export PDF.
    // Seuil : texte > 600 chars et format détecté autre que 'breakdown'
    // (le défaut). En dessous, pas de pertinence à proposer.
    let carouselHint: { format: string; message: string; slides: number } | null = null;
    if (text.length > 600) {
      try {
        const plan = planSlides(text);
        if (plan.format !== 'breakdown' && plan.totalSlides >= 3 && plan.totalSlides <= 12) {
          const formatLabel = {
            pedagogical: 'pédagogique',
            framework: 'framework',
            breakdown: 'décortiquage',
            'case-study': 'cas client',
            timeline: 'timeline',
            comparison: 'comparaison',
          }[plan.format];
          carouselHint = {
            format: plan.format,
            slides: plan.totalSlides,
            message: `Ce sujet fonctionnerait bien en carrousel ${formatLabel} (${plan.totalSlides} slides).`,
          };
        }
      } catch { /* silent */ }
    }

    return NextResponse.json({
      kind,
      message,
      counterAngle,
      visualHint,
      narrative,
      styleRepetition,
      styleSimilarity,
      carouselHint,
      novelty: Math.round(novelty * 100),
      saturation,
      nearest: nearestInfo,
    });
  } catch (e: any) {
    return NextResponse.json({ kind: 'none', message: null, error: e.message }, { status: 200 });
  }
}

// V12.6 — Détection de format visuel pertinent depuis le texte.
// Heuristique éditoriale : ce que la structure du texte suggère graphiquement.
// Toujours optionnel : si rien n'émerge clairement, retourne null.
function inferVisualHint(text: string): { format: string; message: string } | null {
  const t = text.toLowerCase();
  const lines = text.split('\n').filter(l => l.trim()).length;
  const chars = text.length;

  // V15.7 — messages plus directs (ton éditorial, pas descriptif).
  // 1. Beaucoup de structure (numérotation, étapes, listes) -> schéma
  const stepMarkers = (text.match(/\b(étape|step|leçon|raison|astuce)\s*\d*/gi) || []).length;
  const numberedLines = (text.match(/^\s*(\d+\.|\d+\)|[-•])\s+/gm) || []).length;
  if (stepMarkers >= 2 || numberedLines >= 3) {
    return { format: 'schema', message: 'Cette structure en étapes appelle un schéma plutôt qu\'une illustration.' };
  }

  // 2. Chiffre central marquant -> data visualisation
  const numericHits = (text.match(/\b\d{2,}(\s*[%€$kKMm])?\b/g) || []).length;
  if (numericHits >= 2 && chars < 1500) {
    return { format: 'data', message: 'Un chiffre central en gros, fond clair : ça accroche mieux qu\'une illustration.' };
  }

  // 3. Texte long et structuré -> carrousel
  if (chars > 1500 && lines > 8) {
    return { format: 'carousel', message: 'Ce volume se prête à un carrousel : une idée par slide.' };
  }

  // 4. Hook très court, peu de texte -> visuel minimaliste
  if (chars < 400 && lines < 4) {
    return { format: 'illustration', message: 'Hook court : un visuel minimaliste, un seul élément graphique fort.' };
  }

  return null;
}
