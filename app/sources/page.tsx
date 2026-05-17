import Link from 'next/link';
import { connectorsStatus } from '@/lib/db';
import { notionStatus } from '@/lib/notion';
import { getActiveToken } from '@/lib/supabase';
import { validateToken } from '@/lib/linkedin';

// V9.1 §5 — Sources : OS éditorial, pas page de settings.
// Suppression : progress card, trust card lourde, gradient bar, big brand tiles.
// Style : liste sobre Notion-like, dots colorés, statut en mots, action discrète.

export const dynamic = 'force-dynamic';

type SourceState = 'connected' | 'needs_setup' | 'error' | 'disconnected' | 'soon';
type Source = {
  kind: string;
  label: string;
  description: string;
  category: 'publi' | 'storage' | 'ai' | 'signal';
  oauth?: string;
  configRoute?: string;
  soon?: boolean;
  accent: string; // hex couleur de marque
};

const SOURCES: Source[] = [
  { kind: 'linkedin',  label: 'LinkedIn',     description: 'Publication validée, jamais auto.',                       category: 'publi',   oauth: '/api/auth/linkedin', configRoute: '/sources/linkedin', accent: '#0A66C2' },
  { kind: 'notion',    label: 'Notion',       description: 'Stockage des brouillons et programmés.',                 category: 'storage', configRoute: '/sources/notion',   accent: '#0F172A' },
  { kind: 'anthropic', label: 'Claude',       description: 'Rédaction + visuels (Sonnet 4.6, Vision).',              category: 'ai',      configRoute: '/settings',         accent: '#C96342' },
  { kind: 'openai',    label: 'OpenAI',       description: 'Embeddings éditoriaux + DALL-E 3 optionnel.',           category: 'ai',      configRoute: '/settings',         accent: '#000000' },
  { kind: 'github',    label: 'GitHub',       description: 'Détecte commits, releases, signaux produit.',           category: 'signal',  configRoute: '/sources/github',   accent: '#181717' },
  { kind: 'gmail',     label: 'Gmail',        description: 'À venir — questions clients récurrentes.',              category: 'signal',  soon: true,                       accent: '#EA4335' },
  { kind: 'gdrive',    label: 'Google Drive', description: 'À venir — docs stratégiques.',                          category: 'signal',  soon: true,                       accent: '#1FA463' },
  { kind: 'onedrive',  label: 'OneDrive',     description: 'À venir — fichiers produits.',                          category: 'signal',  soon: true,                       accent: '#0078D4' },
];

const CATEGORIES: { key: Source['category']; label: string }[] = [
  { key: 'publi',   label: 'Publication' },
  { key: 'storage', label: 'Stockage' },
  { key: 'ai',      label: 'Intelligence' },
  { key: 'signal',  label: 'Signaux' },
];

async function fetchStatus(): Promise<Record<string, SourceState>> {
  const out: Record<string, SourceState> = {};
  const [tokenRow, notion, connectors] = await Promise.all([
    getActiveToken().catch(() => null),
    notionStatus().catch(() => ({ ok: false })),
    connectorsStatus().catch(() => [] as any[])
  ]);
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

function dotForState(state: SourceState): { color: string; label: string } {
  switch (state) {
    case 'connected':   return { color: 'bg-success-500', label: 'Connecté' };
    case 'needs_setup': return { color: 'bg-warn-500',    label: 'À configurer' };
    case 'error':       return { color: 'bg-danger-500',  label: 'Erreur' };
    case 'soon':        return { color: 'bg-ink-300',     label: 'Bientôt' };
    default:            return { color: 'bg-ink-300',     label: 'Non connecté' };
  }
}

export default async function SourcesPage() {
  const states = await fetchStatus();
  const connectedCount = SOURCES.filter(s => !s.soon && states[s.kind] === 'connected').length;
  const activeCount = SOURCES.filter(s => !s.soon).length;

  return (
    <div className="space-y-10 max-w-3xl mx-auto">
      <header>
        <p className="text-2xs uppercase tracking-wider font-semibold text-ink-400">Sources</p>
        <h1 className="mt-1 text-3xl font-semibold text-ink-900 tracking-tight">Vos connexions</h1>
        <p className="mt-2 text-sm text-ink-500">
          {connectedCount}/{activeCount} sources connectées. OAuth d'abord, chiffrement AES-256 pour le reste. Aucune publication sans validation.
        </p>
      </header>

      {CATEGORIES.map(cat => {
        const items = SOURCES.filter(s => s.category === cat.key);
        if (items.length === 0) return null;
        return (
          <section key={cat.key}>
            <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-3">{cat.label}</h2>
            <ul className="divide-y divide-ink-100 border-t border-b border-ink-100">
              {items.map(s => {
                const state: SourceState = s.soon ? 'soon' : (states[s.kind] || 'needs_setup');
                const isConnected = state === 'connected';
                const tone = dotForState(state);
                return (
                  <li key={s.kind} className="group flex items-center gap-4 py-3.5">
                    <span className="w-7 h-7 rounded-md flex items-center justify-center text-white text-2xs font-semibold shrink-0" style={{ backgroundColor: s.accent }} aria-hidden>
                      {s.label[0]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-ink-900">{s.label}</span>
                        <span className={`w-1.5 h-1.5 rounded-full ${tone.color}`} aria-hidden />
                        <span className="text-2xs text-ink-500">{tone.label}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-500 truncate">{s.description}</p>
                    </div>
                    {!s.soon && (
                      <div className="flex items-center gap-2 shrink-0">
                        {isConnected ? (
                          <Link href={s.configRoute || '/settings'} className="text-xs text-ink-500 hover:text-ink-900 transition opacity-0 group-hover:opacity-100">Gérer</Link>
                        ) : s.oauth ? (
                          <Link href={s.oauth} className="text-xs text-brand-700 hover:text-brand-900 font-medium transition">Connecter →</Link>
                        ) : s.configRoute ? (
                          <Link href={s.configRoute} className="text-xs text-brand-700 hover:text-brand-900 font-medium transition">Configurer →</Link>
                        ) : null}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {/* Trust — discret, prose, pas de card */}
      <section className="pt-4 border-t border-ink-100 text-xs text-ink-500 leading-relaxed">
        OAuth-first partout où possible. Credentials avancés chiffrés AES-256-GCM côté serveur. Signaux (GitHub, Gmail, Drive) en lecture seule — Cadence n'écrit jamais dans ces sources.
      </section>
    </div>
  );
}
