// V9.0 §3 — Analytics humain, prose-driven.
// V9.9 — Distinction confirmé LinkedIn vs déduit Notion, transparence sur la
// provenance des chiffres.
import Link from 'next/link';
import { listNotionPosts, notionStatus } from '@/lib/notion';
import { computeHumanInsights } from '@/lib/analytics-insights';
import { inferFromNotion } from '@/lib/provenance';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const status = await notionStatus();
  const posts = status.ok ? await listNotionPosts(150) : [];
  const published = posts.filter(p => p.status === 'published');

  // V9.9 — Sépare confirmé (URL LinkedIn ou import) vs déduit (Notion seul)
  const enriched = published.map(p => ({
    ...p,
    provenance: inferFromNotion({
      id: p.id, title: p.title, status: p.status, linkedin_url: p.linkedin_url,
      notion_url: p.notion_url, scheduled_at: p.scheduled_at, validated: p.validated,
      cadence_source: p.cadence_source,
    }),
  }));
  const confirmedPosts = enriched.filter(p => p.provenance.source_type === 'linkedin_published' || p.provenance.source_type === 'linkedin_import_zip');
  const inferredPosts = enriched.filter(p => p.provenance.source_type === 'notion_archive');
  const withMetrics = enriched.filter(p => (p.impressions || 0) > 0);

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
        <p className="mt-2 text-sm text-ink-500 leading-relaxed">
          Cadence lit les impressions, likes et commentaires saisis dans Notion. {confirmedPosts.length > 0
            ? `${confirmedPosts.length} post${confirmedPosts.length > 1 ? 's' : ''} avec URL LinkedIn vérifiée, ${inferredPosts.length} archive${inferredPosts.length > 1 ? 's' : ''} Notion non certifiée${inferredPosts.length > 1 ? 's' : ''}.`
            : 'Aucun import LinkedIn pour l\'instant : tout est déduit depuis Notion.'}
        </p>
      </header>

      {/* === V9.9 — Fiabilité des analytics === */}
      <section>
        <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-3">Fiabilité des chiffres</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <ReliabilityStat
            label="Publications confirmées"
            value={confirmedPosts.length}
            hint="URL LinkedIn vérifiée ou import ZIP"
            tone="confirmed"
          />
          <ReliabilityStat
            label="Archives Notion"
            value={inferredPosts.length}
            hint="Pas d'URL LinkedIn rattachée"
            tone="inferred"
          />
          <ReliabilityStat
            label="Avec impressions"
            value={withMetrics.length}
            hint={published.length > 0 ? `${Math.round(withMetrics.length / published.length * 100)}% des publiés` : '—'}
            tone={withMetrics.length >= published.length * 0.5 ? 'confirmed' : 'muted'}
          />
        </div>
        {inferredPosts.length > confirmedPosts.length && (
          <p className="mt-3 text-xs text-amber-700 leading-relaxed">
            Plus de la moitié des publiés n&apos;ont pas d&apos;URL LinkedIn vérifiée. Les patterns ci-dessous restent donc indicatifs.{' '}
            <Link href="/sources/linkedin" className="underline hover:text-amber-900">Importer mon archive LinkedIn</Link> pour passer en certitude.
          </p>
        )}
      </section>

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
        <p className="text-xs text-ink-500 italic">Notion ne répond pas, les chiffres sont vides.</p>
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

function ReliabilityStat({ label, value, hint, tone }: { label: string; value: number; hint: string; tone: 'confirmed' | 'inferred' | 'muted' }) {
  const dotColor = { confirmed: 'bg-[#0A66C2]', inferred: 'bg-amber-500', muted: 'bg-ink-300' }[tone];
  const valueColor = { confirmed: 'text-[#0A66C2]', inferred: 'text-amber-700', muted: 'text-ink-500' }[tone];
  return (
    <div className="rounded-xl border border-ink-100 p-3">
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} aria-hidden />
        <span className="text-2xs uppercase tracking-wider font-semibold text-ink-500">{label}</span>
      </div>
      <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${valueColor}`}>{value.toLocaleString('fr-FR')}</div>
      <div className="mt-0.5 text-2xs text-ink-500">{hint}</div>
    </div>
  );
}
