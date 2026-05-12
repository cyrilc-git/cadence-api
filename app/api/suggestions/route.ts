import { NextRequest, NextResponse } from 'next/server';
import { suggestionsList } from '@/lib/db';

export async function GET(req: NextRequest) {
  const status = new URL(req.url).searchParams.get('status') || undefined;
  try {
    const data = await suggestionsList(status, 50);
    return NextResponse.json({ suggestions: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
