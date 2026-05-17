import { NextRequest, NextResponse } from 'next/server';
import { upsertDraft, replacePageContent, getNotionPost } from '@/lib/notion';
import { generateThreeProposals } from '@/lib/anthropic';
import { planNextWeek, summarizePlan, DayPlan } from '@/lib/weekly-intelligent';

export const runtime = 'nodejs';
export const maxDuration = 60;

// V9.0 — Pipeline intelligent : planNextWeek lit embeddings + pilier silence + topic tracking
// pour décider quel sujet × quel pilier × quel jour. Justification factuelle exposée par jour.

export async function POST(req: NextRequest) {
  const referer = req.headers.get('referer') || '';
  const host    = req.headers.get('host')    || '';
  if (!referer.includes(host)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const briefFromUser: string | undefined = body.brief;
  const period: 'day' | 'week' = body.period || 'week';

  try {
    let plan: DayPlan[];
    try { plan = await planNextWeek(); }
    catch (planErr: any) {
      console.warn('planNextWeek failed, fallback to standard:', planErr.message);
      // Fallback minimal sans intelligence
      plan = [];
    }

    if (period === 'day') plan = plan.slice(0, 1);

    const summary = summarizePlan(plan);
    const results: any[] = [];

    for (const d of plan) {
      const seed = briefFromUser
        ? `${briefFromUser}\n\nAngle pour ${d.label} (${d.pilier}). ${d.reason}`
        : d.brief;
      try {
        const r = await generateThreeProposals({ pilier: d.pilier, brief: seed });
        const first = r.proposals[0] || '';
        if (!first) { results.push({ date: d.date, weekday: d.weekday, label: d.label, pilier: d.pilier, reason: d.reason, status: 'no_proposal' }); continue; }
        const title = (first.split('\n')[0].slice(0, 80) || `${d.label} - ${d.pilier}`);
        const created = await upsertDraft({ title, pilier: d.pilier, date: d.date, time: '07:30', anonymisation_ok: false });
        await replacePageContent(created.id, first);
        const fetched = await getNotionPost(created.id).catch(() => null);
        results.push({
          date: d.date,
          weekday: d.weekday,
          label: d.label,
          pilier: d.pilier,
          topic_hint: d.topic_hint,
          reason: d.reason,
          source: d.source,
          format: d.format,
          id: created.id,
          title,
          excerpt: first.slice(0, 200),
          notion_url: fetched?.summary?.notion_url || null,
          edit_url: `/posts/${created.id}/edit`,
          status: 'created',
          validated: false
        });
      } catch (e: any) {
        results.push({ date: d.date, weekday: d.weekday, label: d.label, pilier: d.pilier, reason: d.reason, status: 'failed', error: e.message });
      }
    }

    return NextResponse.json({
      ok: true,
      period,
      summary,
      created_count: results.filter(r => r.status === 'created').length,
      results,
      note: 'Tous les drafts créés en NON publié ET NON validé. Aucune publication auto sans validation explicite.'
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
