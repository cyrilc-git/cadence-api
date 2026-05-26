import { NextRequest, NextResponse } from 'next/server';
import { designSystemList, designSystemUpsert } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // V17.6 — support ?key=foo pour récupérer une seule valeur
    const url = new URL(req.url);
    const key = url.searchParams.get('key');
    if (key) {
      const all = await designSystemList();
      const item = all.find(i => i.key === key);
      return NextResponse.json(item || { key, value: null });
    }
    return NextResponse.json({ items: await designSystemList() });
  }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.key || !body.value) return NextResponse.json({ error: 'key and value required' }, { status: 400 });
  try { return NextResponse.json({ item: await designSystemUpsert(body) }); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
