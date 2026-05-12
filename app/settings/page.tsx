import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import { getActiveToken } from '@/lib/supabase';
import { validateToken } from '@/lib/linkedin';
import { notionStatus } from '@/lib/notion';
import { connectorsStatus } from '@/lib/db';

export const dynamic = 'force-dynamic';

const KIND_META: Record<string, { label: string; description: string; doc?: string; testRoute?: string; oauthRoute?: string }> = {
  linkedin:  { label: 'LinkedIn',         description: 'OAuth 2.0 — publication sur votre profil', oauthRoute: '/api/auth/linkedin' },
  notion:    { label: 'Notion',           description: 'Lecture/écriture sur la DB Linkedin (drafts, programmation, status)', testRoute: '/api/notion/status' },
  anthropic: { label: 'Claude (Anthropic)', description: 'Génération texte 3 propositions + visuels SVG design system Heelio' },
  openai:    { label: 'OpenAI (DALL-E)',  description: 'Visuels illustration / ads (PNG)' },
  github:    { label: 'GitHub (sources produit)', description: 'Détecte commits, PRs, releases pour proposer des posts "nouveauté produit"', doc: 'Variables env requises: GITHUB_TOKEN (PAT read:repo), GITHUB_REPOS (owner/repo,owner/repo)' },
  gmail:     { label: 'Gmail',            description: 'Détecte sujets récurrents pour proposer des angles', doc: 'À venir : OAuth Google' },
  gdrive:    { label: 'Google Drive',     description: 'Détecte nouveaux docs stratégiques / présentations', doc: 'À venir : OAuth Google' },
  onedrive:  { label: 'OneDrive',         description: 'Détecte nouveaux fichiers produits', doc: 'À venir : OAuth Microsoft' }
};

async function loadAll() {
  const [tokenRow, notion, connectors] = await Promise.all([
    getActiveToken().catch(() => null),
    notionStatus(),
    connectorsStatus().catch(() => [])
  ]);
  let li: { status: 'connected' | 'expired' | 'none'; name?: string; email?: string; expires_at?: string; error?: string } = { status: 'none' };
  if (tokenRow) {
    const v = await validateToken(tokenRow.access_token);
    const exp = new Date(tokenRow.expires_at).getTime();
    if (v.ok && exp > Date.now()) li = { status: 'connected', name: v.name, email: v.email, expires_at: tokenRow.expires_at };
    else li = { status: 'expired', error: v.ok ? 'Date expiration dépassée' : `LinkedIn API ${v.status}` };
  }
  return { li, notion, connectors };
}

export default async function SettingsPage() {
  const { li, notion, connectors } = await loadAll();

  // Merge live status into connectors list
  const enriched = connectors.map(c => {
    if (c.kind === 'linkedin') {
      return { ...c, status: li.status === 'connected' ? 'connected' : li.status === 'expired' ? 'error' : 'disconnected', last_error: li.error, info: li.status === 'connected' ? `${li.name} · expire ${new Date(li.expires_at!).toLocaleDateString('fr-FR')}` : '' };
    }
    if (c.kind === 'notion') {
      return { ...c, status: notion.ok ? 'connected' : 'error', last_error: notion.ok ? null : (('error' in notion && notion.error) || 'error') };
    }
    return c;
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-ink-900">Connecteurs</h1>
        <p className="mt-1 text-ink-500">Centre de contrôle des sources branchées à Cadence.</p>
      </header>

      <div className="grid sm:grid-cols-2 gap-3">
        {enriched.map((c: any) => {
          const meta = KIND_META[c.kind] || { label: c.kind, description: '' };
          return (
            <div key={c.kind} className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-ink-900">{meta.label}</h2>
                  <p className="text-xs text-ink-500 mt-0.5">{meta.description}</p>
                </div>
                {c.status === 'connected'    && <StatusBadge variant="success">Connecté</StatusBadge>}
                {c.status === 'error'        && <StatusBadge variant="danger">Erreur</StatusBadge>}
                {c.status === 'needs_setup'  && <StatusBadge variant="warn">À configurer</StatusBadge>}
                {c.status === 'disconnected' && <StatusBadge variant="neutral">Déconnecté</StatusBadge>}
              </div>

              {c.info && <p className="mt-2 text-sm text-ink-700">{c.info}</p>}
              {c.last_error && <p className="mt-2 text-xs text-danger-700 break-words">{c.last_error}</p>}
              {meta.doc && c.status === 'needs_setup' && <p className="mt-2 text-xs text-ink-500">{meta.doc}</p>}

              <div className="mt-4 flex gap-2 flex-wrap">
                {meta.oauthRoute && <Link href={meta.oauthRoute} className="text-xs px-3 py-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 font-medium">{c.status === 'connected' ? 'Reconnecter' : 'Connecter'}</Link>}
                {meta.testRoute && <a href={meta.testRoute} target="_blank" rel="noopener" className="text-xs px-3 py-1.5 rounded-lg ring-1 ring-ink-300 hover:bg-ink-50">Tester la connexion</a>}
              </div>
            </div>
          );
        })}
      </div>

      <section className="bg-white rounded-2xl p-6 shadow-card ring-1 ring-inset ring-ink-300/20">
        <h2 className="font-semibold text-ink-900">Sécurité</h2>
        <p className="mt-2 text-sm text-ink-700">Tous les secrets vivent dans Vercel env vars (chiffrés). Jamais exposés côté client. <Link href="/api/auth/status" target="_blank" className="text-brand-700 hover:text-brand-600">Vérifier statut LinkedIn JSON →</Link></p>
      </section>
    </div>
  );
}
