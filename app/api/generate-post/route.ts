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
    // V25.4 — On enrichit avec les vrais hooks récents (référence
    // rythmique, NON à copier), les openings dominants (à varier
    // consciemment), et les mots favoris (à privilégier).
    const wantsStyle = !voiceMode || voiceMode === 'ma_voix';
    let styleSummary: string | null = null;
    if (wantsStyle) {
      const mem = await readStyleMemory().catch(() => null);
      if (mem && mem.confidence_score >= 0.2 && mem.voice_summary) {
        const parts: string[] = [mem.voice_summary];
        if (mem.top_hooks && mem.top_hooks.length > 0) {
          // V25.4 — Hooks réels : reference rythme/registre, jamais à
          // recopier verbatim (sinon Claude pastiche).
          parts.push('\nRÉFÉRENCES RYTHMIQUES (hooks que vous avez utilisés ; ne PAS recopier, mais reproduire le registre concret-imagé) :');
          for (const h of mem.top_hooks.slice(0, 3)) {
            parts.push(`- « ${h.replace(/[—–]/g, ',')} »`);
          }
        }
        if (mem.top_openings && mem.top_openings.length > 0) {
          parts.push('\nOPENINGS DOMINANTS (à VARIER consciemment, ne pas refaire le même attaque) :');
          for (const o of mem.top_openings.slice(0, 3)) {
            parts.push(`- « ${o}… »`);
          }
        }
        if (mem.favorite_words && mem.favorite_words.length > 0) {
          const words = mem.favorite_words.slice(0, 8).map((w: any) => w.word).join(', ');
          parts.push(`\nVOCABULAIRE NATUREL (mots récurrents dans vos posts, à privilégier quand c'est juste) : ${words}.`);
        }
        styleSummary = parts.join('\n');
      }
    }
    const r = await generateThreeProposals({ pilier, brief, inspirations, voiceMode, styleSummary });
    return NextResponse.json({ proposals: r.proposals, model: r.model, source: 'claude', voiceMode: voiceMode || 'ma_voix' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
