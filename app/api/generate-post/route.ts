import { NextRequest, NextResponse } from 'next/server';
import { generateThreeProposals } from '@/lib/anthropic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { pilier, brief, inspirations } = body as { pilier?: string; brief?: string; inspirations?: string[] };
  if (!brief || brief.trim().length < 5) {
    return NextResponse.json({ error: 'brief_too_short' }, { status: 400 });
  }
  try {
    const r = await generateThreeProposals({ pilier, brief, inspirations });
    return NextResponse.json({ proposals: r.proposals });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
