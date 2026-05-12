'use client';

import { useState } from 'react';

export default function PublishModal({ open, onClose, text, notionPageId, onPublished }: {
  open: boolean;
  onClose: () => void;
  text: string;
  notionPageId?: string;
  onPublished?: (urn: string) => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ urn: string; url: string } | null>(null);

  if (!open) return null;

  async function handlePublish() {
    if (!confirmed) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, notion_page_id: notionPageId, source: 'ui' })
      });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(data.error || 'Échec de la publication');
      const url = `https://www.linkedin.com/feed/update/${data.post_urn}`;
      setDone({ urn: data.post_urn, url });
      onPublished?.(data.post_urn);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-ink-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-pop w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        {done ? (
          <>
            <div className="w-12 h-12 mx-auto rounded-full bg-success-50 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-success-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            </div>
            <h3 className="text-lg font-semibold text-center text-ink-900">Publié sur LinkedIn ✓</h3>
            <p className="mt-1 text-sm text-center text-ink-500">URN : <code className="text-xs">{done.urn}</code></p>
            <div className="mt-5 flex gap-2 justify-center">
              <a href={done.url} target="_blank" rel="noopener" className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600">Voir le post</a>
              <button onClick={onClose} className="px-4 py-2 rounded-lg ring-1 ring-ink-300 text-sm font-medium hover:bg-ink-50">Fermer</button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-ink-900">Publier sur LinkedIn</h3>
            <p className="mt-1 text-sm text-ink-500">Vérifiez le texte. La publication est immédiate et publique sur votre profil.</p>

            <div className="mt-4 max-h-72 overflow-y-auto p-4 rounded-xl bg-ink-50 border border-ink-100 text-sm text-ink-900 whitespace-pre-wrap">
              {text}
            </div>

            <label className="mt-4 flex items-start gap-3 cursor-pointer select-none">
              <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500" />
              <span className="text-sm text-ink-700">
                Je valide la publication de ce texte exact sur mon profil LinkedIn maintenant.
              </span>
            </label>

            {error && <div className="mt-3 text-sm text-danger-700 bg-danger-50 px-3 py-2 rounded-lg">{error}</div>}

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={onClose} disabled={loading} className="px-4 py-2 rounded-lg ring-1 ring-ink-300 text-sm font-medium hover:bg-ink-50 disabled:opacity-60">Annuler</button>
              <button onClick={handlePublish} disabled={!confirmed || loading}
                className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? 'Publication…' : 'Publier sur LinkedIn'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
