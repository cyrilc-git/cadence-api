'use client';

// V18.3 — Section "Votre voix aujourd'hui" affichée dans /cerveau.
// Prose éditoriale calme. Pas de jauge KPI. Pas de dashboard froid.
// Si la mémoire est vide ou trop fragile (< 5 posts), on propose une
// action explicite pour la recalculer manuellement.

import { useEffect, useState } from 'react';

type StyleMemory = {
  avg_hook_len: number;
  avg_sentence_len: number;
  avg_paragraph_count: number;
  avg_post_len: number;
  jargon_level: number;
  pedagogical_level: number;
  density_score: number;
  top_hooks: string[];
  top_openings: string[];
  top_closings: string[];
  narrative_kinds: Record<string, number>;
  favorite_words: { word: string; count: number }[];
  repeated_phrases: string[];
  posts_analyzed: number;
  confidence_score: number;
  voice_summary: string;
  computed_at: string;
};

export default function StyleMemoryView() {
  const [mem, setMem] = useState<StyleMemory | null | undefined>(undefined);
  const [recomputing, setRecomputing] = useState(false);
  const [recomputeMsg, setRecomputeMsg] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch('/api/style-memory', { cache: 'no-store' });
      const d = await r.json();
      setMem(d.memory || null);
    } catch {
      setMem(null);
    }
  }

  useEffect(() => { load(); }, []);

  async function recompute() {
    setRecomputing(true);
    setRecomputeMsg(null);
    try {
      const r = await fetch('/api/style-memory', { method: 'POST' });
      const d = await r.json();
      if (r.ok) {
        setRecomputeMsg(`${d.analyzed} post${d.analyzed > 1 ? 's' : ''} analysé${d.analyzed > 1 ? 's' : ''}.`);
        await load();
      } else {
        setRecomputeMsg('Erreur : ' + (d.error || 'recompute failed'));
      }
    } catch (e: any) {
      setRecomputeMsg('Erreur : ' + e.message);
    } finally { setRecomputing(false); }
  }

  if (mem === undefined) {
    // Loading initial
    return (
      <section>
        <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-3">Votre voix</h2>
        <div className="skeleton h-4 w-3/4 mb-2" />
        <div className="skeleton h-4 w-1/2" />
      </section>
    );
  }

  if (mem === null || mem.posts_analyzed === 0) {
    return (
      <section>
        <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-3">Votre voix</h2>
        <p className="text-sm text-ink-700 leading-relaxed max-w-2xl">
          Cadence n&apos;a pas encore de signal stylistique. Importez votre archive LinkedIn ou publiez quelques posts pour activer la mémoire de voix.
        </p>
        <button
          onClick={recompute}
          disabled={recomputing}
          className="mt-3 text-xs text-brand-700 hover:text-brand-900 transition disabled:opacity-50 underline decoration-dotted underline-offset-2"
        >
          {recomputing ? 'Calcul…' : 'Lancer le calcul à la main'}
        </button>
        {recomputeMsg && <p className="mt-2 text-2xs text-ink-500">{recomputeMsg}</p>}
      </section>
    );
  }

  // Affichage riche : voice_summary + détails déroulables
  const NARRATIVE_LABELS: Record<string, string> = {
    hook_promet_trop: 'hook qui promet trop',
    morale_finale_assenee: 'morale assénée',
    sans_friction_concrete: 'sans friction concrète',
    manque_bascule: 'sans bascule',
    scene_absente: 'sans scène',
    tout_demonstratif: 'trop démonstratif',
    lineaire_explicatif: 'linéaire explicatif',
    ralentit_trop: 'pavé qui ralentit',
  };
  const narrativeEntries = Object.entries(mem.narrative_kinds)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-2">Votre voix</h2>
        <p className="text-sm text-ink-800 leading-relaxed max-w-2xl">{mem.voice_summary}</p>
        <p className="mt-2 text-2xs text-ink-400 italic">
          Confiance : {Math.round(mem.confidence_score * 100)}%
          {mem.confidence_score < 0.5 && ' — la signature se précisera avec plus de posts analysés.'}
        </p>
      </div>

      {mem.top_openings.length > 0 && (
        <div className="border-l-2 border-ink-200 pl-4">
          <p className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-1.5">Vos openings récurrents</p>
          <ul className="space-y-1">
            {mem.top_openings.map((o, i) => (
              <li key={i} className="text-sm text-ink-700 leading-relaxed">« {o}… »</li>
            ))}
          </ul>
        </div>
      )}

      {mem.top_closings.length > 0 && (
        <div className="border-l-2 border-ink-200 pl-4">
          <p className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-1.5">Vos fermetures récurrentes</p>
          <ul className="space-y-1">
            {mem.top_closings.map((c, i) => (
              <li key={i} className="text-sm text-ink-700 leading-relaxed">« {c}… »</li>
            ))}
          </ul>
        </div>
      )}

      {mem.favorite_words.length > 0 && (
        <div>
          <p className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-1.5">Vos mots de chevet</p>
          <p className="text-sm text-ink-700 leading-relaxed">
            {mem.favorite_words.slice(0, 8).map((w, i) => (
              <span key={i}>
                {i > 0 && <span className="text-ink-300"> · </span>}
                <span>{w.word}</span>
                <span className="text-ink-400 text-2xs"> {w.count}</span>
              </span>
            ))}
          </p>
        </div>
      )}

      {narrativeEntries.length > 0 && (
        <div>
          <p className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-1.5">Tendances narratives</p>
          <ul className="space-y-1">
            {narrativeEntries.map(([kind, count]) => (
              <li key={kind} className="text-sm text-ink-700 leading-relaxed">
                <span className="capitalize">{NARRATIVE_LABELS[kind] || kind}</span>
                <span className="text-ink-400 text-2xs ml-2">{count} post{count > 1 ? 's' : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="pt-3 border-t border-ink-100 flex items-baseline justify-between flex-wrap gap-2">
        <p className="text-2xs text-ink-400 italic">
          Calculé sur {mem.posts_analyzed} post{mem.posts_analyzed > 1 ? 's' : ''} · dernière analyse {new Date(mem.computed_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}.
        </p>
        <button
          onClick={recompute}
          disabled={recomputing}
          className="text-2xs text-ink-500 hover:text-ink-900 transition disabled:opacity-50 underline decoration-dotted underline-offset-2"
        >
          {recomputing ? 'Recalcul…' : 'Recalculer'}
        </button>
      </div>
      {recomputeMsg && <p className="text-2xs text-ink-500">{recomputeMsg}</p>}
    </section>
  );
}
