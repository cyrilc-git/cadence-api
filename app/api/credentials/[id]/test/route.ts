import { NextRequest, NextResponse } from 'next/server';
import { testCredential } from '@/lib/credentials';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const r = await testCredential(params.id);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
