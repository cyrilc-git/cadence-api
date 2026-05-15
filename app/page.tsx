import Link from 'next/link';
import { listNotionPosts, notionStatus } from '@/lib/notion';
import { getActiveToken, publishedThisMonthCount } from '@/lib/supabase';
import { validateToken } from '@/lib/linkedin';
import { suggestionsList } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getDashboardData() {
  const [tokenRow, notion, publishedCount, sugg] = await Promise.all([
    getActiveToken().catch(() => null),
    notionStatus(),
    publishedThisMonthCount().catch(() => 0),
    suggestionsList('pending', 5).catch(() => [])
  ]);

  let liStatus: 'connected' | 'expired' | 'none' | 'error' = 'none';
  let liInfo: { name?: string; email?: string; expires_in_days?: number; error?: string } = {};
  if (tokenRow) {
    const exp = new Date(tokenRow.expires_at).getTime();
    const now = Date.now();
    const v = await validateToken(tokenRow.access_token);
    if (!v.ok) { liStatus = 'expired'; liInfo.error = `LinkedIn ${v.status}`; }
    else if (exp <= now) { liStatus = 'expired'; liInfo.error = 'Token expiré'; }
    else { liStatus = 'connected'; liInfo = { name: v.name, email: v.email, expires_in_days: Math.round((exp - now) / 86400000) }; }
  }

  let posts: any[] = [];
  if (notion.ok) { try { posts = await listNotionPosts(150); } catch {} }
  const drafts = posts.filter(p => p.status === 'draft');
  const scheduledFuture = posts.filter(p => p.status === 'scheduled' && !p.late);
  const needsValidation = scheduledFuture.filter(p => !p.validated);
  const validatedAndScheduled = scheduledFuture.filter(p => p.validated);
  const late = posts.filter(p => p.late);
  const next = scheduledFuture.slice().sort((a, b) => (a.scheduled_at || '').localeCompare(b.scheduled_at || ''))[0];
  const recentPublished = posts.filter(p => p.status === 'published').slice(0, 3);

  return { liStatus, liInfo, notion, drafts, needsValidation, validatedAndScheduled, late, next, publishedCount, suggestions: sugg, recentPublished };
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`dot ${ok ? 'bg-success-500' : 'bg-danger-500'} animate-pulse-soft`} />;
}

function MetricCard({ label, value, hint, accent = 'ink', href, icon }: { label: string; value: string | number; hint?: string; accent?: 'ink'|'brand'|'warn'|'success'|'danger'; href?: string; icon?: React.ReactNode }) {
  const accentText = { ink: 'text-ink-900', brand: 'text-brand-700', warn: 'text-warn-700', success: 'text-success-700', danger: 'text-danger-700' }[accent];
  const inner = (
    <div className="card card-hover p-5 h-full">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-ink-500 uppercase tracking-wider">{label}</div>
          <div className={`mt-2 text-3xl font-semibold tabular-nums ${accentText}`}>{value}</div>
          {hint && <div className="mt-1 text-xs text-ink-500 truncate">{hint}</div>}
        </div>
        {icon && <div className="ml-3 text-ink-300">{icon}</div>}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block focus:outline-none">{inner}</Link> : inner;
}

export default async function HomePage() {
  const { liStatus, liInfo, notion, drafts, needsValidation, validatedAndScheduled, late, next, publishedCount, suggestions, recentPublished } = await getDashboardData();
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <header className="relative flex items-end justify-between gap-4 flex-wrap">
        <div className="absolute -top-6 -left-6 w-40 h-40 bg-brand-100/40 rounded-full blur-3xl pointer-events-none -z-10" aria-hidden />
        <div>
          <p className="text-xs font-medium text-ink-500 uppercase tracking-wider">{today}</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink-900 tracking-tight">Bonjour Cyril <span className="inline-block animate-fade-in">✨</span></h1>
          <p className="mt-1 text-sm text-ink-500 lead">Voici l'état de votre cadence éditoriale aujourd'hui.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/posts/new" className="btn-primary">+ Nouveau post</Link>
          <Link href="/calendar" className="btn-secondary">Voir le calendrier</Link>
        </div>
      </header>

      {/* Connection strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link href="/sources/linkedin" className="card card-hover p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: '#0A66C2' }}>in</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-ink-900 text-sm">LinkedIn</span>
              <StatusDot ok={liStatus === 'connected'} />
            </div>
            <div className="text-xs text-ink-500 truncate">
              {liStatus === 'connected'
                ? `${liInfo.name} · token valide ${liInfo.expires_in_days}j`
                : (liInfo.error || 'Non connecté')}
            </div>
          </div>
          <svg className="w-4 h-4 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M9 6l6 6-6 6"/></svg>
        </Link>
        <Link href="/sources/notion" className="card card-hover p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white border border-ink-200 flex items-center justify-center text-ink-900 font-bold text-lg">N</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-ink-900 text-sm">Notion</span>
              <StatusDot ok={notion.ok} />
            </div>
            <div className="text-xs text-ink-500 truncate">
              {notion.ok ? `${needsValidation.length + validatedAndScheduled.length} posts non publiés en DB` : (('error' in notion && notion.error) || 'Erreur')}
            </div>
          </div>
          <svg className="w-4 h-4 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M9 6l6 6-6 6"/></svg>
        </Link>
      </section>

      {/* KPI Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Suggestions" value={suggestions.length} hint="Idées prêtes" accent="brand" href="/suggestions" />
        <MetricCard label="À valider"   value={needsValidation.length}      hint="Bloque le cron" accent="warn"  href="/posts?status=needs_validation" />
        <MetricCard label="Programmés"  value={validatedAndScheduled.length} hint="Validés pour cron" accent="brand" href="/posts?status=scheduled" />
        <MetricCard label="En retard"   value={late.length}                  hint="Date passée" accent="danger" href="/posts?status=late" />
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Brouillons"        value={drafts.length}             hint="Sans date"     href="/posts?status=draft" />
        <MetricCard label="Publiés ce mois"  value={publishedCount}            hint="Depuis le 1er" accent="success" href="/posts?status=published" />
        <MetricCard
          label="Prochain post"
          value={next ? new Date(next.scheduled_at!).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—'}
          hint={next ? `${next.scheduled_time || '07:30'} · ${next.title.slice(0, 24)}` : 'Aucun'}
          href="/calendar"
        />
        <MetricCard label="Nouveau post" value="✏️" hint="Génération IA assistée" accent="brand" href="/posts/new" />
      </section>

      {/* Two-column : Radar teaser + Recent published */}
      <section className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-ink-900 flex items-center gap-2">
              <svg className="w-4 h-4 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M12 3v4M12 17v4M3 12h4M17 12h4"/></svg>
              Voici ce que vous pourriez publier aujourd'hui
            </h2>
            <Link href="/suggestions" className="text-xs text-brand-700 hover:text-brand-800 font-medium">Tout voir →</Link>
          </div>
          {suggestions.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-sm text-ink-700">Aucune suggestion pour l'instant.</p>
              <Link href="/suggestions" className="btn-primary mt-3">Lancer le radar</Link>
            </div>
          ) : (
            <div className="grid gap-2">
              {suggestions.slice(0, 3).map(s => (
                <Link
                  key={s.id}
                  href={`/posts/new?suggest=${s.id}&pilier=${encodeURIComponent(s.pilier || '')}&hook=${encodeURIComponent(s.hook || '')}&brief=${encodeURIComponent(s.title)}`}
                  className="card card-hover p-4 block"
                >
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="chip chip-brand">{s.source}</span>
                    {s.pilier && <span className="text-xs text-ink-500">· {s.pilier}</span>}
                    <span className="ml-auto text-2xs font-semibold tabular-nums text-ink-500">{s.score}/100</span>
                  </div>
                  <div className="font-medium text-ink-900 leading-snug">{s.title}</div>
                  {s.why && <div className="mt-1 text-xs text-ink-500 line-clamp-2">{s.why}</div>}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-ink-900">Derniers publiés</h2>
            <Link href="/posts?status=published" className="text-xs text-brand-700 hover:text-brand-800 font-medium">Tout voir →</Link>
          </div>
          {recentPublished.length === 0 ? (
            <div className="card p-6 text-center text-xs text-ink-500">Aucun post publié pour l'instant.</div>
          ) : (
            <div className="space-y-2">
              {recentPublished.map(p => (
                <Link key={p.id} href={`/posts/${p.id}/edit`} className="card card-hover p-3 block">
                  <div className="text-2xs uppercase tracking-wider font-semibold text-success-700 flex items-center gap-1">
                    <span className="dot bg-success-500" />
                    {p.scheduled_at ? new Date(p.scheduled_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : ''}
                  </div>
                  <div className="mt-1 text-sm font-medium text-ink-900 line-clamp-2">{p.title}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
