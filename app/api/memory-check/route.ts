// V11.2 — Memory check : appelle noveltyScore + retourne un signal éditorial
// lisible. Utilisé par CadenceEditor (debounce côté client) pour afficher une
// ligne discrète "Cadence se souvient de…" ou "Angle inédit" pendant la frappe.

import { NextResponse } from 'next/server';
import { noveltyScore } from '@/lib/embeddings';

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

    // V11.5 — contre-angle proposé si saturation détectée
    let counterAngle: string | null = null;
    if (saturation >= 2) {
      kind = 'saturation';
      message = nearestInfo
        ? `Cadence se souvient de ${saturation} posts proches, dont « ${nearestInfo.title.slice(0, 60)} »${nearestInfo.daysAgo !== null ? ` il y a ${nearestInfo.daysAgo} jours` : ''}.`
        : `Cadence se souvient de ${saturation} posts proches dans votre archive.`;
      // Heuristique : choisir un angle opposé au texte
      const lower = text.toLowerCase();
      if (/\bcas\b|client|histoire|témoignage|vécu/.test(lower)) {
        counterAngle = 'Préférez un angle opinion ou contre-exemple pour éviter la répétition.';
      } else if (/\bopinion\b|à mon avis|je pense|hot take/.test(lower)) {
        counterAngle = 'Préférez un cas anonymisé chiffré pour démontrer plutôt que défendre.';
      } else if (/comment|pourquoi|étape|leçon|conseil/.test(lower)) {
        counterAngle = 'Préférez un build in public ou un retour d\'expérience pour varier.';
      } else {
        counterAngle = 'Décalez l\'angle : opinion tranchée, contre-exemple ou retour chiffré.';
      }
    } else if (novelty >= 0.7) {
      kind = 'novelty';
      message = 'Angle inédit dans vos archives.';
    } else if (nearestInfo && nearestInfo.daysAgo !== null && nearestInfo.daysAgo < 90) {
      kind = 'familiar';
      message = `Sujet proche d'un post du ${new Date(nearestInfo.scheduled_at!).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}.`;
    }

    return NextResponse.json({
      kind,
      message,
      counterAngle,
      novelty: Math.round(novelty * 100),
      saturation,
      nearest: nearestInfo,
    });
  } catch (e: any) {
    return NextResponse.json({ kind: 'none', message: null, error: e.message }, { status: 200 });
  }
}
