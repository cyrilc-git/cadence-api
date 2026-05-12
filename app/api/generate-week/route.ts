import { NextRequest, NextResponse } from 'next/server';
import { upsertDraft, replacePageContent } from '@/lib/notion';
import { generateThreeProposals } from '@/lib/anthropic';
import { getWeeklyPlan, nextWeekDates } from '@/lib/weekly';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const referer = req.headers.get('referer') || '';
  const host    = req.headers.get('host')    || '';
  if (!referer.includes(host)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const briefFromUser: string | undefined = body.brief;

  try {
    const plan = await getWeeklyPlan();
    const dates = nextWeekDates();
    const results: any[] = [];

    for (const d of dates) {
      const slot = plan.find(s => s.weekday === d.weekday);
      if (!slot || !slot.pilier) {
        results.push({ date: d.date, status: 'skipped_no_pilier' });
        continue;
      }
      const seed = briefFromUser
        ? `${briefFromUser}\n\nAngle pour ${slot.label} (${slot.pilier}).`
        : `Post pour ${slot.label} (${slot.pilier}). Choisis un angle cohérent avec ce pilier, sans recycler les sujets déjà couverts cette saison.`;
      try {
        const r = await generateThreeProposals({ pilier: slot.pilier, brief: seed });
        const first = r.proposals[0] || '';
        if (!first) { results.push({ date: d.date, status: 'no_proposal' }); continue; }
        const title = (first.split('\n')[0].slice(0, 80) || `${slot.label} — ${slot.pilier}`);
        const created = await upsertDraft({ title, pilier: slot.pilier, date: d.date, time: '07:30', anonymisation_ok: false });
        await replacePageContent(created.id, first);
        results.push({ date: d.date, pilier: slot.pilier, id: created.id, status: 'created' });
      } catch (e: any) {
        results.push({ date: d.date, pilier: slot.pilier, status: 'failed', error: e.message });
      }
    }
    return NextResponse.json({ ok: true, results, note: 'Tous les drafts sont créés en NON publié ET NON validé. Aucune publication automatique sans validation explicite dans /posts/[id]/edit ou /calendar.' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
