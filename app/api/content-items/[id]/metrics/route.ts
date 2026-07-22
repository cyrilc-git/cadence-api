import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// V58.12 — Saisie manuelle des résultats d'un post (impressions / réactions /
// commentaires). LinkedIn n'expose PAS les impressions d'un post personnel via
// API (aucun scope de lecture social/analytics sur un profil), donc la seule
// façon de rallumer le moteur d'apprentissage est cette saisie. Écrit dans
// content_items.meta au format exact que l'analytics lit (meta.impressions…),
// et passe analytics_state à 'confirmed' (chiffres réels saisis par Cyril).

const UUID = /^[0-9a-f-]{32,40}$/i;

function hostFromUrl(u: string): string {
  try { return new URL(u).host; } catch { return ''; }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const secret  = req.headers.get('x-cockpit-secret');
  const referer = req.headers.get('referer') || '';
  const origin  = req.headers.get('origin')  || '';
  const host    = req.headers.get('host')    || '';
  const sameOrigin = (!!origin && hostFromUrl(origin) === host) || (!!referer && hostFromUrl(referer) === host);
  if (!sameOrigin && (!secret || secret !== process.env.COCKPIT_SECRET)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const num = (v: unknown): number | undefined => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
  };
  const impressions = num(body.impressions);
  const likes = num(body.likes);
  const comments = num(body.comments);
  if (impressions === undefined && likes === undefined && comments === undefined) {
    return NextResponse.json({ error: 'Renseignez au moins un chiffre.' }, { status: 400 });
  }

  const key = params.id;
  const sel = supabase.from('content_items').select('id, meta');
  const { data: rows, error: selErr } = await (UUID.test(key)
    ? sel.or(`id.eq.${key},notion_page_id.eq.${key}`)
    : sel.eq('notion_page_id', key)
  ).order('id', { ascending: true }).limit(1);
  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });
  const row = rows?.[0];
  if (!row) return NextResponse.json({ error: 'Post introuvable.' }, { status: 404 });

  const meta: any = { ...(row.meta || {}) };
  if (impressions !== undefined) meta.impressions = impressions;
  if (likes !== undefined) meta.likes = likes;
  if (comments !== undefined) meta.comments = comments;
  meta.metrics_source = 'manual';
  meta.metrics_captured_at = new Date().toISOString();

  const { error } = await supabase.from('content_items')
    .update({ meta, analytics_state: 'confirmed', updated_at: new Date().toISOString() })
    .eq('id', row.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, impressions: meta.impressions, likes: meta.likes, comments: meta.comments });
}
