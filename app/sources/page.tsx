import Link from 'next/link';
import { connectorsStatus } from '@/lib/db';
import { notionStatus } from '@/lib/notion';
import { getActiveToken } from '@/lib/supabase';
import { validateToken } from '@/lib/linkedin';

export const dynamic = 'force-dynamic';

type SourceState = 'connected' | 'needs_setup' | 'error' | 'disconnected' | 'soon';
type Source = {
  kind: string;
  label: string;
  description: string;
  category: 'publi' | 'storage' | 'ai' | 'signal';
  oauth?: string;        // /api/auth/<x>
  configRoute?: string;  // /sources/<x>  or /settings
  soon?: boolean;
  brandIcon: 'linkedin' | 'notion' | 'claude' | 'openai' | 'github' | 'gmail' | 'gdrive' | 'onedrive';
};

const SOURCES: Source[] = [
  { kind: 'linkedin',  label: 'LinkedIn',          description: 'Publication sur votre profil. Aucun post sans validation.',     category: 'publi',   oauth: '/api/auth/linkedin', configRoute: '/sources/linkedin', brandIcon: 'linkedin' },
  { kind: 'notion',    label: 'Notion',            description: 'Stockage des brouillons, posts programmés et publiés.',         category: 'storage', configRoute: '/sources/notion',   brandIcon: 'notion' },
  { kind: 'anthropic', label: 'Claude',            description: 'Génération texte + visuels SVG (Sonnet 4.6).',                  category: 'ai',      configRoute: '/settings',         brandIcon: 'claude' },
  { kind: 'openai',    label: 'OpenAI',            description: 'Illustrations DALL-E 3, photoréalistes ou éditoriales.',        category: 'ai',      configRoute: '/settings',         brandIcon: 'openai' },
  { kind: 'github',    label: 'GitHub',            description: 'Détecte commits, PRs, releases pour suggérer des posts.',      category: 'signal',  configRoute: '/sources/github',   brandIcon: 'github' },
  { kind: 'gmail',     label: 'Gmail',             description: 'Détectera sujets récurrents et questions clients (V7.9).',     category: 'signal',  soon: true,                       brandIcon: 'gmail' },
  { kind: 'gdrive',    label: 'Google Drive',      description: 'Détectera nouveaux docs stratégiques (V7.9).',                 category: 'signal',  soon: true,                       brandIcon: 'gdrive' },
  { kind: 'onedrive',  label: 'OneDrive',          description: 'Détectera nouveaux fichiers produits (V7.9).',                 category: 'signal',  soon: true,                       brandIcon: 'onedrive' },
];

const CATEGORIES: { key: Source['category']; label: string; description: string }[] = [
  { key: 'publi',   label: 'Publication',   description: 'Où Cadence publie vos posts.' },
  { key: 'storage', label: 'Stockage',      description: 'Où vos posts vivent.' },
  { key: 'ai',      label: 'Intelligence',  description: 'Génération texte et visuel.' },
  { key: 'signal',  label: 'Signaux',       description: 'Sources qui alimentent le Radar.' },
];

function BrandIcon({ name }: { name: Source['brandIcon'] }) {
  const sz = 'w-9 h-9';
  switch (name) {
    case 'linkedin': return <div className={`${sz} rounded-lg flex items-center justify-center text-white font-bold text-sm`} style={{ backgroundColor: '#0A66C2' }}>in</div>;
    case 'notion':   return <div className={`${sz} rounded-lg bg-white border border-ink-200 flex items-center justify-center text-ink-900 font-bold text-lg`}>N</div>;
    case 'claude':   return <div className={`${sz} rounded-lg flex items-center justify-center text-white font-bold text-sm`} style={{ backgroundColor: '#C96342' }}>C</div>;
    case 'openai':   return <div className={`${sz} rounded-lg bg-black flex items-center justify-center text-white font-bold text-base`}>◯</div>;
    case 'github':   return <div className={`${sz} rounded-lg bg-[#181717] flex items-center justify-center text-white font-bold text-base`}>⌥</div>;
    case 'gmail':    return <div className={`${sz} rounded-lg flex items-center justify-center text-white font-bold text-sm`} style={{ backgroundColor: '#EA4335' }}>M</div>;
    case 'gdrive':   return <div className={`${sz} rounded-lg flex items-center justify-center text-white font-bold text-sm`} style={{ backgroundColor: '#1FA463' }}>D</div>;
    case 'onedrive': return <div className={`${sz} rounded-lg flex items-center justify-center text-white font-bold text-sm`} style={{ backgroundColor: '#0078D4' }}>1</div>;
  }
}

async function fetchStatus(): Promise<Record<string, SourceState>> {
  const out: Record<string, SourceState> = {};
  const [tokenRow, notion, connectors] = await Promise.all([
    getActiveToken().catch(() => null),
    notionStatus().catch(() => ({ ok: false })),
    connectorsStatus().catch(() => [] as any[])
  ]);

  // LinkedIn
  if (tokenRow) {
    try { const v = await validateToken(tokenRow.access_token); out.linkedin = v.ok ? 'connected' : 'disconnected'; }
    catch { out.linkedin = 'disconnected'; }
  } else { out.linkedin = 'disconnected'; }

  out.notion = notion.ok ? 'connected' : 'error';

  for (const c of connectors as any[]) {
    if (!out[c.kind]) out[c.kind] = (c.status as SourceState) || 'needs_setup';
  }
  return out;
}

function StateBadge({ state }: { state: SourceState }) {
  if (state === 'connected') return <span className="chip chip-success"><span className="dot bg-success-500" /> Connecté</span>;
  if (state === 'error')     return <span className="chip chip-danger"><span className="dot bg-danger-500" /> Erreur</span>;
  if (state === 'soon')      return <span className="chip chip-neutral">Bientôt</span>;
  if (state === 'needs_setup') return <span className="chip chip-warn"><span className="dot bg-warn-500" /> À configurer</span>;
  return <span className="chip chip-neutral">Non connecté</span>;
}

export default async function SourcesPage() {
  const states = await fetchStatus();
  const connectedCount = SOURCES.filter(s => !s.soon && states[s.kind] === 'connected').length;
  const activeCount = SOURCES.filter(s => !s.soon).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900 tracking-tight">Sources</h1>
        <p className="mt-1 text-sm text-ink-500 lead">Connectez vos outils en quelques clics. Tout est chiffré côté serveur, jamais exposé au navigateur.</p>
      </header>

      {/* Progress strip */}
      <div className="card p-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-semibold text-ink-900 tabular-nums">{connectedCount}</span>
            <span className="text-sm text-ink-500">/ {activeCount} sources actives connectées</span>
          </div>
          <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all duration-500" style={{ width: `${(connectedCount / activeCount) * 100}%` }} />
          </div>
        </div>
        <Link href="/sources/linkedin" className="btn-primary">Connecter LinkedIn</Link>
      </div>

      {/* Categories */}
      {CATEGORIES.map(cat => {
        const items = SOURCES.filter(s => s.category === cat.key);
        if (items.length === 0) return null;
        return (
          <section key={cat.key} className="space-y-3">
            <div className="flex items-baseline gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-600">{cat.label}</h2>
              <span className="text-xs text-ink-500">{cat.description}</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {items.map(s => {
                const state: SourceState = s.soon ? 'soon' : (states[s.kind] || 'needs_setup');
                const isConnected = state === 'connected';
                return (
                  <div key={s.kind} className={`card p-5 ${isConnected ? 'border-success-100' : ''}`}>
                    <div className="flex items-start gap-3">
                      <BrandIcon name={s.brandIcon} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-semibold text-ink-900">{s.label}</h3>
                          <StateBadge state={state} />
                        </div>
                        <p className="mt-1 text-xs text-ink-500">{s.description}</p>
                      </div>
                    </div>
                    {!s.soon && (
                      <div className="mt-4 flex gap-2 flex-wrap">
                        {state === 'connected' ? (
                          <Link href={s.configRoute || '/settings'} className="btn-secondary text-xs">Gérer</Link>
                        ) : (
                          <>
                            {s.oauth && <Link href={s.oauth} className="btn-primary text-xs">Connecter en 1 clic</Link>}
                            {s.configRoute && <Link href={s.configRoute} className="btn-secondary text-xs">{s.oauth ? 'Avancé' : 'Configurer'}</Link>}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Trust block */}
      <section className="card p-5 bg-brand-50/30 border-brand-100">
        <h2 className="font-semibold text-ink-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M12 2l8 4v6a8 8 0 11-16 0V6l8-4z M9 12l2 2 4-4"/></svg>
          Sécurité et confidentialité
        </h2>
        <ul className="mt-3 text-xs text-ink-700 space-y-1.5">
          <li className="flex items-start gap-2"><span className="dot bg-brand-500 mt-1.5" /> <span><strong>OAuth-first</strong> partout où possible. Pas de saisie de mot de passe.</span></li>
          <li className="flex items-start gap-2"><span className="dot bg-brand-500 mt-1.5" /> <span><strong>Aucune publication</strong> sans votre validation explicite (case « Validé pour cron »).</span></li>
          <li className="flex items-start gap-2"><span className="dot bg-brand-500 mt-1.5" /> <span><strong>Chiffrement AES-256-GCM</strong> côté serveur des credentials avancés (Personal Access Tokens).</span></li>
          <li className="flex items-start gap-2"><span className="dot bg-brand-500 mt-1.5" /> <span><strong>Lecture seule</strong> pour les signaux (GitHub, Gmail, Drive). Cadence n'écrit jamais dans ces sources.</span></li>
        </ul>
      </section>
    </div>
  );
}
