import { NextRequest, NextResponse } from 'next/server';
import { listCredentials, saveCredential } from '@/lib/credentials';

export async function GET() {
  try { return NextResponse.json({ items: await listCredentials() }); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { provider, secret, label } = body;
  if (!provider || !secret) return NextResponse.json({ error: 'provider and secret required' }, { status: 400 });
  if (!process.env.MASTER_ENCRYPTION_KEY) return NextResponse.json({ error: 'MASTER_ENCRYPTION_KEY env var manquante. Ajoutez-la dans Vercel (≥ 32 chars).' }, { status: 400 });
  try { return NextResponse.json({ item: await saveCredential({ provider, secret, label }) }); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
