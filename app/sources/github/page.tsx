import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';

export default function GitHubSourcePage() {
  const hasEnv = !!process.env.GITHUB_TOKEN;
  const repos = process.env.GITHUB_REPOS || '';
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-ink-900">GitHub</h1>
        <p className="mt-1 text-ink-500">Source de signaux produit pour le Radar : commits récents, PRs mergées, releases.</p>
      </header>
      <section className="bg-white rounded-2xl p-6 shadow-card ring-1 ring-inset ring-ink-300/20">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-semibold text-ink-900">Statut</h2>
          {hasEnv ? <StatusBadge variant="success">Token configuré</StatusBadge> : <StatusBadge variant="warn">À configurer</StatusBadge>}
        </div>
        {hasEnv ? (
          <div className="mt-3 text-sm text-ink-700">
            <p>Repos scannés :</p>
            <ul className="mt-2 space-y-1">
              {repos.split(',').filter(Boolean).map(r => <li key={r} className="font-mono text-xs">· {r.trim()}</li>)}
            </ul>
          </div>
        ) : (
          <div className="mt-3 text-sm text-ink-700 space-y-2">
            <p>GitHub OAuth complet arrive en V7.8. En attendant, configuration manuelle :</p>
            <ol className="list-decimal list-inside text-xs space-y-1">
              <li>Créez un Personal Access Token GitHub (scope read:repo) sur <a href="https://github.com/settings/tokens" target="_blank" className="text-brand-700 hover:text-brand-600 underline">github.com/settings/tokens</a></li>
              <li>Ajoutez 2 variables d'environnement Vercel : <code>GITHUB_TOKEN</code> et <code>GITHUB_REPOS</code> (format <code>owner/repo,owner/repo</code>)</li>
              <li>Redéployez. Le Radar scannera commits + releases à chaque rafraîchissement.</li>
            </ol>
          </div>
        )}
      </section>
      <div className="text-xs text-ink-500"><Link href="/sources" className="text-brand-700 hover:text-brand-600">← Retour aux Sources</Link></div>
    </div>
  );
}
