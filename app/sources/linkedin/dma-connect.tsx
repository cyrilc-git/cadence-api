'use client';

// V54 — Connexion automatique LinkedIn (DMA). Champ de collage du token +
// statut + rattrapage historique. Tout passe par /api/sources/linkedin/dma
// en same-origin (aucun secret a manipuler). Le token va du navigateur vers
// la base de Cadence, jamais ailleurs.

import { useState, useEffect } from 'react';

export default function DmaConnect() {
  const [status, setStatus] = useState<'loading' | 'on' | 'off'>('loading');
  const [expires, setExpires] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [snap, setSnap] = useState<any>(null);

  async function refresh() {
    try {
      const r = await fetch('/api/sources/linkedin/dma');
      const d = await r.json();
      setStatus(d.connected ? 'on' : 'off');
      setExpires(d.expires_at || null);
      setCursor(d.cursor || null);
    } catch { setStatus('off'); }
  }
  useEffect(() => { refresh(); }, []);

  async function connect() {
    if (!token.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/sources/linkedin/dma', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ access_token: token.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'erreur');
      setToken(''); setMsg('Token enregistré. Cadence est connecté.');
      await refresh();
    } catch (e: any) { setMsg('Échec : ' + e.message); }
    finally { setBusy(false); }
  }

  async function runSnapshot() {
    setBusy(true); setMsg(null); setSnap(null);
    try {
      const r = await fetch('/api/sources/linkedin/dma', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'snapshot' }),
      });
      const d = await r.json();
      setSnap(d);
      await refresh();
    } catch (e: any) { setMsg('Échec : ' + e.message); }
    finally { setBusy(false); }
  }

  return (
    <section className="rounded-2xl border border-[#0A66C2]/20 bg-[#0A66C2]/[0.03] p-5 space-y-4">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-lg bg-[#0A66C2] text-white inline-flex items-center justify-center shrink-0 font-bold text-sm">in</span>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-ink-900">Synchronisation automatique</h2>
          <p className="text-xs text-ink-500 leading-relaxed mt-0.5">
            Cadence se met à jour toute seule quand vous publiez — même en direct sur LinkedIn.
            Vous connectez une fois, puis vous n&apos;avez plus rien à faire.
          </p>
        </div>
        {status === 'on' && <span className="text-2xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md shrink-0">● Connecté</span>}
      </div>

      {status === 'off' && (
        <div className="space-y-3">
          <ol className="text-xs text-ink-600 leading-relaxed list-decimal pl-4 space-y-0.5">
            <li>Créez l&apos;app DMA sur <a href="https://www.linkedin.com/developers/apps/" target="_blank" rel="noopener" className="text-brand-700 hover:underline">le portail développeur</a> (avec la company page « Member Data Portability (Member) Default Company »).</li>
            <li>Onglet <em>Products</em> → demandez « Member Data Portability API (Member) ».</li>
            <li><em>Docs and tools</em> → <em>OAuth Token Tools</em> → scope <code className="text-ink-800">r_dma_portability_self_serve</code> → générez et copiez le token.</li>
          </ol>
          <div className="flex items-stretch gap-2">
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Collez votre access token LinkedIn ici"
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-ink-200 bg-white focus:outline-none focus:border-[#0A66C2] font-mono"
            />
            <button onClick={connect} disabled={busy || !token.trim()} className="btn-primary text-sm disabled:opacity-40 shrink-0">
              {busy ? '…' : 'Connecter'}
            </button>
          </div>
        </div>
      )}

      {status === 'on' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap text-xs text-ink-500">
            {expires && <span>Token valable jusqu&apos;au {new Date(expires).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}.</span>}
            {cursor && <span>Suivi actif. « Actualiser » force la récupération immédiate de vos posts, même publiés en direct.</span>}
            {!cursor && <span>« Actualiser » importe votre historique et vos posts récents.</span>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={runSnapshot} disabled={busy} className="btn-primary text-sm disabled:opacity-40">
              {busy ? 'Actualisation…' : '↻ Actualiser mes posts LinkedIn'}
            </button>
            <button onClick={() => { setStatus('off'); setSnap(null); }} className="text-xs text-ink-500 hover:text-ink-900 transition">
              Reconnecter (nouveau token)
            </button>
          </div>
          {snap && (
            <div className="text-xs text-ink-600 bg-white rounded-lg border border-ink-100 p-3 leading-relaxed">
              {snap.token_expired
                ? <span className="text-danger-700">Le token semble expiré (401). Reconnectez avec un token frais.</span>
                : snap?.snapshot?.pending
                ? <span>LinkedIn prépare encore votre historique (la collecte peut prendre quelques heures après la connexion). <strong className="text-ink-800">Aucune action de votre part</strong> : Cadence le récupérera automatiquement dès que c&apos;est prêt. Vos nouveaux posts, eux, sont déjà captés en direct.</span>
                : <span>
                    Historique : {snap?.snapshot?.upserted ?? 0} post{(snap?.snapshot?.upserted ?? 0) > 1 ? 's' : ''} récupéré{(snap?.snapshot?.upserted ?? 0) > 1 ? 's' : ''} ·
                    {' '}Direct : {snap?.changelog?.upserted ?? 0} post{(snap?.changelog?.upserted ?? 0) > 1 ? 's' : ''} récent{(snap?.changelog?.upserted ?? 0) > 1 ? 's' : ''}.
                    {(snap?.snapshot?.error || snap?.changelog?.error) && <span className="text-amber-700"> (détail technique transmis à l&apos;équipe.)</span>}
                  </span>}
            </div>
          )}
        </div>
      )}

      {msg && <p className="text-xs text-ink-500">{msg}</p>}
    </section>
  );
}
