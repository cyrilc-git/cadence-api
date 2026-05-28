'use client';

// V39.2 — Clés IA gérées par l'utilisateur. Chaque moteur : coller sa
// propre clé (chiffrée AES-256 côté serveur), ou la retirer. On utilise
// le compte de l'utilisateur, jamais le nôtre.

import { useState } from 'react';
import Link from 'next/link';
import { toast } from '@/components/Dialog';

type ProviderState = { present: boolean; source: string };
type Initial = { anthropic: ProviderState; openai: ProviderState; gemini: ProviderState };

const PROVIDERS: { key: 'anthropic' | 'openai' | 'gemini'; label: string; accent: string; usage: string; help: string; helpUrl: string }[] = [
  {
    key: 'anthropic', label: 'Claude (Anthropic)', accent: '#C96342',
    usage: 'Rédaction des posts, réécriture, visuels Claude Design (SVG), analyse Vision.',
    help: 'console.anthropic.com', helpUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    key: 'openai', label: 'OpenAI', accent: '#000000',
    usage: 'Embeddings éditoriaux (mémoire sémantique) et illustrations DALL-E 3.',
    help: 'platform.openai.com', helpUrl: 'https://platform.openai.com/api-keys',
  },
  {
    key: 'gemini', label: 'Gemini (Nano Banana)', accent: '#4285F4',
    usage: 'Illustrations bitmap riches via gemini-2.5-flash-image (Nano Banana).',
    help: 'aistudio.google.com', helpUrl: 'https://aistudio.google.com/app/apikey',
  },
];

export default function AiKeysClient({ initial }: { initial: Initial }) {
  const [state, setState] = useState<Initial>(initial);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function saveKey(provider: 'anthropic' | 'openai' | 'gemini') {
    const secret = (drafts[provider] || '').trim();
    if (secret.length < 10) { toast.error('Clé trop courte.'); return; }
    setBusy(provider);
    try {
      const r = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, secret, label: 'default' }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setState(s => ({ ...s, [provider]: { present: true, source: 'db' } }));
      setDrafts(d2 => ({ ...d2, [provider]: '' }));
      toast.success('Clé enregistrée et chiffrée.');
    } catch (e: any) {
      toast.error('Erreur : ' + e.message);
    } finally {
      setBusy(null);
    }
  }

  async function removeKey(provider: 'anthropic' | 'openai' | 'gemini') {
    setBusy(provider);
    try {
      // On retrouve l'id via /api/credentials GET (masked list), puis DELETE.
      const list = await fetch('/api/credentials').then(r => r.json()).catch(() => ({ items: [] }));
      const match = (list.items || []).find((c: any) => c.provider === provider && c.status === 'active');
      if (!match) { toast.error('Clé introuvable (peut-être en variable d\'environnement).'); setBusy(null); return; }
      const r = await fetch(`/api/credentials/${match.id}`, { method: 'DELETE' });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Suppression impossible'); }
      setState(s => ({ ...s, [provider]: { present: false, source: 'missing' } }));
      toast.success('Clé retirée.');
    } catch (e: any) {
      toast.error('Erreur : ' + e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <header>
        <p className="text-2xs uppercase tracking-wider font-semibold text-ink-400">
          <Link href="/sources" className="hover:text-ink-700 transition">Sources</Link> · Intelligence
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-ink-900 tracking-tight">Clés IA</h1>
        <p className="mt-2 text-sm text-ink-500 leading-relaxed">
          Cadence utilise vos propres clés. Elles sont chiffrées (AES-256-GCM) côté serveur et ne quittent jamais votre espace. Un moteur sans clé reste grisé dans l&apos;éditeur.
        </p>
      </header>

      <ul className="space-y-4">
        {PROVIDERS.map(p => {
          const st = state[p.key];
          const viaEnv = st.present && st.source === 'env';
          return (
            <li key={p.key} className="border border-ink-100 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-1">
                <span className="w-7 h-7 rounded-md flex items-center justify-center text-white text-2xs font-semibold shrink-0" style={{ backgroundColor: p.accent }} aria-hidden>
                  {p.label[0]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink-900">{p.label}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${st.present ? 'bg-success-500' : 'bg-ink-300'}`} aria-hidden />
                    <span className="text-2xs text-ink-500">{st.present ? (viaEnv ? 'Connecté (variable serveur)' : 'Connecté') : 'Pas de clé'}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-500 leading-relaxed">{p.usage}</p>
                </div>
              </div>

              {st.present ? (
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-xs text-success-700">Clé active.</span>
                  {!viaEnv && (
                    <button
                      onClick={() => removeKey(p.key)}
                      disabled={busy === p.key}
                      className="text-xs text-danger-700 hover:text-danger-900 transition disabled:opacity-50 underline decoration-dotted underline-offset-2"
                    >
                      {busy === p.key ? '…' : 'Retirer la clé'}
                    </button>
                  )}
                  {viaEnv && <span className="text-2xs text-ink-400 italic">Définie en variable d&apos;environnement serveur.</span>}
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="password"
                      value={drafts[p.key] || ''}
                      onChange={e => setDrafts(d => ({ ...d, [p.key]: e.target.value }))}
                      placeholder={`Collez votre clé ${p.label}`}
                      className="input text-sm flex-1 min-w-[220px]"
                      autoComplete="off"
                    />
                    <button
                      onClick={() => saveKey(p.key)}
                      disabled={busy === p.key || (drafts[p.key] || '').trim().length < 10}
                      className="btn-primary text-xs"
                    >
                      {busy === p.key ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                  </div>
                  <p className="text-2xs text-ink-400">
                    Obtenez une clé sur <a href={p.helpUrl} target="_blank" rel="noopener" className="text-brand-700 hover:text-brand-900 underline decoration-dotted underline-offset-2">{p.help}</a>.
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <section className="pt-4 border-t border-ink-100 text-xs text-ink-500 leading-relaxed">
        Midjourney n&apos;est pas listé : il n&apos;a pas d&apos;API publique. Exportez vos visuels Midjourney à la main, puis ajoutez-les via l&apos;aperçu du post.
        {' '}Les clés sont chiffrées et jamais affichées en clair, ni renvoyées au navigateur.
      </section>
    </div>
  );
}
