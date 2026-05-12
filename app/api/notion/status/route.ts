import { NextResponse } from 'next/server';
import { notionStatus } from '@/lib/notion';

export async function GET() {
  const s = await notionStatus();
  return NextResponse.json(s);
}
