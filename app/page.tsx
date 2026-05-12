import Link from 'next/link';
import KpiCard from '@/components/KpiCard';
import StatusBadge from '@/components/StatusBadge';
import { listNotionPosts, notionStatus } from '@/lib/notion';
import { getActiveToken, publishedThisMonthCount } from '@/lib/supabase';
import { validateToken } from '@/lib/linkedin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getDashboardData() {
  const [tokenRow, notion, publishedCount] = await Promise.all([
    getActiveToken().catch(() => null),
    notionStatus(),
    publishedThisMonthCount().catch(() => 0)
  ]);

  let liStatus: 'connected' | 'expired' | 'none' | 'error' = 'none';
  let liInfo: { name?: string; email?: string; expires_at?: string; expires_in_days?: number; error?: string } = {};

  if (!tokenRow) {
    liStatus = 'none';
  } else {
    const exp = new Date(tokenRow.expires_at).getTime();
    const now = Date.now();
    const validRemote = await validateToken(tokenRow.access_token);
    if (!validRemote.ok) {
      liStatus = 'expired';
      liInfo.error = `LinkedIn API a refusé le token (HTTP ${validRemote.status}). Reconnexion nécessaire.`;
    } else if (exp <= now) {
      liStatus = 'expired';
      liInfo.error = `Token expiré depuis ${Math.round((now - exp) / 86400000)} jours.`;
    } else {
      liStatus = 'connected';
      liInfo = {
        name: validRemote.name,
        email: validRemote.email,
        expires_at: tokenRow.expires_at,
        expires_in_days: Math.round((exp - now) / 86400000)
      };
    }
  }

  let posts: Awaited<ReturnType<typeof listNotionPosts>> = [];
  if (notion.ok) {
    try { posts = await listNotionPosts(50); } catch {}
  }

  const drafts = posts.filter(p => p.status === 'draft');
  const scheduled = posts.filter(p => p.status === 'scheduled');
  const next = scheduled.slice().sort((a,b) => (a.scheduled_at || '').localeCompare(b.scheduled_at || ''))[0];

  return { liStatus, liInfo, notion, drafts, scheduled, next, publishedCount };
}

export default async function HomePage() {
  const { liStatus, liInfo, notion, drafts, scheduled, next, publishedCount } = await getDashboardData();

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-ink-500">Bonjour Cyril.</p>
        <h1 className="text-3xl font-semibold text-ink-900 mt-1">Dashboard</h1>
        <p className="mt-1 text-ink-500">Vue d'ensemble de votre cadence éditoriale LinkedIn.</p>
      </header>

      {/* Connection statuses */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-ink-900">LinkedIn</h2>
            {liStatus === 'connected' && <StatusBadge variant="success">Connecté</StatusBadge>}
            {liStatus === 'expired'   && <StatusBadge variant="warn">Token expiré</StatusBadge>}
            {liStatus === 'none'      && <StatusBadge variant="danger">Non connecté</StatusBadge>}
          </div>
          {liStatus === 'connected' && (
            <p className="mt-2 text-sm text-ink-500">
              {liInfo.name} · {liInfo.email}<br/>
              Token valide encore <span className="font-medium text-ink-700">{liInfo.expires_in_days} jours</span>
            </p>
          )}
          {liStatus !== 'connected' && (
            <>
              <p className="mt-2 text-sm text-ink-500">{liInfo.error || 'Aucun compte LinkedIn connecté.'}</p>
              <Link href="/api/auth/linkedin" className="mt-3 inline-block text-sm font-medium px-3 py-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600">
                {liStatus === 'expired' ? 'Reconnecter' : 'Connecter LinkedIn'}
              </Link>
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-ink-900">Notion</h2>
            {notion.ok
              ? <StatusBadge variant="success">DB accessible</StatusBadge>
              : <StatusBadge variant="danger">Erreur</StatusBadge>}
          </div>
          <p className="mt-2 text-sm text-ink-500 break-words">
            {notion.ok ? `Database Linkedin lue. ${drafts.length + scheduled.length} posts non publiés.` : (('error' in notion && notion.error) || 'Erreur inconnue')}
          </p>
          <Link href="/settings" className="mt-3 inline-block text-xs text-brand-700 hover:text-brand-600 font-medium">Voir détails →</Link>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Drafts en attente" value={drafts.length} hint="Sans date de publication" />
        <KpiCard label="Programmés" value={scheduled.length} hint="Avec date future" accent="brand" />
        <KpiCard label="Publiés ce mois" value={publishedCount} hint="Depuis le 1er du mois" accent="success" />
        <KpiCard
          label="Prochain post"
          value={next ? new Date(next.scheduled_at!).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—'}
          hint={next ? `${next.scheduled_time || '07:30'} · ${next.title.slice(0, 30)}` : 'Aucun post programmé'}
        />
      </section>

      {/* Quick actions */}
      <section className="bg-white rounded-2xl p-6 shadow-card ring-1 ring-inset ring-ink-300/20">
        <h2 className="font-semibold text-ink-900">Actions rapides</h2>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/posts/new" className="rounded-xl bg-brand-500 text-white px-4 py-3 text-sm font-medium text-center hover:bg-brand-600">+ Créer un post</Link>
          <Link href="/calendar" className="rounded-xl ring-1 ring-ink-300 text-ink-700 px-4 py-3 text-sm font-medium text-center hover:bg-ink-50">Voir le calendrier</Link>
          <Link href="/settings" className="rounded-xl ring-1 ring-ink-300 text-ink-700 px-4 py-3 text-sm font-medium text-center hover:bg-ink-50">Tester les connexions</Link>
        </div>
      </section>

      {/* Next 3 scheduled posts preview */}
      {scheduled.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-ink-900">Prochains posts</h2>
            <Link href="/posts" className="text-xs text-brand-700 hover:text-brand-600 font-medium">Tous les posts →</Link>
          </div>
          <div className="grid gap-3">
            {scheduled.slice(0, 3).map(p => (
              <Link key={p.id} href={`/posts/new?from=${p.id}`} className="bg-white rounded-xl p-4 shadow-card ring-1 ring-inset ring-ink-300/20 hover:shadow-pop block">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge variant="brand">Programmé</StatusBadge>
                  {p.pilier && <span className="text-xs text-ink-500">· {p.pilier}</span>}
                  <span className="text-xs text-ink-500">
                    · {p.scheduled_at && new Date(p.scheduled_at).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'short' })} {p.scheduled_time || ''}
                  </span>
                </div>
                <div className="mt-1 font-medium text-ink-900 truncate">{p.title}</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
