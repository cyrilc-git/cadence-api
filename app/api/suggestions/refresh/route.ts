import { NextResponse } from 'next/server';
import { runAllRadars } from '@/lib/radar';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST() {
  try {
    const r = await runAllRadars();
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
