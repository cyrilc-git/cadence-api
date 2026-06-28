import Link from 'next/link';
import { connectorsStatus } from '@/lib/db';
import { notionStatus } from '@/lib/notion';
import { getActiveToken } from '@/lib/supabase';
import { validateToken } from '@/lib/linkedin';
import { getCredential } from '@/lib/credentials';

// V51 §6 — Sources : hub de connexions au service des 3 flux (écrire,
// programmer/publier, visuels). On retire les sources « signaux » (GitHub,
// Gmail, Drive) qui ne servent pas ces flux, les placeholders « à venir »
// et le jargon technique (OAuth, AES-256, credentials).

export const dynamic = 'force-dynamic';

type SourceState = 'connected' | 'needs_setup' | 'error' | 'disconnected';
type Source = {
  kind: string;
  label: string;
  description: string;
  category: 'publi' | 'storage' | 'ai';
  oauth?: string;
  configRoute?: string;
  accent: string; // hex couleur de marque
};

const SOURCES: Source[] = [
  { kind: 'linkedin',  label: 'LinkedIn',     description: 'Source de vérité des publications. Import ZIP officiel.',  category: 'publi',   oauth: '/api/auth/linkedin', configRoute: '/sources/linkedin', accent: '#0A66C2' },
  { kind: 'notion',    label: 'Notion',       description: 'Espace de travail éditorial : brouillons, planning, notes.', category: 'storage', configRoute: '/sources/notion',   accent: '#0F172A' },
  { kind: 'anthropic', label: 'Claude',       description: 'Rédaction + visuels (Sonnet 4.6, Vision).',              category: 'ai',      configRoute: '/sources/ai',       accent: '#C96342' },
  { kind: 'openai',    label: 'OpenAI',       description: 'Embeddings éditoriaux + DALL-E 3 optionnel.',           category: 'ai',      configRoute: '/sources/ai',       accent: '#000000' },
  { kind: 'gemini',    label: 'Gemini',       description: 'Illustrations bitmap riches (Nano Banana).',            category: 'ai',      configRoute: '/sources/ai',       accent: '#4285F4' },
];

const CATEGORIES: { key: Source['category']; label: string }[] = [
  { key: 'publi',   label: 'Publication' },
  { key: 'storage', label: 'Stockage' },
  { key: 'ai',      label: 'Intelligence' },
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
  // V58.2 — déconnexion volontaire = état neutre « Non connecté » (gris), pas « Erreur » (rouge).
  out.notion = notion.ok ? 'connected' : ((notion as any).disconnected ? 'disconnected' : 'error');
  for (const c of connectors as any[]) {
    if (!out[c.kind]) out[c.kind] = (c.status as SourceState) || 'needs_setup';
  }
  // V40 — État réel des moteurs IA : clé présente (stockée ou serveur) → connecté.
  const aiProviders = ['anthropic', 'openai', 'gemini'];
  await Promise.all(aiProviders.map(async (p) => {
    try {
      const cred = await getCredential(p);
      out[p] = cred.value ? 'connected' : 'needs_setup';
    } catch { out[p] = 'needs_setup'; }
  }));
  return out;
}

function dotForState(state: SourceState): { color: string; label: string } {
  switch (state) {
    case 'connected':   return { color: 'bg-success-500', label: 'Connecté' };
    case 'needs_setup': return { color: 'bg-warn-500',    label: 'À configurer' };
    case 'error':       return { color: 'bg-danger-500',  label: 'Erreur' };
    default:            return { color: 'bg-ink-300',     label: 'Non connecté' };
  }
}

export default async function SourcesPage() {
  const states = await fetchStatus();
  const connectedCount = SOURCES.filter(s => states[s.kind] === 'connected').length;
  const activeCount = SOURCES.length;

  return (
    <div className="space-y-10 max-w-3xl mx-auto">
      <header>
        <p className="text-2xs uppercase tracking-wider font-semibold text-ink-400">Sources</p>
        <h1 className="mt-1 text-3xl font-semibold text-ink-900 tracking-tight">Vos connexions</h1>
        <p className="mt-2 text-sm text-ink-500">
          {connectedCount}/{activeCount} sources connectées. Vos clés restent chiffrées et privées. Aucune publication sans votre validation.
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
                const state: SourceState = states[s.kind] || 'needs_setup';
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
                    <div className="flex items-center gap-2 shrink-0">
                      {isConnected ? (
                        <Link href={s.configRoute || '/sources'} className="text-xs text-ink-500 hover:text-ink-900 transition sm:opacity-0 sm:group-hover:opacity-100 inline-flex items-center px-2 py-2 min-h-[40px] sm:min-h-0 sm:py-0 sm:px-0">Gérer</Link>
                      ) : s.oauth ? (
                        <Link href={s.oauth} className="text-xs text-brand-700 hover:text-brand-900 font-medium transition inline-flex items-center px-2 py-2 min-h-[40px] sm:min-h-0 sm:py-0 sm:px-0">Connecter →</Link>
                      ) : s.configRoute ? (
                        <Link href={s.configRoute} className="text-xs text-brand-700 hover:text-brand-900 font-medium transition inline-flex items-center px-2 py-2 min-h-[40px] sm:min-h-0 sm:py-0 sm:px-0">Configurer →</Link>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {/* Confiance — discret, prose, pas de card */}
      <section className="pt-4 border-t border-ink-100 text-xs text-ink-500 leading-relaxed">
        Vos clés et connexions sont chiffrées et stockées en sécurité. Cadence ne publie jamais à votre place sans validation.
      </section>
    </div>
  );
}
