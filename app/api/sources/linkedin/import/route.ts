import { NextResponse } from 'next/server';
import { upsertDraft, replacePageContent, listNotionPosts } from '@/lib/notion';
import { markCadenceDraft } from '@/lib/db';
import { syncContentItems } from '@/lib/content-items';

export const runtime = 'nodejs';
export const maxDuration = 60;

// V9.4 — Import LinkedIn enrichi : statut détaillé par post, dédup explicite, log structuré.
// V10.4.3 — Auto-sync content_items après import si created > 0 (non bloquant pour la
//           réponse, mais on attend pour avoir le résumé canonical à jour).

type Incoming = { date: string; text: string; url?: string; sharedUrl?: string };
type ResultStatus = 'created' | 'duplicate' | 'error' | 'invalid';
type ResultItem = { index: number; status: ResultStatus; title?: string; error?: string };

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const incoming: Incoming[] = Array.isArray(body.posts) ? body.posts.slice(0, 100) : [];
    if (!incoming.length) return NextResponse.json({ error: 'Aucun post à importer' }, { status: 400 });

    // Dédup : hash par (date prefix + first 60 chars titre)
    const existing = await listNotionPosts(200).catch(() => []);
    const sigs = new Set(existing.map(p => `${(p.scheduled_at || '').slice(0, 10)}|${(p.title || '').slice(0, 60).toLowerCase()}`));

    const results: ResultItem[] = [];
    let created = 0, skipped = 0, errors = 0;

    for (let i = 0; i < incoming.length; i++) {
      const p = incoming[i];
      if (!p?.text) {
        results.push({ index: i, status: 'invalid', error: 'Texte manquant' });
        skipped++;
        continue;
      }
      const dateOnly = (p.date || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
      const title = (p.text.split('\n')[0] || '').slice(0, 80) || 'Post LinkedIn (importé)';
      const sig = `${dateOnly}|${title.slice(0, 60).toLowerCase()}`;
      if (sigs.has(sig)) {
        results.push({ index: i, status: 'duplicate', title });
        skipped++;
        continue;
      }
      try {
        const result = await upsertDraft({
          title,
          pilier: undefined,
          date: dateOnly,
          time: '07:30',
          anonymisation_ok: true,
        });
        await replacePageContent(result.id, p.text);
        await markCadenceDraft(result.id, 'linkedin_archive').catch(() => {});
        // Ajoute sa signature pour éviter qu'un doublon dans la même batch passe deux fois
        sigs.add(sig);
        results.push({ index: i, status: 'created', title });
        created++;
      } catch (e: any) {
        results.push({ index: i, status: 'error', title, error: e?.message || 'Erreur Notion' });
        errors++;
      }
    }

    // V10.4.3 — Sync content_items immédiate si des posts ont été créés.
    // Best effort : on logge mais on ne fail pas la réponse import si la sync échoue.
    let synced: { fromNotion: number; fromEmbeddings: number; errors: number } | null = null;
    if (created > 0) {
      try {
        const res = await syncContentItems({ limit: 500 });
        synced = { fromNotion: res.fromNotion, fromEmbeddings: res.fromEmbeddings, errors: res.errors };
      } catch {
        synced = null;
      }
    }

    return NextResponse.json({
      created,
      skipped,
      errors,
      total: incoming.length,
      results,
      synced,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
