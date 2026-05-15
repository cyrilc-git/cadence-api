import { NextResponse } from 'next/server';
import { upsertDraft, replacePageContent, listNotionPosts } from '@/lib/notion';
import { markCadenceDraft } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Incoming = { date: string; text: string; url?: string; sharedUrl?: string };

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const incoming: Incoming[] = Array.isArray(body.posts) ? body.posts.slice(0, 100) : [];
    if (!incoming.length) return NextResponse.json({ error: 'Aucun post à importer' }, { status: 400 });

    // Best-effort dedupe : list existing posts, hash by (date prefix + first 60 chars of text)
    const existing = await listNotionPosts(200).catch(() => []);
    const sigs = new Set(existing.map(p => `${(p.scheduled_at || '').slice(0,10)}|${(p.title || '').slice(0,60).toLowerCase()}`));

    let created = 0, skipped = 0;
    for (const p of incoming) {
      const dateOnly = (p.date || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
      const title = (p.text.split('\n')[0] || '').slice(0, 80) || 'Post LinkedIn (importé)';
      const sig = `${dateOnly}|${title.slice(0,60).toLowerCase()}`;
      if (sigs.has(sig)) { skipped++; continue; }
      try {
        const result = await upsertDraft({
          title,
          pilier: undefined,
          date: dateOnly,
          time: '07:30',
          anonymisation_ok: true
        });
        await replacePageContent(result.id, p.text);
        await markCadenceDraft(result.id, 'linkedin_archive').catch(() => {});
        created++;
      } catch { skipped++; }
    }
    return NextResponse.json({ created, skipped, total: incoming.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
