'use client';

// V18.3 — Section "Votre voix aujourd'hui" affichée dans /cerveau.
// Prose éditoriale calme. Pas de jauge KPI. Pas de dashboard froid.
// Si la mémoire est vide ou trop fragile (< 5 posts), on propose une
// action explicite pour la recalculer manuellement.

import { useEffect, useState } from 'react';
import { buildVoiceFiles } from '@/lib/voice-export';

type StyleFingerprints = {
  sentence_signature:  { label: string; avg_words: number; variance: number };
  paragraph_signature: { label: string; avg_count: number; avg_len: number };
  hook_signature:      { label: string; samples: string[] };
  closing_signature:   { label: string; samples: string[] };
  rhythm_signature:    { label: string; burstiness: number };
};

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
  metaphors?: string[];
  repeated_phrases: string[];
  posts_analyzed: number;
  confidence_score: number;
  voice_summary: string;
  computed_at: string;
  fingerprints?: StyleFingerprints;
};

// V31.1 — Libellés humains pour les fingerprints
const SENTENCE_LABELS: Record<string, string> = {
  court:     'Phrases courtes',
  equilibre: 'Phrases équilibrées',
  long:      'Phrases longues',
  variable:  'Phrases à variance riche',
};
const RHYTHM_LABELS: Record<string, string> = {
  saccade:  'Rythme saccadé',
  soutenu:  'Rythme soutenu',
  fluide:   'Rythme fluide',
  lineaire: 'Rythme linéaire',
};
const HOOK_LABELS: Record<string, string> = {
  scene:     'Ouverture par une scène',
  chiffre:   'Ouverture par un chiffre',
  metaphore: 'Ouverture imagée',
  question:  'Ouverture par une question',
  constat:   'Ouverture par un constat',
  mixte:     'Ouvertures variées',
};
const CLOSING_LABELS: Record<string, string> = {
  question_ouverte: 'Fermeture par une question ouverte',
  lecon_implicite:  'Fermeture par leçon implicite',
  appel_action:     'Fermeture par appel à l\'action',
  phrase_seche:     'Fermeture par phrase sèche',
  mixte:            'Fermetures variées',
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

      {/* V31.1 — Signatures désagrégées : 5 dimensions de votre voix. */}
      {mem.fingerprints && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <FingerprintTile label="Phrases" value={SENTENCE_LABELS[mem.fingerprints.sentence_signature.label] || mem.fingerprints.sentence_signature.label} sub={`${mem.fingerprints.sentence_signature.avg_words} mots`} />
          <FingerprintTile label="Paragraphes" value={mem.fingerprints.paragraph_signature.label === 'court' ? 'Paragraphes courts' : mem.fingerprints.paragraph_signature.label === 'long' ? 'Paragraphes longs' : 'Paragraphes équilibrés'} sub={`${mem.fingerprints.paragraph_signature.avg_count} en moyenne`} />
          <FingerprintTile label="Hook" value={HOOK_LABELS[mem.fingerprints.hook_signature.label] || mem.fingerprints.hook_signature.label} />
          <FingerprintTile label="Fermeture" value={CLOSING_LABELS[mem.fingerprints.closing_signature.label] || mem.fingerprints.closing_signature.label} />
          <FingerprintTile label="Rythme" value={RHYTHM_LABELS[mem.fingerprints.rhythm_signature.label] || mem.fingerprints.rhythm_signature.label} sub={`burstiness ${mem.fingerprints.rhythm_signature.burstiness}`} />
        </div>
      )}

      {/* V26.1 — Hooks réels : snippets des premières phrases de vos posts
          LinkedIn confirmés. Plus signature que les openings normalisés. */}
      {mem.top_hooks && mem.top_hooks.length > 0 && (
        <div className="border-l-2 border-brand-300 pl-4">
          <p className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-1.5">Vos hooks réels</p>
          <p className="text-2xs text-ink-400 italic mb-2">Issus de vos posts LinkedIn publiés. Les openings que vous avez vraiment écrits.</p>
          <ul className="space-y-1.5">
            {mem.top_hooks.slice(0, 5).map((h, i) => (
              <li key={i} className="text-sm text-ink-800 leading-relaxed font-editorial">« {h} »</li>
            ))}
          </ul>
        </div>
      )}

      {mem.top_openings.length > 0 && (
        <div className="border-l-2 border-ink-200 pl-4">
          <p className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-1.5">Attaques dominantes</p>
          <p className="text-2xs text-ink-400 italic mb-2">Les 4-5 premiers mots qui reviennent le plus. À varier consciemment.</p>
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

      {/* V21.2 — Voice files exportables : two Markdown blocks (about-me + voice)
          que l'utilisateur peut copier dans Notion, dans un repo, ou dans la
          section system prompt d'un autre assistant. Caché par défaut, déplié
          à la demande pour ne pas alourdir la vue. */}
      <VoiceExportBlock mem={mem} />

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

// V31.1 — Tile fingerprint : libellé court + valeur + sub optionnel.
// Toujours discret, jamais bruyant. Border ink-100, hover ink-200.
function FingerprintTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-ink-100 rounded-lg p-3 transition hover:border-ink-200">
      <p className="text-2xs uppercase tracking-wider font-semibold text-ink-400">{label}</p>
      <p className="mt-1 text-xs text-ink-800 leading-snug">{value}</p>
      {sub && <p className="mt-0.5 text-2xs text-ink-400 italic">{sub}</p>}
    </div>
  );
}

// V21.2 — Bloc déplié à la demande : génère about-me.md + voice.md à partir
// de la mémoire stylistique. Boutons "Copier" sur chaque fichier. Pas de
// download direct, pas de save serveur : Cadence laisse l'utilisateur
// porter ces fichiers ailleurs (Notion, GitHub, autre assistant).
function VoiceExportBlock({ mem }: { mem: StyleMemory }) {
  const [open, setOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const files = buildVoiceFiles(mem as any);

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch { /* clipboard blocked, silent */ }
  }

  return (
    <div className="pt-3 border-t border-ink-100">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-2xs uppercase tracking-wider font-semibold text-ink-500 hover:text-ink-900 transition"
      >
        {open ? '— Masquer l\'export voix' : '+ Exporter ma voix en Markdown'}
      </button>
      {open && (
        <div className="mt-3 space-y-4">
          <p className="text-xs text-ink-500 leading-relaxed max-w-2xl">
            Deux blocs Markdown générés à partir de votre signature actuelle. Copiez-les dans Notion, dans un repo, ou dans le system prompt d&apos;un autre assistant. Cadence reste la source de vérité : tout se recalcule à chaque publication confirmée.
          </p>
          {([
            { key: 'aboutMe', label: 'about-me.md', body: files.aboutMe },
            { key: 'voice',   label: 'voice.md',    body: files.voice },
          ]).map(f => (
            <div key={f.key} className="border-l-2 border-ink-200 pl-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-2xs uppercase tracking-wider font-semibold text-ink-500">{f.label}</p>
                <button
                  type="button"
                  onClick={() => copy(f.key, f.body)}
                  className="text-2xs text-brand-700 hover:text-brand-900 transition underline decoration-dotted underline-offset-2"
                >
                  {copiedKey === f.key ? 'Copié' : 'Copier'}
                </button>
              </div>
              <pre className="text-2xs text-ink-700 leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto bg-ink-50 rounded-md p-3 font-mono">
                {f.body}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
