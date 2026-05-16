import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';

// POST /api/mentions/upsert — registers a new mention entity (used when user manually types a URL or pastes a profile)
// Body : { urn, type, display_name, handle?, url?, headline?, source? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.urn || !body?.type || !body?.display_name) {
    return NextResponse.json({ error: 'urn, type, display_name required' }, { status: 400 });
  }
  try {
    const { data, error } = await supabase.from('linkedin_entities').upsert({
      urn: body.urn,
      type: body.type,
      display_name: body.display_name,
      handle: body.handle || null,
      url: body.url || null,
      headline: body.headline || null,
      source: body.source || 'manual',
      updated_at: new Date().toISOString()
    }, { onConflict: 'urn' }).select().single();
    if (error) throw error;
    return NextResponse.json({ entity: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH /api/mentions/upsert?urn=... — increment use_count
export async function PATCH(req: NextRequest) {
  const url = new URL(req.url);
  const urn = url.searchParams.get('urn');
  if (!urn) return NextResponse.json({ error: 'urn required' }, { status: 400 });
  try {
    const { data: existing } = await supabase.from('linkedin_entities').select('use_count').eq('urn', urn).maybeSingle();
    const next = (existing?.use_count || 0) + 1;
    await supabase.from('linkedin_entities').update({ use_count: next, last_used_at: new Date().toISOString() }).eq('urn', urn);
    return NextResponse.json({ ok: true, use_count: next });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
