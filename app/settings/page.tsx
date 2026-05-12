import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import { getActiveToken } from '@/lib/supabase';
import { validateToken } from '@/lib/linkedin';
import { listNotionPosts, notionStatus } from '@/lib/notion';

export const dynamic = 'force-dynamic';

function envCheck(name: string): { present: boolean; hint?: string } {
  return { present: !!process.env[name] };
}

async function loadAll() {
  const [tokenRow, notion] = await Promise.all([
    getActiveToken().catch(() => null),
    notionStatus()
  ]);

  let li: { status: 'connected' | 'expired' | 'none'; name?: string; email?: string; expires_at?: string; error?: string } = { status: 'none' };
  if (tokenRow) {
    const v = await validateToken(tokenRow.access_token);
    const exp = new Date(tokenRow.expires_at).getTime();
    if (v.ok && exp > Date.now()) {
      li = { status: 'connected', name: v.name, email: v.email, expires_at: tokenRow.expires_at };
    } else {
      li = { status: 'expired', error: v.ok ? 'Date expiration dépassée' : `LinkedIn API ${v.status}` };
    }
  }

  const posts = notion.ok ? await listNotionPosts(5).catch(() => []) : [];

  return { li, notion, posts };
}

export default async function SettingsPage() {
  const { li, notion, posts } = await loadAll();

  const envs = [
    { name: 'LINKEDIN_CLIENT_ID',           critical: true },
    { name: 'LINKEDIN_CLIENT_SECRET',       critical: true,  secret: true },
    { name: 'LINKEDIN_REDIRECT_URI',        critical: true },
    { name: 'NOTION_API_TOKEN',             critical: true,  secret: true },
    { name: 'NOTION_LINKEDIN_DS_ID',        critical: true },
    { name: 'SUPABASE_URL',                 critical: true },
    { name: 'SUPABASE_SERVICE_ROLE_KEY',    critical: true,  secret: true },
    { name: 'COCKPIT_SECRET',               critical: true,  secret: true },
    { name: 'CRON_SECRET',                  critical: true,  secret: true },
    { name: 'ANTHROPIC_API_KEY',            critical: false, secret: true, hint: 'Pour génération texte (Claude) et visuels Heelio design' },
    { name: 'OPENAI_API_KEY',               critical: false, secret: true, hint: 'Pour visuels DALL-E (illustrations, ads)' }
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-ink-900">Settings</h1>
        <p className="mt-1 text-ink-500">Diagnostic des connexions et des secrets.</p>
      </header>

      {/* LinkedIn */}
      <section className="bg-white rounded-2xl p-6 shadow-card ring-1 ring-inset ring-ink-300/20">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink-900">LinkedIn</h2>
          {li.status === 'connected' && <StatusBadge variant="success">Connecté</StatusBadge>}
          {li.status === 'expired'   && <StatusBadge variant="warn">Expiré</StatusBadge>}
          {li.status === 'none'      && <StatusBadge variant="danger">Non connecté</StatusBadge>}
        </div>
        {li.status === 'connected' ? (
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Row label="Compte"      value={`${li.name} (${li.email})`} />
            <Row label="Token expire" value={new Date(li.expires_at!).toLocaleString('fr-FR')} />
            <Row label="Scopes"      value="openid, profile, email, w_member_social" />
          </dl>
        ) : (
          <p className="mt-3 text-sm text-ink-700">{li.error || 'Aucun compte LinkedIn n\'est connecté à Cadence.'}</p>
        )}
        <div className="mt-4">
          <Link href="/api/auth/linkedin" className="text-sm font-medium px-4 py-2 rounded-lg bg-brand-500 text-white hover:bg-brand-600">
            {li.status === 'connected' ? 'Reconnecter' : 'Connecter LinkedIn'}
          </Link>
        </div>
      </section>

      {/* Notion */}
      <section className="bg-white rounded-2xl p-6 shadow-card ring-1 ring-inset ring-ink-300/20">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink-900">Notion</h2>
          {notion.ok ? <StatusBadge variant="success">DB accessible</StatusBadge> : <StatusBadge variant="danger">Erreur</StatusBadge>}
        </div>
        {notion.ok ? (
          <p className="mt-3 text-sm text-ink-700">DB Linkedin lue. {posts.length} posts récents trouvés.</p>
        ) : (
          <pre className="mt-3 text-xs bg-danger-50 text-danger-700 p-3 rounded-lg overflow-x-auto">{('error' in notion && notion.error) || 'unknown'}</pre>
        )}
        <p className="mt-3 text-xs text-ink-500">Si erreur 401/403, l'intégration Cadence n'a pas accès à la DB. Allez dans Notion → DB Linkedin → ⋯ → Connections → Cadence.</p>
      </section>

      {/* Env vars */}
      <section className="bg-white rounded-2xl p-6 shadow-card ring-1 ring-inset ring-ink-300/20">
        <h2 className="font-semibold text-ink-900">Variables d'environnement</h2>
        <p className="mt-1 text-xs text-ink-500">Vérifie la présence des secrets côté serveur. Aucune valeur n'est jamais affichée.</p>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-xs text-ink-500 uppercase tracking-wide">
              <th className="text-left font-medium pb-2">Variable</th>
              <th className="text-left font-medium pb-2">Statut</th>
              <th className="text-left font-medium pb-2">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {envs.map(e => {
              const present = !!process.env[e.name];
              return (
                <tr key={e.name}>
                  <td className="py-2 font-mono text-xs text-ink-900">{e.name}</td>
                  <td className="py-2">
                    {present
                      ? <StatusBadge variant="success">Présent</StatusBadge>
                      : <StatusBadge variant={e.critical ? 'danger' : 'warn'}>{e.critical ? 'Manquant' : 'Optionnel'}</StatusBadge>}
                  </td>
                  <td className="py-2 text-xs text-ink-500">{e.hint || (e.secret ? 'Secret (encrypted)' : '')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="bg-white rounded-2xl p-6 shadow-card ring-1 ring-inset ring-ink-300/20">
        <h2 className="font-semibold text-ink-900">Auto-publication</h2>
        <p className="mt-2 text-sm text-ink-700">
          Le cron Vercel tourne tous les jours à 5h30 UTC. Pour des créneaux multiples, utilisez "Publier maintenant" dans l'éditeur, ou pingez <code className="text-xs">/api/cron-publish</code> depuis cron-job.org avec le Bearer <code>CRON_SECRET</code>.
        </p>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="text-sm text-ink-700">{value}</dd>
    </>
  );
}
