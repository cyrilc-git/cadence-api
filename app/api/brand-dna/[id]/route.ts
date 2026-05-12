import { NextRequest, NextResponse } from 'next/server';
import { brandDnaUpsert, brandDnaDelete } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  try { return NextResponse.json({ item: await brandDnaUpsert({ ...body, id: params.id }) }); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try { await brandDnaDelete(params.id); return NextResponse.json({ ok: true }); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
