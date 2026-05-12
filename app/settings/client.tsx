'use client';

import { useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';

type Connector = { kind: string; status: string; last_error?: string | null; info?: string };

const PROVIDERS: Array<{ key: string; label: string; description: string; oauthRoute?: string; testRoute?: string; secretFields: Array<{ provider: string; label: string; placeholder?: string; hint?: string }> }> = [
  { key: 'linkedin', label: 'LinkedIn', description: 'OAuth — publication sur votre profil',
    oauthRoute: '/api/auth/linkedin',
    secretFields: [
      { provider: 'linkedin_client_id',     label: 'Client ID',     placeholder: '78ph2kbf3uvjpw' },
      { provider: 'linkedin_client_secret', label: 'Client Secret', placeholder: 'WPL_AP1.…' }
    ] },
  { key: 'notion', label: 'Notion', description: 'Lecture/écriture DB Linkedin', testRoute: '/api/notion/status',
    secretFields: [
      { provider: 'notion',       label: 'API Token',     placeholder: 'ntn_…' },
      { provider: 'notion_ds_id', label: 'Database ID',   placeholder: '6512e6e4-ce60-4894-907d-35c3736f1df5', hint: 'UUID de la DB Linkedin (avec ou sans tirets)' }
    ] },
  { key: 'anthropic', label: 'Claude (Anthropic)', description: 'Génération texte + visuels SVG',
    secretFields: [{ provider: 'anthropic', label: 'API Key', placeholder: 'sk-ant-…' }] },
  { key: 'openai', label: 'OpenAI (DALL-E)', description: 'Visuels illustration / ads PNG',
    secretFields: [{ provider: 'openai', label: 'API Key', placeholder: 'sk-…' }] },
  { key: 'github', label: 'GitHub', description: 'Sources produit (commits, releases) pour le radar',
    secretFields: [
      { provider: 'github',       label: 'Personal Access Token', placeholder: 'ghp_…', hint: 'Scope read:repo' },
      { provider: 'github_repos', label: 'Repos à scanner',       placeholder: 'cyrilc-git/cadence-api,cyrilc-git/heelio' }
    ] },
  { key: 'gmail',    label: 'Gmail',         description: 'À venir : OAuth Google', secretFields: [] },
  { key: 'gdrive',   label: 'Google Drive',  description: 'À venir : OAuth Google', secretFields: [] },
  { key: 'onedrive', label: 'OneDrive',      description: 'À venir : OAuth Microsoft', secretFields: [] }
];

export default function SettingsClient({ li, notionOk, notionError, connectors, initialCreds, masterKeyMissing }: any) {
  const [creds, setCreds] = useState<any[]>(initialCreds);
  const [editing, setEditing] = useState<{ providerKey: string; field: string; value: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  function credFor(field: string) { return creds.find(c => c.provider === field && c.status === 'active'); }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      const r = await fetch('/api/credentials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: editing.field, secret: editing.value }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      // Replace any existing active cred for this provider
      setCreds([d.item, ...creds.filter(c => !(c.provider === editing.field && c.status === 'active'))]);
      setEditing(null);
    } catch (e: any) {
      alert('Erreur : ' + e.message);
    } finally { setSaving(false); }
  }
  async function revoke(id: string) {
    if (!confirm('Révoquer cette clé ? Cadence basculera sur la valeur env var si disponible.')) return;
    const r = await fetch(`/api/credentials/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'revoke' }) });
    if (r.ok) setCreds(creds.map(c => c.id === id ? { ...c, status: 'revoked' } : c));
  }
  async function test(id: string) {
    setTesting(id);
    try {
      const r = await fetch(`/api/credentials/${id}/test`, { method: 'POST' });
      const d = await r.json();
      setCreds(creds.map(c => c.id === id ? { ...c, last_tested_at: new Date().toISOString(), last_error: d.ok ? null : d.error, status: d.ok ? 'active' : 'error' } : c));
    } finally { setTesting(null); }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-ink-900">Connecteurs</h1>
        <p className="mt-1 text-ink-500">Vos sources branchées à Cadence. Les credentials sont chiffrés côté serveur, jamais exposés au client.</p>
      </header>

      {masterKeyMissing && (
        <div className="bg-warn-50 ring-1 ring-inset ring-warn-500/20 rounded-2xl p-4 text-sm text-warn-700">
          <strong className="font-semibold">MASTER_ENCRYPTION_KEY manquante.</strong> Pour activer le stockage in-app des credentials, ajoutez cette variable d'env dans Vercel (chaîne aléatoire ≥ 32 caractères) puis redéployez.
          En attendant, Cadence continue d'utiliser les env vars Vercel pour les credentials existants.
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {PROVIDERS.map(p => {
          // Source resolution: any active cred in DB for any of this provider's fields means "DB"; else fall back to env presence inferred from connectors[]
          const dbHas = p.secretFields.some(f => !!credFor(f.provider));
          const envHas = (connectors.find((c: any) => c.kind === p.key)?.status === 'connected') || (connectors.find((c: any) => c.kind === p.key)?.status === 'needs_setup' ? false : true);
          let status: 'connected' | 'error' | 'disconnected' | 'needs_setup' = 'needs_setup';
          if (p.key === 'linkedin') status = li.status === 'connected' ? 'connected' : li.status === 'expired' ? 'error' : 'disconnected';
          else if (p.key === 'notion') status = notionOk ? 'connected' : 'error';
          else if (dbHas) status = 'connected';
          else status = (connectors.find((c: any) => c.kind === p.key)?.status as any) || 'needs_setup';

          return (
            <div key={p.key} className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-ink-900">{p.label}</h2>
                  <p className="text-xs text-ink-500 mt-0.5">{p.description}</p>
                </div>
                {status === 'connected' && <StatusBadge variant="success">Connecté</StatusBadge>}
                {status === 'error' && <StatusBadge variant="danger">Erreur</StatusBadge>}
                {status === 'needs_setup' && <StatusBadge variant="warn">À configurer</StatusBadge>}
                {status === 'disconnected' && <StatusBadge variant="neutral">Déconnecté</StatusBadge>}
              </div>

              {p.key === 'linkedin' && li.status === 'connected' && <p className="mt-2 text-sm text-ink-700">{li.name} · {li.email}</p>}
              {p.key === 'linkedin' && li.error && <p className="mt-2 text-xs text-danger-700">{li.error}</p>}
              {p.key === 'notion' && !notionOk && notionError && <p className="mt-2 text-xs text-danger-700 break-words">{notionError}</p>}

              {p.secretFields.length > 0 && (
                <div className="mt-3 space-y-2">
                  {p.secretFields.map(f => {
                    const existing = credFor(f.provider);
                    return (
                      <div key={f.provider} className="flex items-center gap-2 text-sm">
                        <span className="text-xs text-ink-500 w-32 shrink-0">{f.label}</span>
                        {existing ? (
                          <>
                            <code className="flex-1 text-xs bg-ink-50 rounded px-2 py-1 text-ink-700">{existing.masked || '••••••••'}</code>
                            <span className="text-[10px] text-success-700">DB</span>
                            <button onClick={() => test(existing.id)} disabled={testing === existing.id} className="text-xs px-2 py-1 rounded ring-1 ring-ink-300 hover:bg-ink-50">
                              {testing === existing.id ? '…' : 'Tester'}
                            </button>
                            <button onClick={() => revoke(existing.id)} className="text-xs px-2 py-1 rounded text-danger-700 hover:bg-danger-50">Révoquer</button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-xs text-ink-500 italic">{(connectors.find((c: any) => c.kind === p.key)?.status === 'connected' || (p.key === 'notion' && notionOk)) ? '(via env var)' : '(non configuré)'}</span>
                            <button onClick={() => setEditing({ providerKey: p.key, field: f.provider, value: '' })} className="text-xs px-2 py-1 rounded bg-brand-500 text-white hover:bg-brand-600">Ajouter</button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-3 flex gap-2 flex-wrap">
                {p.oauthRoute && <Link href={p.oauthRoute} className="text-xs px-3 py-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 font-medium">{status === 'connected' ? 'Reconnecter' : 'Connecter OAuth'}</Link>}
                {p.testRoute && <a href={p.testRoute} target="_blank" rel="noopener" className="text-xs px-3 py-1.5 rounded-lg ring-1 ring-ink-300 hover:bg-ink-50">Tester</a>}
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-ink-900/40 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-pop w-full max-w-md p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-ink-900">Ajouter une clé</h3>
            <p className="text-xs text-ink-500">Provider : <code>{editing.field}</code></p>
            <input type="password" value={editing.value} onChange={e => setEditing({ ...editing, value: e.target.value })} placeholder="Coller la valeur ici…" className="w-full px-3 py-2 rounded-lg ring-1 ring-ink-300 text-sm focus:ring-brand-500 focus:border-brand-500" autoFocus />
            <p className="text-xs text-ink-500">La valeur sera chiffrée (AES-256-GCM) avant insertion. Vous ne la reverrez plus en clair.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg ring-1 ring-ink-300 text-sm hover:bg-ink-50">Annuler</button>
              <button onClick={save} disabled={saving || !editing.value.trim()} className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50">
                {saving ? 'Chiffrement…' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
