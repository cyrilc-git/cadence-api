import { NextRequest, NextResponse } from 'next/server';
import { inspirationsList, inspirationUpsert } from '@/lib/db';

export async function GET() {
  try { return NextResponse.json({ items: await inspirationsList() }); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  try { return NextResponse.json({ item: await inspirationUpsert(body) }); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
