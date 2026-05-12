import StatusBadge from './StatusBadge';
import Link from 'next/link';

type Post = {
  id: string;
  title: string;
  excerpt?: string;
  pillar?: string;
  status: 'draft' | 'scheduled' | 'published' | 'error';
  scheduled_at?: string | null;
  notion_url?: string;
  linkedin_url?: string;
};

const statusMap = {
  draft:     { label: 'Brouillon',      variant: 'neutral' as const },
  scheduled: { label: 'Programmé',      variant: 'brand'   as const },
  published: { label: 'Publié',         variant: 'success' as const },
  error:     { label: 'Erreur',         variant: 'danger'  as const }
};

export default function PostCard({ post }: { post: Post }) {
  const s = statusMap[post.status];
  return (
    <article className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20 hover:shadow-pop transition">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <StatusBadge variant={s.variant}>{s.label}</StatusBadge>
            {post.pillar && <span className="text-xs text-ink-500">· {post.pillar}</span>}
            {post.scheduled_at && (
              <span className="text-xs text-ink-500">
                · {new Date(post.scheduled_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                {' '}à {new Date(post.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <h3 className="font-semibold text-ink-900 truncate">{post.title || 'Sans titre'}</h3>
          {post.excerpt && <p className="mt-1 text-sm text-ink-500 line-clamp-2">{post.excerpt}</p>}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 flex-wrap">
        {post.notion_url && (
          <a href={post.notion_url} target="_blank" rel="noopener" className="text-xs px-3 py-1.5 rounded-lg ring-1 ring-ink-300 text-ink-700 hover:bg-ink-50">
            Ouvrir dans Notion
          </a>
        )}
        {post.linkedin_url && (
          <a href={post.linkedin_url} target="_blank" rel="noopener" className="text-xs px-3 py-1.5 rounded-lg ring-1 ring-ink-300 text-ink-700 hover:bg-ink-50">
            Voir sur LinkedIn
          </a>
        )}
        {post.status !== 'published' && (
          <Link href={`/posts/new?from=${post.id}`} className="text-xs px-3 py-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600">
            Modifier & programmer
          </Link>
        )}
      </div>
    </article>
  );
}
