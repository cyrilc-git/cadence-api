import Link from 'next/link';
import KpiCard from '@/components/KpiCard';
import StatusBadge from '@/components/StatusBadge';
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
    if (!v.ok) {
      liStatus = 'expired';
      liInfo.error = `LinkedIn ${v.status}`;
    } else if (exp <= now) {
      liStatus = 'expired';
      liInfo.error = `Token expiré`;
    } else {
      liStatus = 'connected';
      liInfo = { name: v.name, email: v.email, expires_in_days: Math.round((exp - now) / 86400000) };
    }
  }

  let posts: Awaited<ReturnType<typeof listNotionPosts>> = [];
  if (notion.ok) { try { posts = await listNotionPosts(50); } catch {} }
  const drafts = posts.filter(p => p.status === 'draft');
  const scheduled = posts.filter(p => p.status === 'scheduled');
  const next = scheduled.slice().sort((a, b) => (a.scheduled_at || '').localeCompare(b.scheduled_at || ''))[0];

  return { liStatus, liInfo, notion, drafts, scheduled, next, publishedCount, suggestions: sugg };
}

export default async function HomePage() {
  const { liStatus, liInfo, notion, drafts, scheduled, next, publishedCount, suggestions } = await getDashboardData();

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-ink-500">Bonjour Cyril.</p>
        <h1 className="text-3xl font-semibold text-ink-900 mt-1">Dashboard</h1>
        <p className="mt-1 text-ink-500">Votre radar de contenu et l'état de votre cadence éditoriale.</p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-ink-900">LinkedIn</h2>
            {liStatus === 'connected' && <StatusBadge variant="success">Connecté</StatusBadge>}
            {liStatus === 'expired'   && <StatusBadge variant="warn">Token expiré</StatusBadge>}
            {liStatus === 'none'      && <StatusBadge variant="danger">Non connecté</StatusBadge>}
          </div>
          {liStatus === 'connected'
            ? <p className="mt-2 text-sm text-ink-500">{liInfo.name} · {liInfo.email}<br/>Token valide encore <span className="font-medium text-ink-700">{liInfo.expires_in_days} jours</span></p>
            : (<>
                <p className="mt-2 text-sm text-ink-500">{liInfo.error || 'Aucun compte LinkedIn connecté.'}</p>
                <Link href="/api/auth/linkedin" className="mt-3 inline-block text-sm font-medium px-3 py-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600">
                  {liStatus === 'expired' ? 'Reconnecter' : 'Connecter LinkedIn'}
                </Link>
              </>)}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-ink-900">Notion</h2>
            {notion.ok ? <StatusBadge variant="success">DB accessible</StatusBadge> : <StatusBadge variant="danger">Erreur</StatusBadge>}
          </div>
          <p className="mt-2 text-sm text-ink-500">
            {notion.ok ? `${drafts.length + scheduled.length} posts non publiés en DB Linkedin.` : (('error' in notion && notion.error) || 'Erreur inconnue')}
          </p>
          <Link href="/settings" className="mt-3 inline-block text-xs text-brand-700 hover:text-brand-600 font-medium">Voir tous les connecteurs →</Link>
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Suggestions actives" value={suggestions.length} hint="Idées prêtes à exploiter" accent="brand" />
        <KpiCard label="Drafts en attente" value={drafts.length} />
        <KpiCard label="Programmés" value={scheduled.length} accent="brand" />
        <KpiCard label="Publiés ce mois" value={publishedCount} accent="success" />
      </section>

      {/* Suggestions teaser */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-ink-900">Voici ce que vous pourriez publier aujourd'hui</h2>
          <Link href="/suggestions" className="text-xs text-brand-700 hover:text-brand-600 font-medium">Tout voir →</Link>
        </div>
        {suggestions.length === 0
          ? <div className="bg-white rounded-2xl p-6 text-center shadow-card ring-1 ring-inset ring-ink-300/20">
              <p className="text-sm text-ink-700">Aucune suggestion pour l'instant.</p>
              <Link href="/suggestions" className="mt-3 inline-block text-sm px-3 py-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600">Lancer le radar</Link>
            </div>
          : <div className="grid gap-3">
              {suggestions.slice(0, 3).map(s => (
                <Link key={s.id} href={`/posts/new?suggest=${s.id}&pilier=${encodeURIComponent(s.pilier || '')}&hook=${encodeURIComponent(s.hook || '')}&brief=${encodeURIComponent(s.title)}`}
                  className="bg-white rounded-2xl p-4 shadow-card ring-1 ring-inset ring-ink-300/20 hover:shadow-pop transition block">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge variant="brand">{s.source}</StatusBadge>
                    {s.pilier && <span className="text-xs text-ink-500">· {s.pilier}</span>}
                    <span className="text-xs text-ink-500 ml-auto">{s.score}/100</span>
                  </div>
                  <div className="mt-1 font-medium text-ink-900 truncate">{s.title}</div>
                  {s.why && <div className="mt-1 text-xs text-ink-500">{s.why}</div>}
                </Link>
              ))}
            </div>}
      </section>

      {/* Next scheduled */}
      {next && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-ink-900">Prochain post programmé</h2>
            <Link href="/calendar" className="text-xs text-brand-700 hover:text-brand-600 font-medium">Calendrier →</Link>
          </div>
          <Link href={`/posts/new?from=${next.id}`} className="bg-white rounded-2xl p-4 shadow-card ring-1 ring-inset ring-ink-300/20 hover:shadow-pop transition block">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge variant="brand">Programmé</StatusBadge>
              {next.pilier && <span className="text-xs text-ink-500">· {next.pilier}</span>}
              <span className="text-xs text-ink-500">
                · {next.scheduled_at && new Date(next.scheduled_at).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'short' })} {next.scheduled_time || ''}
              </span>
            </div>
            <div className="mt-1 font-medium text-ink-900 truncate">{next.title}</div>
          </Link>
        </section>
      )}
    </div>
  );
}
