import { NextResponse } from 'next/server';
import { runAllRadars } from '@/lib/radar';

export const runtime = 'nodejs';
export const maxDuration = 60;

// V11.4 — Refresh radar : POST manuel (UI /suggestions) + GET cron Vercel.
// Vercel cron envoie GET avec Authorization: Bearer ${CRON_SECRET}.

function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

async function runAndReturn() {
  const r = await runAllRadars();
  return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), ...r });
}

export async function POST() {
  try { return await runAndReturn(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function GET(req: Request) {
  try {
    if (!cronAuthorized(req)) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    return await runAndReturn();
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
