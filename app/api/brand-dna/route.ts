import { NextRequest, NextResponse } from 'next/server';
import { brandDnaList, brandDnaUpsert } from '@/lib/db';

export async function GET() {
  try { return NextResponse.json({ items: await brandDnaList() }); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.kind || !body.label) return NextResponse.json({ error: 'kind and label required' }, { status: 400 });
  try { return NextResponse.json({ item: await brandDnaUpsert(body) }); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
