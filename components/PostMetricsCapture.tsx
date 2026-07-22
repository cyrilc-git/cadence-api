'use client';

import { useState } from 'react';

// V58.12 — Saisie rapide des résultats d'un post publié (impressions /
// réactions / commentaires). ~10s par post, et ça rallume tout le moteur
// d'analyse (quel pilier / hook / longueur convertit) qui était aveugle depuis
// la déconnexion Notion. LinkedIn n'expose pas ces chiffres par API pour un
// profil personnel : la saisie manuelle est la seule voie.

type Metrics = { impressions?: number; likes?: number; comments?: number };

export default function PostMetricsCapture({ ciId, initial }: { ciId: string; initial?: Metrics }) {
  const [impressions, setImpressions] = useState(initial?.impressions != null ? String(initial.impressions) : '');
  const [likes, setLikes] = useState(initial?.likes != null ? String(initial.likes) : '');
  const [comments, setComments] = useState(initial?.comments != null ? String(initial.comments) : '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const hasAny = [impressions, likes, comments].some(v => v.trim() !== '');

  async function save() {
    if (!hasAny || saving) return;
    setSaving(true); setMsg(null);
    try {
      const r = await fetch(`/api/content-items/${ciId}/metrics`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          impressions: impressions.trim() === '' ? undefined : Number(impressions),
          likes: likes.trim() === '' ? undefined : Number(likes),
          comments: comments.trim() === '' ? undefined : Number(comments),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setMsg('Enregistré');
      setTimeout(() => setMsg(null), 2000);
    } catch (e: any) {
      setMsg('Erreur : ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, value: string, set: (s: string) => void) => (
    <label className="flex-1 min-w-[92px]">
      <span className="block text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-1">{label}</span>
      <input
        type="number" min="0" inputMode="numeric" value={value}
        onChange={e => set(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); }}
        placeholder="—"
        className="input text-sm w-full tabular-nums"
      />
    </label>
  );

  return (
    <div className="pt-4 border-t border-ink-100">
      <p className="text-2xs uppercase tracking-wider font-semibold text-ink-500">Résultats sur LinkedIn</p>
      <p className="mt-1 text-2xs text-ink-400 leading-relaxed">
        Recopiez les chiffres depuis LinkedIn. Ça calibre les recommandations de Cadence sur vos vrais résultats (aucune API ne les fournit).
      </p>
      <div className="mt-3 flex items-end gap-2 flex-wrap">
        {field('Impressions', impressions, setImpressions)}
        {field('Réactions', likes, setLikes)}
        {field('Commentaires', comments, setComments)}
        <button onClick={save} disabled={!hasAny || saving} className="btn-primary text-xs h-9">
          {saving ? '…' : 'Enregistrer'}
        </button>
      </div>
      {msg && <p className={`mt-2 text-2xs ${msg.startsWith('Erreur') ? 'text-danger-700' : 'text-success-700'}`}>{msg}</p>}
    </div>
  );
}
