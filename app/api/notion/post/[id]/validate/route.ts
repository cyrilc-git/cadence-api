import { NextRequest, NextResponse } from 'next/server';
import { setValidation, isValidated } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const validated = !!body.validated;
  try {
    await setValidation(params.id, validated);
    return NextResponse.json({ ok: true, validated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json({ validated: await isValidated(params.id) });
}
