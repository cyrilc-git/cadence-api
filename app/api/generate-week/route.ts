import { NextRequest, NextResponse } from 'next/server';
import { upsertDraft, replacePageContent, getNotionPost } from '@/lib/notion';
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
  const period: 'day' | 'week' | 'month' = body.period || 'week';
  const piliersFilter: string[] | undefined = body.piliers;

  try {
    const plan = await getWeeklyPlan();
    let dates = nextWeekDates();
    if (period === 'day') dates = dates.slice(0, 1);
    if (period === 'month') {
      const more: typeof dates = [];
      for (let w = 0; w < 4; w++) {
        const start = new Date();
        start.setDate(start.getDate() + 7 * w);
        more.push(...nextWeekDates(start));
      }
      dates = more;
    }
    if (piliersFilter && piliersFilter.length) {
      dates = dates.filter(d => {
        const slot = plan.find(s => s.weekday === d.weekday);
        return slot && slot.pilier && piliersFilter.includes(slot.pilier);
      });
    }
    const results: any[] = [];

    for (const d of dates) {
      const slot = plan.find(s => s.weekday === d.weekday);
      if (!slot || !slot.pilier) {
        results.push({ date: d.date, weekday: d.weekday, label: d.label, status: 'skipped_no_pilier' });
        continue;
      }
      const seed = briefFromUser
        ? `${briefFromUser}\n\nAngle pour ${slot.label} (${slot.pilier}).`
        : `Post pour ${slot.label} (${slot.pilier}). Choisis un angle cohérent avec ce pilier, sans recycler les sujets déjà couverts cette saison.`;
      try {
        const r = await generateThreeProposals({ pilier: slot.pilier, brief: seed });
        const first = r.proposals[0] || '';
        if (!first) { results.push({ date: d.date, weekday: d.weekday, label: d.label, status: 'no_proposal' }); continue; }
        const title = (first.split('\n')[0].slice(0, 80) || `${slot.label} - ${slot.pilier}`);
        const created = await upsertDraft({ title, pilier: slot.pilier, date: d.date, time: '07:30', anonymisation_ok: false });
        await replacePageContent(created.id, first);
        // Fetch the freshly-created page to get its notion_url
        const fetched = await getNotionPost(created.id).catch(() => null);
        results.push({
          date: d.date,
          weekday: d.weekday,
          label: d.label,
          pilier: slot.pilier,
          id: created.id,
          title,
          excerpt: first.slice(0, 200),
          notion_url: fetched?.summary?.notion_url || null,
          edit_url: `/posts/${created.id}/edit`,
          status: 'created',
          validated: false
        });
      } catch (e: any) {
        results.push({ date: d.date, weekday: d.weekday, label: d.label, pilier: slot.pilier, status: 'failed', error: e.message });
      }
    }
    return NextResponse.json({
      ok: true,
      period,
      created_count: results.filter(r => r.status === 'created').length,
      results,
      note: 'Tous les drafts sont créés en NON publié ET NON validé. Aucune publication automatique sans validation explicite via /posts/[id]/edit.'
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
