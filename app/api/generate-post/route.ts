import { NextRequest, NextResponse } from 'next/server';
import { generateThreeProposals } from '@/lib/anthropic';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { pilier, brief, inspirations } = body as { pilier?: string; brief?: string; inspirations?: string[] };
  if (!brief || brief.trim().length < 5) {
    return NextResponse.json({ error: 'Brief trop court (5 caractères minimum).' }, { status: 400 });
  }
  try {
    const r = await generateThreeProposals({ pilier, brief, inspirations });
    return NextResponse.json({ proposals: r.proposals, model: r.model, source: 'claude' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
