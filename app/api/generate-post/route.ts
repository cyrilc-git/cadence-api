import { NextRequest, NextResponse } from 'next/server';
import { generateThreeProposals, type VoiceMode } from '@/lib/anthropic';
import { readStyleMemory } from '@/lib/style-memory';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { pilier, brief, inspirations, voiceMode } = body as {
    pilier?: string; brief?: string; inspirations?: string[]; voiceMode?: VoiceMode;
  };
  if (!brief || brief.trim().length < 5) {
    return NextResponse.json({ error: 'Brief trop court (5 caractères minimum).' }, { status: 400 });
  }
  try {
    // V18.4 — Si on est en mode "ma_voix" (ou défaut), on injecte la
    // signature stylistique observée pour que Claude la respecte.
    const wantsStyle = !voiceMode || voiceMode === 'ma_voix';
    let styleSummary: string | null = null;
    if (wantsStyle) {
      const mem = await readStyleMemory().catch(() => null);
      if (mem && mem.confidence_score >= 0.2 && mem.voice_summary) {
        styleSummary = mem.voice_summary;
      }
    }
    const r = await generateThreeProposals({ pilier, brief, inspirations, voiceMode, styleSummary });
    return NextResponse.json({ proposals: r.proposals, model: r.model, source: 'claude', voiceMode: voiceMode || 'ma_voix' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
