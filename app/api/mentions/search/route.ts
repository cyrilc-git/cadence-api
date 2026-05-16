import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';

// GET /api/mentions/search?q=heeli[&type=person|company]
// Recherche fuzzy sur display_name + handle, ranking par use_count puis trigram similarity.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  const type = url.searchParams.get('type'); // optional filter
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '8', 10), 25);
  if (!q) return NextResponse.json({ results: [] });
  try {
    let query = supabase.from('linkedin_entities')
      .select('urn, type, display_name, handle, url, headline, avatar_url, use_count')
      .order('use_count', { ascending: false })
      .limit(limit);
    if (type) query = query.eq('type', type);
    // Trigram-style search via ilike for simplicity (pg_trgm idx is used by ilike when % is on both sides)
    query = query.or(`display_name.ilike.%${q}%,handle.ilike.%${q}%`);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ results: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, results: [] }, { status: 500 });
  }
}
