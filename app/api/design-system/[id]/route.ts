import { NextRequest, NextResponse } from 'next/server';
import { designSystemDelete } from '@/lib/db';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try { await designSystemDelete(params.id); return NextResponse.json({ ok: true }); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
