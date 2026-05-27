// V34.1 — Editorial rhythm endpoint
//
// GET → renvoie une liste d'insights éditoriaux sur les 60 derniers jours :
// piliers manquants, fatigue, overconcentration, rotation saine, scènes
// absentes, faits/chiffres absents, narrative gaps.
//
// Utilisé par /cerveau et potentiellement le dashboard pour murmurer un
// signal éditorial calme ("vous n'avez pas raconté de scène depuis…").

import { NextResponse } from 'next/server';
import { fetchEditorialRhythm } from '@/lib/editorial-rhythm';

export const runtime = 'nodejs';
export const maxDuration = 15;
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const insights = await fetchEditorialRhythm();
    return NextResponse.json({ insights });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'erreur inconnue' }, { status: 500 });
  }
}
