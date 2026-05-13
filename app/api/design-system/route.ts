import { NextRequest, NextResponse } from 'next/server';
import { designSystemList, designSystemUpsert } from '@/lib/db';

export async function GET() {
  try { return NextResponse.json({ items: await designSystemList() }); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.key || !body.value) return NextResponse.json({ error: 'key and value required' }, { status: 400 });
  try { return NextResponse.json({ item: await designSystemUpsert(body) }); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
