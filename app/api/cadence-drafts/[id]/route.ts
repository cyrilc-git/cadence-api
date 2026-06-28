import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// DELETE /api/cadence-drafts/:id — retire un brouillon de Cadence.
// V58.2 — La suppression doit toucher la couche CANONIQUE content_items, sinon
// le post reapparait (la table cadence_drafts n'est qu'un marqueur de provenance,
// souvent inexistant pour les brouillons crees par le composer V57). On matche
// par id OU notion_page_id (meme logique que getContentItemFull/saveDraft), borne
// par UUID pour eviter toute injection PostgREST dans .or().
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  try {
    if (/^[0-9a-f-]{32,40}$/i.test(id)) {
      const { error } = await supabase
        .from('content_items')
        .delete()
        .or(`id.eq.${id},notion_page_id.eq.${id}`);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('content_items').delete().eq('id', id);
      if (error) throw error;
    }
    // Best-effort : purge le marqueur de provenance (n'echoue jamais la requete).
    await supabase.from('cadence_drafts').delete().eq('notion_page_id', id).then(() => {}, () => {});
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
