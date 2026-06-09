'use client';

// V52 commit 7 — Aujourd'hui = produit principal. Le directeur éditorial qui
// attend Cyril. Jamais une page blanche : une recommandation incarnée + la
// dictée vocale (premier niveau, Web Speech) + un radar de 3 opportunités.
// Aucune métrique, aucun score chiffré, aucun jargon IA, aucun dashboard.

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Hero = { id: string; title: string; hook: string | null; why: string | null; pilier: string | null } | null;
type Opp = { id: string; title: string; hook?: string | null; why: string | null; pilier: string | null; stars: number };

function typeLabel(pilier: string | null): string {
  if (!pilier) return 'IDÉE';
  const tail = pilier.includes('·') ? pilier.split('·').pop()!.trim() : pilier.trim();
  return tail.toUpperCase();
}

// Déduplique les segments d'un « pourquoi » séparés par un point médian
// (le moteur peut répéter une même raison). Évite « X · X · Y ».
function dedupSegments(s: string | null): string {
  if (!s) return '';
  return Array.from(new Set(s.split(/\s*·\s*/).map(x => x.trim()).filter(Boolean))).join(' · ');
}

function Stars({ n }: { n: number }) {
  const full = Math.max(1, Math.min(5, n));
  return (
    <span className="text-amber-500 tracking-tight" aria-label={`priorité ${full} sur 5`}>
      {'★'.repeat(full)}<span className="text-ink-200">{'★'.repeat(5 - full)}</span>
    </span>
  );
}

export default function AujourdhuiClient({
  greeting, when, hero, opportunities,
}: {
  greeting: string;
  when: string;
  hero: Hero;
  opportunities: Opp[];
}) {
  const router = useRouter();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voiceSupported, setVoiceSupported] = useState(true);
  const recRef = useRef<any>(null);

  useEffect(() => {
    const SR = (typeof window !== 'undefined') && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SR) { setVoiceSupported(false); return; }
    const rec = new SR();
    rec.lang = 'fr-FR';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setTranscript(text);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    return () => { try { rec.stop(); } catch {} };
  }, []);

  function toggleVoice() {
    const rec = recRef.current;
    if (!rec) return;
    if (listening) { try { rec.stop(); } catch {} setListening(false); return; }
    setTranscript('');
    try { rec.start(); setListening(true); } catch {}
  }

  function writeBrief(brief: string) {
    if (!brief.trim()) return;
    router.push('/posts/new?brief=' + encodeURIComponent(brief.trim()));
  }

  return (
    <div className="max-w-2xl mx-auto px-5 lg:px-8 py-10 lg:py-16 space-y-10">
      {/* En-tête */}
      <header>
        <p className="text-sm text-ink-400">{greeting}</p>
      </header>

      {/* HÉROS — la recommandation incarnée */}
      {hero ? (
        <section className="space-y-4">
          <h1 className="text-2xl font-semibold text-ink-900 tracking-tight font-editorial leading-snug">
            Je vous recommande de publier ceci {when}.
          </h1>

          <div className="rounded-2xl border border-ink-100 p-5 bg-white shadow-card">
            <p className="text-lg font-semibold text-ink-900 leading-snug">{hero.title}</p>
            {hero.hook && <p className="mt-2 text-sm text-ink-600 italic leading-relaxed">« {hero.hook} »</p>}
          </div>

          {hero.why && (
            <div className="text-sm text-ink-500 leading-relaxed">
              <span className="block text-2xs uppercase tracking-wider font-semibold text-ink-400 mb-0.5">Pourquoi maintenant</span>
              <span className="block line-clamp-3">{dedupSegments(hero.why)}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button onClick={() => writeBrief(hero.title)} className="btn-primary text-sm py-2.5">Écrire ce post →</button>
            <a href={'/?skip=' + hero.id} className="text-sm text-ink-500 hover:text-ink-900 transition px-3 py-2.5 rounded-lg">Autre idée</a>
          </div>
        </section>
      ) : (
        <section className="space-y-2">
          <h1 className="text-2xl font-semibold text-ink-900 tracking-tight font-editorial">Vous êtes à jour.</h1>
          <p className="text-sm text-ink-500 leading-relaxed">Dictez une idée ci-dessous, ou revenez demain : je vous proposerai un sujet.</p>
        </section>
      )}

      {/* DICTÉE VOCALE — entrée de premier niveau */}
      <section>
        <div className="rounded-2xl border border-ink-100 p-4 bg-ink-50/40">
          {!listening ? (
            <button onClick={voiceSupported ? toggleVoice : () => writeBrief(transcript)} className="w-full flex items-center gap-3 text-left">
              <span className="w-10 h-10 rounded-full bg-brand-600 text-white inline-flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" d="M12 18.5v2.5M8 21h8"/><rect x="9" y="3" width="6" height="11" rx="3"/><path strokeLinecap="round" d="M5 11a7 7 0 0014 0"/></svg>
              </span>
              <span>
                <span className="block text-sm font-medium text-ink-900">Parlez, je transforme ça en contenu.</span>
                <span className="block text-xs text-ink-500">30 secondes à 5 minutes. Mains libres.</span>
              </span>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-danger-500 text-white inline-flex items-center justify-center shrink-0 animate-pulse">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>
                </span>
                <span className="text-sm font-medium text-ink-900">J&apos;écoute…</span>
              </div>
              <p className="text-sm text-ink-700 leading-relaxed min-h-[1.5rem]">{transcript || <span className="text-ink-400">Dites votre idée…</span>}</p>
              <div className="flex items-center gap-3">
                <button onClick={() => writeBrief(transcript)} disabled={!transcript.trim()} className="btn-primary text-xs disabled:opacity-40">Transformer en contenu</button>
                <button onClick={toggleVoice} className="text-xs text-ink-500 hover:text-ink-900 transition">Arrêter</button>
              </div>
            </div>
          )}
          {!voiceSupported && (
            <p className="mt-3 text-xs text-ink-400">La dictée n&apos;est pas disponible sur ce navigateur. <a href="/posts/new" className="text-brand-700 hover:text-brand-900">Écrire au clavier →</a></p>
          )}
        </div>
      </section>

      {/* RADAR — max 3 opportunités */}
      {opportunities.length > 0 && (
        <section className="space-y-3">
          <p className="text-2xs uppercase tracking-wider font-semibold text-ink-400">J&apos;ai aussi repéré pour vous</p>
          <ul className="divide-y divide-ink-100 rounded-2xl border border-ink-100 overflow-hidden">
            {opportunities.slice(0, 3).map(o => (
              <li key={o.id} className="p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-2xs uppercase tracking-wider font-semibold text-ink-500">{typeLabel(o.pilier)}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-ink-900 leading-snug">{o.title}</p>
                  {o.hook && <p className="mt-1 text-xs text-ink-600 italic leading-snug line-clamp-1">« {o.hook} »</p>}
                  {o.why && <p className="mt-1 text-xs text-ink-500 leading-relaxed line-clamp-1">{dedupSegments(o.why)}</p>}
                </div>
                <button onClick={() => writeBrief(o.title)} className="text-sm text-brand-700 hover:text-brand-900 font-medium transition shrink-0 px-2 py-2 -my-1">Créer →</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
