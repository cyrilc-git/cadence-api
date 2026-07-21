'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

function tomorrowISO(): string {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// V38.3 — Modal unifié "Publier ou programmer" avec aperçu illustration.
// Deux chemins :
//  - Publier maintenant : POST /api/publish (immédiat, confirmation requise).
//  - Programmer : choisit date + heure, délègue à onSchedule (le parent gère
//    la sauvegarde Notion en statut programmé). Après succès, lien calendrier.
// V51 §2 — initialMode/defaultDate/defaultTime : le parent ouvre la modale
// directement sur le bon onglet (Programmer vs Publier) avec la date intelligente
// dérivée du pilier.
export default function PublishModal({ open, onClose, text, image, notionPageId, onPublished, onSchedule, initialMode, defaultDate, defaultTime }: {
  open: boolean;
  onClose: () => void;
  text: string;
  image?: string | null;
  notionPageId?: string;
  onPublished?: (urn: string) => void;
  // V38.3 — Programmation : retourne true si la sauvegarde a réussi.
  onSchedule?: (date: string, time: string) => Promise<boolean>;
  initialMode?: 'publish' | 'schedule';
  defaultDate?: string;
  defaultTime?: string;
}) {
  const [mode, setMode] = useState<'now' | 'schedule'>('now');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ kind: 'published'; urn: string; url: string } | { kind: 'scheduled'; date: string } | null>(null);
  // Date par défaut : demain 07:30 (ou la date fournie par le parent)
  const [date, setDate] = useState(defaultDate || tomorrowISO());
  const [time, setTime] = useState(defaultTime || '07:30');

  // V51 §2 — À l'ouverture, adopter le mode + la date/heure du parent.
  useEffect(() => {
    if (!open) return;
    setMode(initialMode === 'schedule' ? 'schedule' : 'now');
    if (defaultDate) setDate(defaultDate);
    if (defaultTime) setTime(defaultTime);
    setError(null);
  }, [open, initialMode, defaultDate, defaultTime]);

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
      setDone({ kind: 'published', urn: data.post_urn, url });
      onPublished?.(data.post_urn);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSchedule() {
    if (!onSchedule) return;
    setLoading(true);
    setError(null);
    try {
      const ok = await onSchedule(date, time);
      if (!ok) throw new Error('La programmation a échoué.');
      setDone({ kind: 'scheduled', date });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setConfirmed(false);
    setError(null);
    setDone(null);
    setMode('now');
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-ink-900/40 backdrop-blur-sm" onClick={reset}>
      <div className="bg-white rounded-2xl shadow-pop w-full max-w-lg max-h-[88vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        {done ? (
          done.kind === 'published' ? (
            <>
              <div className="w-12 h-12 mx-auto rounded-full bg-success-50 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-success-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              </div>
              <h3 className="text-lg font-semibold text-center text-ink-900">Publié sur LinkedIn</h3>
              <p className="mt-1 text-sm text-center text-ink-500">Votre post est en ligne.</p>
              <div className="mt-5 flex gap-2 justify-center flex-wrap">
                <a href={done.url} target="_blank" rel="noopener" className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600">Voir le post ↗</a>
                <Link href="/calendar?source=linkedin" className="px-4 py-2 rounded-lg ring-1 ring-ink-300 text-sm font-medium hover:bg-ink-50">Voir dans le calendrier</Link>
                <button onClick={reset} className="px-4 py-2 rounded-lg ring-1 ring-ink-300 text-sm font-medium hover:bg-ink-50">Fermer</button>
              </div>
            </>
          ) : (
            <>
              <div className="w-12 h-12 mx-auto rounded-full bg-brand-50 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-brand-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              </div>
              <h3 className="text-lg font-semibold text-center text-ink-900">Programmé</h3>
              <p className="mt-1 text-sm text-center text-ink-500">
                Le {new Date(done.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {time}. En brouillon non validé : rien ne partira sans votre validation finale.
              </p>
              <div className="mt-5 flex gap-2 justify-center flex-wrap">
                <Link href={`/calendar?d=${done.date}`} className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600">Voir dans le calendrier →</Link>
                <button onClick={reset} className="px-4 py-2 rounded-lg ring-1 ring-ink-300 text-sm font-medium hover:bg-ink-50">Fermer</button>
              </div>
            </>
          )
        ) : (
          <>
            <h3 className="text-lg font-semibold text-ink-900">Publier ou programmer</h3>
            <p className="mt-1 text-sm text-ink-500">Vérifiez le rendu, puis publiez maintenant ou choisissez une date.</p>

            {/* V38.3 — Aperçu : illustration (si présente) + texte */}
            {image && (
              <div className="mt-4 rounded-xl overflow-hidden border border-ink-100 bg-white">
                {image.trim().startsWith('<svg')
                  ? <div className="w-full" dangerouslySetInnerHTML={{ __html: image }} />
                  /* eslint-disable-next-line @next/next/no-img-element */
                  : <img src={image} alt="" className="w-full h-auto" />}
              </div>
            )}
            {/* V58.9 — Honnêteté : la publication LinkedIn ne joint PAS encore le
                visuel (publishUgcPost envoie le texte seul). On le dit au lieu de
                laisser croire que le visuel affiché part avec le post. */}
            {image && mode === 'now' && (
              <div className="mt-2 flex items-start gap-2 text-2xs text-warn-700 bg-warn-50 border border-warn-100 rounded-lg px-3 py-2 leading-relaxed">
                <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>
                <span>Le visuel ci-dessus ne sera <strong>pas</strong> joint au post : LinkedIn ne recevra que le texte. Ajoutez l&apos;image à la main sur LinkedIn après publication.</span>
              </div>
            )}
            <div className="mt-3 max-h-56 overflow-y-auto p-4 rounded-xl bg-ink-50 border border-ink-100 text-sm text-ink-900 whitespace-pre-wrap">
              {text}
            </div>

            {/* V38.3 — Choix du mode */}
            {onSchedule && (
              <div className="mt-4 inline-flex bg-ink-100 rounded-lg p-0.5 gap-0.5">
                <button onClick={() => { setMode('now'); setError(null); }} className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${mode === 'now' ? 'bg-white text-ink-900 shadow-xs' : 'text-ink-600'}`}>Publier maintenant</button>
                <button onClick={() => { setMode('schedule'); setError(null); }} className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${mode === 'schedule' ? 'bg-white text-ink-900 shadow-xs' : 'text-ink-600'}`}>Programmer</button>
              </div>
            )}

            {mode === 'now' ? (
              <label className="mt-4 flex items-start gap-3 cursor-pointer select-none">
                <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500" />
                <span className="text-sm text-ink-700">
                  Je valide la publication de ce texte exact sur mon profil LinkedIn maintenant.
                </span>
              </label>
            ) : (
              <div className="mt-4">
                <p className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-2">Date et heure</p>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input text-sm" />
                  <input type="time" value={time} onChange={e => setTime(e.target.value)} className="input text-sm" />
                </div>
                <p className="mt-2 text-2xs text-ink-400 leading-relaxed">Programmé en brouillon non validé. Aucune publication automatique : vous validez chaque post avant qu&apos;il parte.</p>
              </div>
            )}

            {error && <div className="mt-3 text-sm text-danger-700 bg-danger-50 px-3 py-2 rounded-lg">{error}</div>}

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={reset} disabled={loading} className="px-4 py-2 rounded-lg ring-1 ring-ink-300 text-sm font-medium hover:bg-ink-50 disabled:opacity-60">Annuler</button>
              {mode === 'now' ? (
                <button onClick={handlePublish} disabled={!confirmed || loading}
                  className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? 'Publication…' : 'Publier sur LinkedIn'}
                </button>
              ) : (
                <button onClick={handleSchedule} disabled={loading}
                  className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? 'Programmation…' : 'Programmer'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
