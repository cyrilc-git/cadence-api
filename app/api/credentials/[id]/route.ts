import { NextRequest, NextResponse } from 'next/server';
import { deleteCredential, revokeCredential } from '@/lib/credentials';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try { await deleteCredential(params.id); return NextResponse.json({ ok: true }); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  if (body.action === 'revoke') {
    try { await revokeCredential(params.id); return NextResponse.json({ ok: true }); }
    catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
