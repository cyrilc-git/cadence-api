// V9.0 §3 — Analytics humain, prose-driven.
import { listNotionPosts, notionStatus } from '@/lib/notion';
import { computeHumanInsights } from '@/lib/analytics-insights';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const status = await notionStatus();
  const posts = status.ok ? await listNotionPosts(150) : [];
  const published = posts.filter(p => p.status === 'published');
  const sumImpr = published.reduce((s, p) => s + (p.impressions || 0), 0);
  const sumLikes = published.reduce((s, p) => s + (p.likes || 0), 0);
  const sumComments = published.reduce((s, p) => s + (p.comments || 0), 0);
  const insights = await computeHumanInsights().catch(() => [{ kind: 'low_data' as const, message: 'Impossible de calculer les patterns (Supabase indisponible).' }]);

  const top = published.filter(p => p.impressions && p.impressions > 0).sort((a, b) => (b.impressions || 0) - (a.impressions || 0)).slice(0, 5);

  return (
    <div className="space-y-10 max-w-3xl mx-auto">
      <header>
        <p className="text-2xs uppercase tracking-wider font-semibold text-ink-400">Analytics</p>
        <h1 className="mt-1 text-3xl font-semibold text-ink-900 tracking-tight">Vos patterns</h1>
        <p className="mt-2 text-sm text-ink-500">Ce que Cadence observe dans vos posts publiés.</p>
      </header>

      {/* === INSIGHTS HUMAINS === V9.0 §3 */}
      <section>
        <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-3">Ce que Cadence remarque</h2>
        {insights.length === 0 ? (
          <p className="text-sm text-ink-500 italic">Aucune observation pour l'instant.</p>
        ) : (
          <ul className="space-y-3">
            {insights.map((ins, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${ins.kind === 'low_data' ? 'bg-ink-400' : 'bg-brand-500'}`} />
                <p className="text-sm text-ink-800 leading-relaxed">{ins.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* === CHIFFRES DE BASE — discrets === */}
      <section className="pt-6 border-t border-ink-100">
        <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-3">Vue d'ensemble</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat label="Posts publiés" value={published.length} />
          <Stat label="Impressions cumulées" value={sumImpr.toLocaleString('fr-FR')} />
          <Stat label="Likes" value={sumLikes.toLocaleString('fr-FR')} />
          <Stat label="Commentaires" value={sumComments.toLocaleString('fr-FR')} />
        </div>
      </section>

      {/* === TOP 5 === */}
      {top.length > 0 && (
        <section>
          <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-3">Vos 5 meilleurs posts</h2>
          <ol className="space-y-2">
            {top.map((p, i) => (
              <li key={p.id} className="flex items-start gap-3 group">
                <span className="text-2xs tabular-nums text-ink-400 mt-0.5 w-4 shrink-0">{i + 1}</span>
                <a href={p.linkedin_url || p.notion_url} target="_blank" rel="noopener" className="flex-1 text-sm text-ink-800 group-hover:text-brand-700 transition truncate">
                  {p.title}
                </a>
                <span className="text-sm font-medium text-ink-900 tabular-nums shrink-0">{p.impressions?.toLocaleString('fr-FR')}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {!status.ok && (
        <p className="text-xs text-ink-500 italic">Notion ne répond pas — les chiffres sont vides.</p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-2xl font-semibold text-ink-900 tabular-nums">{value}</div>
      <div className="text-2xs text-ink-500 mt-0.5">{label}</div>
    </div>
  );
}
