import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  // V5.2 : scrape LinkedIn analytics — placeholder
  return NextResponse.json({ ok: true, note: 'V5.2 — scrape analytics non implémenté. Aujourd\'hui les chiffres sont saisis manuellement dans Notion.' });
}
