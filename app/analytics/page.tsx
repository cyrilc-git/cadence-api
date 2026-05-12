import KpiCard from '@/components/KpiCard';
import { listNotionPosts, notionStatus } from '@/lib/notion';
import { recentPublishLog } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const status = await notionStatus();
  const posts = status.ok ? await listNotionPosts(150) : [];
  const log = await recentPublishLog(20).catch(() => []);
  const published = posts.filter(p => p.status === 'published');
  const sumImpr = published.reduce((s, p) => s + (p.impressions || 0), 0);
  const sumLikes = published.reduce((s, p) => s + (p.likes || 0), 0);
  const sumComments = published.reduce((s, p) => s + (p.comments || 0), 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-ink-900">Analytics</h1>
        <p className="mt-1 text-ink-500">Performance de vos posts. Les chiffres viennent de Notion (à remplir manuellement aujourd'hui — scrape auto en V5.2).</p>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Posts publiés (total)" value={published.length} />
        <KpiCard label="Impressions cumulées" value={sumImpr.toLocaleString('fr-FR')} accent="brand" />
        <KpiCard label="Likes cumulés"        value={sumLikes.toLocaleString('fr-FR')} accent="success" />
        <KpiCard label="Commentaires"         value={sumComments.toLocaleString('fr-FR')} />
      </section>

      <section className="bg-white rounded-2xl p-6 shadow-card ring-1 ring-inset ring-ink-300/20">
        <h2 className="font-semibold text-ink-900">Top 5 posts par impressions</h2>
        <div className="mt-3 divide-y divide-ink-100">
          {published
            .filter(p => p.impressions && p.impressions > 0)
            .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
            .slice(0, 5)
            .map(p => (
              <div key={p.id} className="py-2 flex items-center justify-between gap-3">
                <a href={p.linkedin_url || p.notion_url} target="_blank" rel="noopener" className="text-sm text-ink-900 hover:text-brand-700 truncate flex-1">
                  {p.title}
                </a>
                <span className="text-sm font-semibold text-ink-900">{p.impressions?.toLocaleString('fr-FR')}</span>
              </div>
            ))}
          {published.filter(p => p.impressions).length === 0 && (
            <p className="text-sm text-ink-500 py-4">Aucune impression renseignée pour l'instant.</p>
          )}
        </div>
      </section>

      <section className="bg-white rounded-2xl p-6 shadow-card ring-1 ring-inset ring-ink-300/20">
        <h2 className="font-semibold text-ink-900">Logs publish récents (Supabase)</h2>
        <div className="mt-3 space-y-2 text-sm">
          {log.length === 0 && <p className="text-ink-500">Pas de logs.</p>}
          {log.map((l: any) => (
            <div key={l.id} className="flex items-center gap-3">
              <span className={`px-2 py-0.5 rounded-full text-xs ${l.status === 'success' ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700'}`}>{l.status}</span>
              <span className="text-ink-500">{new Date(l.created_at).toLocaleString('fr-FR')}</span>
              <span className="text-ink-700 truncate flex-1">{l.linkedin_post_urn || l.error || ''}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
