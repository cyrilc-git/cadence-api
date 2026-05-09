import { NextRequest, NextResponse } from 'next/server';

// Vercel Cron : configure dans vercel.json pour appeler 1×/jour à 23h
// Pour l'instant : stub. La vraie implémentation utilisera puppeteer ou
// une session LinkedIn cookie pour scraper la page analytics de chaque post publié,
// puis remontera likes/impressions/comments dans Notion.

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    status: 'stub',
    message: 'Scraping not yet implemented. Will use puppeteer + LinkedIn session cookie. V5.2.'
  });
}
