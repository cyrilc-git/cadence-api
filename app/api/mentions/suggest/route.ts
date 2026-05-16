import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';

// V8.9 §6 — POST /api/mentions/suggest { text }
// Scanne le draft, retourne les entités du cache linkedin_entities dont le display_name apparait
// en clair dans le texte ET qui ne sont pas déjà taguées.
// Output : [{ urn, display_name, type, position, length, url, handle }]

const MIN_LEN = 3;
const MAX_SUGGESTIONS = 4;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const text: string = (body.text || '').toString();
  if (!text || text.length < 10) return NextResponse.json({ suggestions: [] });

  try {
    // Récupère les entités les plus utilisées (cap 200 pour perf)
    const { data, error } = await supabase
      .from('linkedin_entities')
      .select('urn, type, display_name, handle, url, headline, avatar_url, use_count')
      .order('use_count', { ascending: false })
      .limit(200);
    if (error) throw error;

    // Détecter les @[Display](urn:...) déjà présents pour exclure
    const alreadyTagged = new Set<string>();
    const tagRe = /@\[([^\]]+)\]\(urn:li:[^)]+\)/g;
    let m;
    while ((m = tagRe.exec(text)) !== null) {
      alreadyTagged.add(m[1].toLowerCase());
    }

    // Pour chaque entité, chercher première occurrence en clair (case-insensitive, word boundary)
    const suggestions: any[] = [];
    const seenUrn = new Set<string>();
    for (const e of data || []) {
      if (!e.display_name || e.display_name.length < MIN_LEN) continue;
      if (alreadyTagged.has(e.display_name.toLowerCase())) continue;
      if (seenUrn.has(e.urn)) continue;

      // Word-boundary regex, échappé pour caractères spéciaux
      const escaped = e.display_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(?<![@\\w])${escaped}(?!\\w)`, 'i');
      const match = re.exec(text);
      if (!match || match.index === undefined) continue;

      // Vérifier qu'on n'est pas DANS un bloc de mention déjà
      const beforeAt = text.slice(0, match.index);
      const lastTagOpen = beforeAt.lastIndexOf('@[');
      const lastTagClose = beforeAt.lastIndexOf(')');
      if (lastTagOpen > lastTagClose) continue;

      suggestions.push({
        urn: e.urn,
        type: e.type,
        display_name: e.display_name,
        handle: e.handle,
        url: e.url,
        avatar_url: e.avatar_url,
        position: match.index,
        length: match[0].length
      });
      seenUrn.add(e.urn);
      if (suggestions.length >= MAX_SUGGESTIONS) break;
    }

    return NextResponse.json({ suggestions });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, suggestions: [] }, { status: 500 });
  }
}
