import { NextRequest, NextResponse } from 'next/server';
import { suggestionSetStatus } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const { status } = body as { status?: 'pending' | 'used' | 'ignored' | 'saved' };
  if (!status) return NextResponse.json({ error: 'status required' }, { status: 400 });
  try {
    await suggestionSetStatus(params.id, status);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
