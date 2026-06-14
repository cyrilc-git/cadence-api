import EditClient from './client';
import Link from 'next/link';
import { getNotionPost } from '@/lib/notion';
import { isValidated } from '@/lib/db';
import { getContentItemFull } from '@/lib/content-items';
import { PROVENANCE_META } from '@/lib/provenance';

export const dynamic = 'force-dynamic';

export default async function EditPage({ params }: { params: { id: string } }) {
  // 1. Brouillon Notion editable -> l'editeur.
  const r = await getNotionPost(params.id).catch(() => null);
  if (r) {
    const validated = await isValidated(params.id).catch(() => false);
    return <EditClient initial={r} validated={validated} />;
  }

  // 2. Repli : post LinkedIn rapatrie (Snapshot / Changelog / export) -> pas de
  //    page Notion. Un post deja publie sur LinkedIn n'est pas editable : on
  //    l'affiche en LECTURE SEULE, avec le lien d'origine et l'option de recyclage.
  const ci = await getContentItemFull(params.id);
  if (ci) {
    const meta = PROVENANCE_META[ci.source_type] || PROVENANCE_META.unknown;
    const dateIso = ci.published_at || ci.scheduled_at;
    const dateStr = dateIso
      ? new Date(dateIso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })
      : '';
    const body = (ci.content || ci.excerpt || '').trim();
    const recycleBrief = `Recycler ce post LinkedIn : ${ci.title || ''}`.trim();
    return (
      <div className="max-w-2xl mx-auto px-5 lg:px-8 py-10 space-y-6">
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-2xs uppercase tracking-wider font-semibold">
            <span className={meta.textClass}>{meta.label}</span>
            {dateStr && <><span className="text-ink-300">·</span><span className="text-ink-400">{dateStr}</span></>}
          </div>
          <h1 className="text-2xl font-semibold text-ink-900 tracking-tight font-editorial leading-snug">{ci.title || 'Post LinkedIn'}</h1>
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
          Publié sur LinkedIn — lecture seule. « Réutiliser » crée un nouveau brouillon à partir de ce post, sans toucher à l&apos;original.
        </p>
      </div>
    );
  }

  // 3. Vraiment rien.
  return <div className="p-8 text-danger-700">Post introuvable.</div>;
}
