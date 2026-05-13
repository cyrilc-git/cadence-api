import Link from 'next/link';
import { connectorsStatus } from '@/lib/db';
import { notionStatus } from '@/lib/notion';
import { getActiveToken } from '@/lib/supabase';
import { validateToken } from '@/lib/linkedin';
import StatusBadge from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

const SOURCE_META: Record<string, { label: string; description: string; route?: string; oauthRoute?: string }> = {
  linkedin:  { label: 'LinkedIn',           description: 'Publication sur votre profil. Historique des posts publiés.', route: '/sources/linkedin', oauthRoute: '/api/auth/linkedin' },
  notion:    { label: 'Notion',             description: 'Stockage des brouillons, posts programmés et publiés.',       route: '/sources/notion' },
  anthropic: { label: 'Claude (Anthropic)', description: 'Génération texte et visuels SVG.',                              route: '/settings' },
  openai:    { label: 'OpenAI',             description: 'Visuels illustratifs DALL-E 3.',                                route: '/settings' },
  github:    { label: 'GitHub',             description: 'Détecte commits, PRs et releases pour suggérer des posts.',   route: '/sources/github' },
  gmail:     { label: 'Gmail',              description: 'Détecte sujets récurrents pour idées de posts.' },
  gdrive:    { label: 'Google Drive',       description: 'Détecte nouveaux documents stratégiques.' },
  onedrive:  { label: 'OneDrive',           description: 'Détecte nouveaux fichiers produits.' }
};

async function fetchStatus() {
  const [tokenRow, notion, connectors] = await Promise.all([
    getActiveToken().catch(() => null),
    notionStatus(),
    connectorsStatus().catch(() => [])
  ]);
  let liOk = false;
  if (tokenRow) { const v = await validateToken(tokenRow.access_token); liOk = v.ok; }
  return { liOk, notionOk: notion.ok, connectors };
}

export default async function SourcesPage() {
  const { liOk, notionOk, connectors } = await fetchStatus();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-ink-900">Sources</h1>
        <p className="mt-1 text-ink-500">Vos comptes et services branchés à Cadence. Tout est chiffré, jamais exposé.</p>
      </header>

      <div className="grid sm:grid-cols-2 gap-3">
        {connectors.map((c: any) => {
          const meta = SOURCE_META[c.kind] || { label: c.kind, description: '' };
          let status: 'connected' | 'needs_setup' | 'error' | 'disconnected' = c.status as any;
          if (c.kind === 'linkedin') status = liOk ? 'connected' : 'disconnected';
          if (c.kind === 'notion')   status = notionOk ? 'connected' : 'error';
          return (
            <div key={c.kind} className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-ink-900">{meta.label}</h2>
                  <p className="text-xs text-ink-500 mt-0.5">{meta.description}</p>
                </div>
                {status === 'connected'    && <StatusBadge variant="success">Connecté</StatusBadge>}
                {status === 'error'        && <StatusBadge variant="danger">Erreur</StatusBadge>}
                {status === 'needs_setup'  && <StatusBadge variant="warn">À configurer</StatusBadge>}
                {status === 'disconnected' && <StatusBadge variant="neutral">Déconnecté</StatusBadge>}
              </div>
              <div className="mt-4 flex gap-2 flex-wrap">
                {meta.route && <Link href={meta.route} className="text-xs px-3 py-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 font-medium">Configurer</Link>}
                {meta.oauthRoute && status !== 'connected' && <Link href={meta.oauthRoute} className="text-xs px-3 py-1.5 rounded-lg ring-1 ring-ink-300 hover:bg-ink-50">Connecter</Link>}
              </div>
            </div>
          );
        })}
      </div>

      <section className="bg-brand-50/50 ring-1 ring-inset ring-brand-500/20 rounded-2xl p-5 text-sm text-ink-700">
        <h2 className="font-semibold text-ink-900">Comment Cadence utilise vos sources</h2>
        <ul className="mt-2 list-disc list-inside space-y-1 text-xs">
          <li><strong>LinkedIn</strong> : publication sur votre profil. Aucune publication sans validation explicite.</li>
          <li><strong>Notion</strong> : stockage de vos brouillons, posts programmés et historique. Une seule database, distinction posts Cadence vs Notion existants.</li>
          <li><strong>Claude</strong> : génération texte (3 propositions) + visuels SVG selon votre style.</li>
          <li><strong>OpenAI</strong> : génération d'illustrations photoréalistes ou éditoriales.</li>
          <li><strong>GitHub / Gmail / Drive / OneDrive</strong> : sources de signaux pour le Radar (futur).</li>
        </ul>
      </section>
    </div>
  );
}
