import { NextRequest, NextResponse } from 'next/server';
import { seedBrandDna, seedInspirations } from '@/lib/seed';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  // Restrict to logged-in (same-origin) or Bearer CRON_SECRET
  const referer = req.headers.get('referer') || '';
  const host    = req.headers.get('host')    || '';
  const auth    = req.headers.get('authorization') || '';
  if (!referer.includes(host) && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const [dna, ins] = await Promise.all([seedBrandDna(), seedInspirations()]);
    return NextResponse.json({ ok: true, brand_dna: dna, inspirations: ins });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
