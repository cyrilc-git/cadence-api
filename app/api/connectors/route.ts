import { NextResponse } from 'next/server';
import { connectorsStatus } from '@/lib/db';

export async function GET() {
  try { return NextResponse.json({ connectors: await connectorsStatus() }); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
