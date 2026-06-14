import EditClient from './client';
import Link from 'next/link';
import { getNotionPost } from '@/lib/notion';
import { isValidated } from '@/lib/db';
import { getContentItemFull, type ContentItemFull } from '@/lib/content-items';
import { PROVENANCE_META } from '@/lib/provenance';

export const dynamic = 'force-dynamic';
// V54 — Lecture toujours fraiche : content_items peut etre reecrit par la
// synchro DMA apres un 1er rendu ; sans ca le Next Data Cache resservait l'ancien
// contenu.
export const fetchCache = 'force-no-store';
export const revalidate = 0;

// V55 Lot 1 — content_items est la source canonique. Un post publie (LinkedIn /
// archive / date passee) s'ouvre en LECTURE depuis content_items, sans jamais
// dependre de Notion. Seuls les brouillons editables passent encore par l'editeur
// Notion (backing store temporaire). Si Notion disparait, les posts restent lisibles.
function isReadonly(ci: ContentItemFull): boolean {
  if (ci.source_type === 'linkedin_published' || ci.source_type === 'linkedin_import_zip' || ci.source_type === 'notion_archive') return true;
  const d = ci.published_at || ci.scheduled_at;
  if (d && new Date(d).getTime() < Date.now()) return true; // date passee = publie
  return false;
}

function ReadOnlyPost({ ci }: { ci: ContentItemFull }) {
  const meta = PROVENANCE_META[ci.source_type] || PROVENANCE_META.unknown;
  const dateIso = ci.published_at || ci.scheduled_at;
  const dateStr = dateIso
    ? new Date(dateIso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })
    : '';
  const body = (ci.content || ci.excerpt || '').trim();
  const recycleBrief = `Recycler ce post : ${ci.title || ''}`.trim();
  return (
    <div className="max-w-2xl mx-auto px-5 lg:px-8 py-10 space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-2xs uppercase tracking-wider font-semibold">
          <span className={meta.textClass}>{meta.label}</span>
          {dateStr && <><span className="text-ink-300">·</span><span className="text-ink-400">{dateStr}</span></>}
        </div>
        <h1 className="text-2xl font-semibold text-ink-900 tracking-tight font-editorial leading-snug">{ci.title || 'Post'}</h1>
      </header>
      <article className="whitespace-pre-wrap text-sm text-ink-800 leading-relaxed border-l-2 border-ink-100 pl-4">
        {body || 'Texte indisponible.'}
      </article>
      <div className="flex items-center gap-3 flex-wrap pt-4 border-t border-ink-100">
        {ci.linkedin_url && (
          <a href={ci.linkedin_url} target="_blank" rel="noopener" className="text-sm text-[#0A66C2] hover:underline font-medium">
            Voir sur LinkedIn ↗
          </a>
        )}
        <Link href={`/posts/new?brief=${encodeURIComponent(recycleBrief)}`} className="btn-primary text-sm">
          Réutiliser ce post →
        </Link>
        <Link href="/calendar" className="text-sm text-ink-500 hover:text-ink-900 transition">← Calendrier</Link>
      </div>
      <p className="text-2xs text-ink-400 leading-relaxed">
        Publié — lecture seule. « Réutiliser » crée un nouveau brouillon à partir de ce post, sans toucher à l&apos;original.
      </p>
    </div>
  );
}

export default async function EditPage({ params }: { params: { id: string } }) {
  // 1. content_items d'abord (source canonique).
  const ci = await getContentItemFull(params.id);

  // 2. Post publie -> lecture seule depuis content_items (jamais Notion).
  if (ci && isReadonly(ci)) return <ReadOnlyPost ci={ci} />;

  // 3. Brouillon editable -> editeur. On charge la page Notion (backing store
  //    actuel des brouillons) ; via notion_page_id si on l'a, sinon via l'id.
  const r = await getNotionPost(ci?.notion_page_id || params.id).catch(() => null);
  if (r) {
    const validated = await isValidated(r.summary.id).catch(() => false);
    return <EditClient initial={r} validated={validated} />;
  }

  // 4. content_items sans page Notion editable -> lecture seule (ex : Notion KO).
  if (ci) return <ReadOnlyPost ci={ci} />;

  // 5. Rien.
  return <div className="p-8 text-danger-700">Post introuvable.</div>;
}
