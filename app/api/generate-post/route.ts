import { NextRequest, NextResponse } from 'next/server';
import { generateThreeProposals, type VoiceMode } from '@/lib/anthropic';
import { readStyleMemory, buildStyleBlock } from '@/lib/style-memory';
import { inspirationsList } from '@/lib/db';

// V56 — Libellé prompt par dimension d'écriture. 'visual' n'entre pas ici (il
// nourrit /api/generate-visual). 'topics' est opt-in et signifie « thèmes, pas
// formulations » côté prompt.
const DIM_TEXT: Record<string, string> = { tone: 'Ton/voix', structure: 'Structure/rythme', topics: 'Angles/sujets' };

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { pilier, brief, voiceMode } = body as {
    pilier?: string; brief?: string; voiceMode?: VoiceMode;
  };
  if (!brief || brief.trim().length < 5) {
    return NextResponse.json({ error: 'Brief trop court (5 caractères minimum).' }, { status: 400 });
  }
  try {
    // V18.4 — Si on est en mode "ma_voix" (ou défaut), on injecte la
    // signature stylistique observée pour que Claude la respecte.
    // V25.4 — On enrichit avec les vrais hooks récents (référence
    // rythmique, NON à copier), les openings dominants (à varier
    // consciemment), et les mots favoris (à privilégier).
    // V58.9 — Bloc de voix riche via buildStyleBlock (source unique, partagée
    // avec composer + /api/chat).
    const wantsStyle = !voiceMode || voiceMode === 'ma_voix';
    let styleSummary: string | null = null;
    if (wantsStyle) {
      const mem = await readStyleMemory().catch(() => null);
      styleSummary = buildStyleBlock(mem);
    }
    // V56 — Inspirations scopées par dimension, chargées en base (autorité
    // serveur, pas le client). Chaque profil n'injecte QUE ses dimensions
    // d'écriture cochées ; le visuel est traité ailleurs. V58.2 — aucun repli
    // sur le client (il pourrait renvoyer des profils « visuel seulement »,
    // contournant le scoping). Si la base est injoignable : pas d'inspirations.
    let inspoForGen: string[] = [];
    try {
      const all = await inspirationsList();
      const scoped = all
        .filter(i => i.active && i.style_notes)
        .map(i => {
          const dims = (i.dimensions && i.dimensions.length ? i.dimensions : ['tone', 'structure']).filter(d => d !== 'visual');
          if (!dims.length) return null;
          const labels = dims.map(d => DIM_TEXT[d]).filter(Boolean).join(', ');
          return `[${labels}] ${i.style_notes}`;
        })
        .filter((x): x is string => !!x)
        .slice(0, 6);
      if (scoped.length) inspoForGen = scoped;
    } catch { /* repli client */ }

    const r = await generateThreeProposals({ pilier, brief, inspirations: inspoForGen, voiceMode, styleSummary });
    return NextResponse.json({ proposals: r.proposals, model: r.model, source: 'claude', voiceMode: voiceMode || 'ma_voix' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
