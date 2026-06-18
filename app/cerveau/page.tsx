// V9.2 §1 — Page "Mémoire éditoriale" : rend visible ce que Cadence sait, calmement, en prose.
// Pas un dashboard KPI. Une lecture de ce que Cadence a digéré.

import Link from 'next/link';
import { computeBrainState, formatDateFr } from '@/lib/brain';
import StyleMemoryView from '@/components/StyleMemoryView';
import { fetchEditorialRhythm, type RhythmInsight } from '@/lib/editorial-rhythm';
import { notionStatus } from '@/lib/notion';
import { connectorsStatus, inspirationsList } from '@/lib/db';
import InspirationsClient from '@/app/inspirations/client';
import { getActiveToken } from '@/lib/supabase';
import { validateToken } from '@/lib/linkedin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SourceHint = { kind: string; label: string };

const SIGNAL_SOURCES: SourceHint[] = [
  { kind: 'github', label: 'GitHub' },
  { kind: 'gmail', label: 'Gmail' },
  { kind: 'gdrive', label: 'Google Drive' },
  { kind: 'onedrive', label: 'OneDrive' },
];

async function detectUnknownSources(): Promise<SourceHint[]> {
  const [linkedinToken, notion, connectors] = await Promise.all([
    getActiveToken().catch(() => null),
    notionStatus().catch(() => ({ ok: false })),
    connectorsStatus().catch(() => [] as any[]),
  ]);
  const unknown: SourceHint[] = [];
  let linkedinOk = false;
  if (linkedinToken) {
    try { const v = await validateToken(linkedinToken.access_token); linkedinOk = !!v.ok; } catch { linkedinOk = false; }
  }
  if (!linkedinOk) unknown.push({ kind: 'linkedin', label: 'archive LinkedIn' });
  if (!notion.ok) unknown.push({ kind: 'notion', label: 'Notion' });
  const connKinds = new Set((connectors as any[]).filter(c => c.status === 'connected').map(c => c.kind));
  for (const s of SIGNAL_SOURCES) {
    if (!connKinds.has(s.kind)) unknown.push(s);
  }
  return unknown;
}

function Timeline({ points }: { points: Array<{ yearMonth: string; label: string; count: number }> }) {
  const max = Math.max(1, ...points.map(p => p.count));
  return (
    <div className="flex items-end gap-1.5 h-20">
      {points.map(p => {
        const h = Math.max(2, Math.round((p.count / max) * 72));
        const isEmpty = p.count === 0;
        return (
          <div key={p.yearMonth} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div className="flex-1 flex items-end w-full">
              <div
                className={`w-full rounded-sm transition-colors ${isEmpty ? 'bg-ink-100' : 'bg-brand-400 hover:bg-brand-500'}`}
                style={{ height: `${h}px` }}
                title={`${p.label} : ${p.count} post${p.count > 1 ? 's' : ''}`}
              />
            </div>
            <span className="text-[10px] text-ink-400 tabular-nums truncate w-full text-center">{p.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function CoverageStat({ label, value, hint, tone }: { label: string; value: number; hint: string; tone: 'linkedin' | 'notion' | 'success' | 'amber' | 'muted' }) {
  const valueColor = {
    linkedin: 'text-[#0A66C2]',
    notion: 'text-ink-900',
    success: 'text-emerald-700',
    amber: 'text-amber-700',
    muted: 'text-ink-400',
  }[tone];
  const dotColor = {
    linkedin: 'bg-[#0A66C2]',
    notion: 'bg-ink-700',
    success: 'bg-emerald-500',
    amber: 'bg-amber-500',
    muted: 'bg-ink-300',
  }[tone];
  return (
    <div className="rounded-xl border border-ink-100 p-3">
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} aria-hidden />
        <span className="text-2xs uppercase tracking-wider font-semibold text-ink-500">{label}</span>
      </div>
      <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${valueColor}`}>{value.toLocaleString('fr-FR')}</div>
      <div className="mt-0.5 text-2xs text-ink-500">{hint}</div>
    </div>
  );
}

function pilierTone(p: { count: number; daysSinceLast: number | null }) {
  if (p.count === 0) return { dot: 'bg-ink-300', text: 'aucun post' };
  if (p.daysSinceLast === null) return { dot: 'bg-ink-300', text: 'date inconnue' };
  if (p.daysSinceLast <= 7) return { dot: 'bg-emerald-500', text: `il y a ${p.daysSinceLast} j` };
  if (p.daysSinceLast <= 14) return { dot: 'bg-emerald-400', text: `il y a ${p.daysSinceLast} j` };
  if (p.daysSinceLast <= 30) return { dot: 'bg-amber-500', text: `il y a ${p.daysSinceLast} j` };
  return { dot: 'bg-ink-400', text: `il y a ${p.daysSinceLast} j` };
}

export default async function BrainPage() {
  const unknownSources = await detectUnknownSources();
  const [brain, rhythmInsights, inspos] = await Promise.all([
    computeBrainState(unknownSources),
    fetchEditorialRhythm().catch(() => [] as RhythmInsight[]),
    inspirationsList().catch(() => [] as any[]),
  ]);
  const rhythm = rhythmInsights.filter(r => r.kind !== 'low_data');

  // V14.8 — Distinction LinkedIn-confirmé vs Notion-known.
  // confirmedCount = publications LinkedIn vérifiées (URL ou import ZIP)
  // publishedKnown = posts marqués "published" dans Notion (peut inclure
  // archives sans URL LinkedIn). On reformule pour ne pas faire passer
  // un statut Notion pour une publication LinkedIn réelle.
  const couvertureSummary = brain.totalIndexed > 0
    ? brain.confirmedCount > 0
      ? `${brain.totalIndexed} post${brain.totalIndexed > 1 ? 's' : ''} en mémoire. ${brain.confirmedCount} publication${brain.confirmedCount > 1 ? 's' : ''} LinkedIn vérifiée${brain.confirmedCount > 1 ? 's' : ''}, ${brain.draftKnown} brouillon${brain.draftKnown > 1 ? 's' : ''} connu${brain.draftKnown > 1 ? 's' : ''}.`
      : `${brain.totalIndexed} post${brain.totalIndexed > 1 ? 's' : ''} en mémoire, mais aucune publication LinkedIn certifiée. ${brain.publishedKnown > 0 ? `${brain.publishedKnown} marqué${brain.publishedKnown > 1 ? 's' : ''} publié${brain.publishedKnown > 1 ? 's' : ''} dans Notion sans URL LinkedIn rattachée.` : ''}`
    : 'Aucun post indexé pour l\'instant. Lancez l\'indexation pour activer la mémoire.';

  const dateRange = brain.oldestPostAt && brain.newestPostAt
    ? `Couverture du ${formatDateFr(brain.oldestPostAt)} au ${formatDateFr(brain.newestPostAt)}.`
    : null;

  const lastAnalysis = brain.lastIndexedAt
    ? `Dernière analyse il y a ${Math.max(0, Math.floor((Date.now() - new Date(brain.lastIndexedAt).getTime()) / 86_400_000))} j.`
    : 'Aucune analyse encore enregistrée.';

  // V37.6 — Trois blocs courts au-dessus de la ligne de pliage :
  //   1. Ce que Cadence sait     → counts + période + confiance, 2-3 lignes
  //   2. Ce que Cadence comprend → 2-3 observations max sur le style
  //   3. Ce que Cadence recommande → 1 action principale
  // Le reste est dans <details> "Voir l'analyse complète".

  // Bloc 1 — résumé factuel
  const knowsLine = (() => {
    if (brain.totalIndexed === 0) {
      return 'Aucun post indexé. Importez votre archive LinkedIn pour activer la mémoire.';
    }
    const parts: string[] = [];
    parts.push(`${brain.totalIndexed} post${brain.totalIndexed > 1 ? 's' : ''} en mémoire`);
    if (brain.confirmedCount > 0) {
      parts.push(`${brain.confirmedCount} confirmé${brain.confirmedCount > 1 ? 's' : ''} sur LinkedIn`);
    }
    return parts.join(' · ') + '.';
  })();
  const knowsPeriod = (brain.oldestPostAt && brain.newestPostAt)
    ? `Couverture ${formatDateFr(brain.oldestPostAt)} → ${formatDateFr(brain.newestPostAt)}.`
    : null;

  // Bloc 2 — 2-3 observations style
  // Priorité : 1) voice_summary issu de StyleMemory (côté client via StyleMemoryView)
  //           Pour le SSR, on prend les editorial drifts les plus saillants
  //           OU 1-2 formatTrends.
  const styleObservations: string[] = [];
  if (brain.editorialDrifts && brain.editorialDrifts.length > 0) {
    for (const d of brain.editorialDrifts.slice(0, 2)) styleObservations.push(d.message);
  }
  if (styleObservations.length < 2 && brain.formatTrends && brain.formatTrends.length > 0) {
    for (const t of brain.formatTrends.slice(0, 2 - styleObservations.length)) {
      styleObservations.push(t.message);
    }
  }

  // V43 — Mappe une catégorie de pilier vers son libellé Cadence complet
  // (utilisé pour pré-remplir /posts/new?pilier=…).
  const PILIER_BY_CAT: Record<string, string> = {
    cas: 'Lundi · Cas client',
    pedagogie: 'Mardi · Pédagogie sans jargon',
    produit: 'Mercredi · Produit / démo / nouveauté / release note',
    opinion: 'Jeudi · Opinion / hot take mesuré',
    build: 'Vendredi · Build in public',
  };
  // V43 — Traduit un insight de rythme en action concrète (label + href).
  function rhythmCta(r: { kind: string; data?: any }): { label: string; href: string } {
    const cat = r.data?.cat as string | undefined;
    const pilierParam = cat && PILIER_BY_CAT[cat] ? `?pilier=${encodeURIComponent(PILIER_BY_CAT[cat])}` : '';
    switch (r.kind) {
      case 'pilier_gap': {
        const catLabels: Record<string, string> = { cas: 'un cas client', pedagogie: 'une pédagogie', produit: 'un post produit', opinion: 'une opinion', build: 'un build in public' };
        return { label: `Écrire ${cat && catLabels[cat] ? catLabels[cat] : 'un post'}`, href: `/posts/new${pilierParam}` };
      }
      case 'no_concrete_scene':
        return { label: 'Raconter une scène', href: `/posts/new?pilier=${encodeURIComponent('Lundi · Cas client')}` };
      case 'no_proof':
        return { label: 'Écrire un post chiffré', href: '/posts/new' };
      case 'fatigue':
      case 'overconcentration':
        return { label: 'Varier le pilier', href: '/posts/new' };
      case 'narrative_gap':
        return { label: 'Varier l\'angle', href: '/posts/new' };
      default:
        return { label: 'Écrire maintenant', href: '/posts/new' };
    }
  }

  // Bloc 3 — 1 action recommandée (priorité Opportunité du moment, puis rhythm gap)
  const rhythmActionable = rhythm.find(r => r.severity === 'firm') || rhythm.find(r => r.kind === 'pilier_gap' || r.kind === 'no_concrete_scene' || r.kind === 'no_proof');
  const recommendation = brain.topInsight && brain.topInsight.kind !== 'low_data'
    ? { message: brain.topInsight.message, cta_label: brain.topInsight.cta_label, cta_href: brain.topInsight.cta_href }
    : rhythmActionable
      ? { message: rhythmActionable.message, ...(() => { const c = rhythmCta(rhythmActionable); return { cta_label: c.label, cta_href: c.href }; })() }
      : null;

  // V43 — CTA contextuel pour le Bloc 1 (Ce que Cadence sait).
  const knowsCta = brain.confirmedCount === 0
    ? { label: 'Importer mes posts LinkedIn', href: '/sources/linkedin' }
    : brain.totalIndexed > 0
      ? { label: 'Voir dans le calendrier', href: '/calendar?source=linkedin' }
      : { label: 'Importer mes posts LinkedIn', href: '/sources/linkedin' };

  // V43 — CTA contextuel pour le Bloc 2 (style). Si peu alimenté → import.
  const styleWeak = brain.confidenceScore.overall < 40;

  return (
    <div className="space-y-10 max-w-3xl mx-auto">
      {/* === HEADER === */}
      <header>
        <p className="text-2xs uppercase tracking-wider font-semibold text-ink-400">Mémoire</p>
        <h1 className="mt-1 text-3xl font-semibold text-ink-900 tracking-tight">Mémoire éditoriale</h1>
        <p className="mt-2 text-sm text-ink-500 leading-relaxed">
          Ce que Cadence a digéré, ce qu&apos;il observe, ce qui lui manque encore.
        </p>
      </header>

      {/* === V37.6 — TROIS BLOCS COURTS AU PREMIER ÉCRAN === */}

      {/* Bloc 1 — Ce que Cadence sait + 1 action */}
      <section>
        <p className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-2">Ce que Cadence sait</p>
        <p className="text-base text-ink-900 leading-relaxed">{knowsLine}</p>
        {knowsPeriod && <p className="mt-1 text-sm text-ink-500 leading-relaxed">{knowsPeriod}</p>}
        <div className="mt-3">
          <Link href={knowsCta.href} className={brain.confirmedCount === 0 ? 'btn-primary text-sm' : 'text-sm text-brand-700 hover:text-brand-900 font-medium transition'}>
            {knowsCta.label} →
          </Link>
        </div>
      </section>

      {/* Bloc 2 — Ce que Cadence comprend de votre style + 1 action */}
      <section>
        <p className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-2">Ce que Cadence comprend de votre style</p>
        {styleObservations.length > 0 ? (
          <ul className="space-y-2">
            {styleObservations.slice(0, 3).map((m, i) => (
              <li key={i} className="text-base text-ink-800 leading-relaxed flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2.5 shrink-0" aria-hidden />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-base text-ink-800 leading-relaxed">
            {styleWeak
              ? 'Votre style LinkedIn est encore peu alimenté. Plus vous importez de posts, plus Cadence écrit comme vous.'
              : 'Cadence apprend votre voix à partir de vos posts publiés. Détails dans l\'analyse complète.'}
          </p>
        )}
        {!styleWeak && (
          <div className="mt-3">
            <Link href="/posts/new" className="text-sm text-brand-700 hover:text-brand-900 font-medium transition">Écrire dans ma voix →</Link>
          </div>
        )}
      </section>

      {/* Bloc 3 — Ce que Cadence recommande maintenant */}
      {recommendation && (
        <section>
          <p className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-2">Ce que Cadence recommande maintenant</p>
          <p className="text-base text-ink-900 leading-relaxed">{recommendation.message}</p>
          {recommendation.cta_label && recommendation.cta_href && (
            <div className="mt-3">
              <Link href={recommendation.cta_href} className="btn-primary text-sm">
                {recommendation.cta_label} →
              </Link>
            </div>
          )}
        </section>
      )}

      {/* === V56 — Inspirations : profils LinkedIn qui nourrissent le style ===
          Ramenees ici (la nav a 4 onglets ne les montrait plus). Selection des
          dimensions par profil : ton, structure, sujets, visuel. */}
      <section id="inspirations" className="scroll-mt-20 pt-2">
        <InspirationsClient initial={inspos} embedded />
      </section>

      {/* === V37.6 — ANALYSE COMPLÈTE, masquée derrière un toggle === */}
      <details className="group/full">
        <summary className="select-none cursor-pointer inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900 transition">
          <span className="w-1.5 h-1.5 rounded-full bg-ink-300 group-open/full:bg-brand-500" aria-hidden />
          <span className="group-open/full:hidden">Voir l&apos;analyse complète</span>
          <span className="hidden group-open/full:inline">Replier l&apos;analyse complète</span>
        </summary>
        <div className="mt-8 space-y-12 pt-6 border-t border-ink-100">


      {/* === ACTION HÉROÏQUE (si vide) === */}
      {brain.totalIndexed < 10 && (
        <section className="border-l-2 border-brand-300 pl-4">
          <p className="text-sm text-ink-800 leading-relaxed">
            La mémoire est encore légère. Importez votre historique LinkedIn pour donner à Cadence un terrain d&apos;analyse.
          </p>
          <div className="mt-3">
            <Link href="/sources/linkedin" className="btn-primary text-xs">Importer mes posts →</Link>
          </div>
        </section>
      )}

      {/* === V10.2 — Timeline éditoriale 12 mois === */}
      {brain.timeline.some(p => p.count > 0) && (
        <section>
          <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-3">Timeline éditoriale</h2>
          <Timeline points={brain.timeline} />
          <p className="mt-2 text-xs text-ink-500 leading-relaxed">
            Posts indexés mois par mois sur les 12 derniers mois.
            {(() => {
              const lastSix = brain.timeline.slice(-6).reduce((s, p) => s + p.count, 0);
              const prevSix = brain.timeline.slice(0, 6).reduce((s, p) => s + p.count, 0);
              if (prevSix === 0 || lastSix === 0) return null;
              const delta = Math.round((lastSix / prevSix - 1) * 100);
              if (Math.abs(delta) < 15) return ' Rythme stable sur les six derniers mois.';
              return delta > 0
                ? ` Volume en hausse de ${delta}% sur les six derniers mois vs les six précédents.`
                : ` Volume en baisse de ${Math.abs(delta)}% sur les six derniers mois vs les six précédents.`;
            })()}
          </p>
        </section>
      )}

      {/* === SECTION 0 : Couverture des sources === V9.5 */}
      {brain.totalIndexed > 0 && (
        <section>
          <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-3">Couverture</h2>
          <div className="grid grid-cols-3 gap-4">
            <CoverageStat
              label="LinkedIn"
              value={brain.coverage.linkedinCount}
              hint={brain.coverage.linkedinCount > 0 ? 'importé' : 'à importer'}
              tone={brain.coverage.linkedinCount > 0 ? 'linkedin' : 'muted'}
            />
            <CoverageStat
              label="Notion"
              value={brain.coverage.notionCount}
              hint={brain.coverage.notionCount > 0 ? 'lu' : 'silencieux'}
              tone={brain.coverage.notionCount > 0 ? 'notion' : 'muted'}
            />
            <CoverageStat
              label="Embeddings"
              value={brain.coverage.embeddingsTotal}
              hint={`${brain.coverage.confirmedPct}% confirmés`}
              tone={brain.coverage.confirmedPct >= 50 ? 'success' : brain.coverage.confirmedPct >= 20 ? 'amber' : 'muted'}
            />
          </div>
        </section>
      )}

      {/* === SECTION 1 : Ce que Cadence sait === */}
      <section>
        <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-3">Ce que Cadence sait déjà</h2>
        <p className="text-sm text-ink-800 leading-relaxed">{couvertureSummary}</p>
        {dateRange && <p className="mt-1 text-sm text-ink-600 leading-relaxed">{dateRange}</p>}
        <p className="mt-1 text-xs text-ink-500">{lastAnalysis}</p>
        <p className="mt-3 text-xs text-ink-500 italic leading-relaxed">
          Cadence distingue les publications confirmées sur LinkedIn des contenus retrouvés dans Notion.
        </p>

        {/* Avec certitude (LinkedIn confirmé) */}
        {brain.confirmedCount > 0 && (
          <div className="mt-5">
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-2xs uppercase tracking-wider font-semibold text-[#0A66C2]">Avec certitude</h3>
              <span className="text-2xs text-ink-500 tabular-nums">{brain.confirmedCount.toLocaleString('fr-FR')} post{brain.confirmedCount > 1 ? 's' : ''}</span>
            </div>
            <p className="text-xs text-ink-600 leading-relaxed mb-2">Imports LinkedIn ZIP et publications avec URL LinkedIn vérifiée.</p>
            <ul className="divide-y divide-ink-100 border-t border-b border-ink-100">
              {brain.confirmedSources.map(s => (
                <li key={s.source} className="flex items-center justify-between py-2.5">
                  <span className="flex items-center gap-2 text-sm text-ink-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0A66C2]" aria-hidden />
                    {s.label}
                  </span>
                  <span className="text-sm tabular-nums text-ink-600">{s.count.toLocaleString('fr-FR')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Déduit depuis Notion */}
        {brain.inferredCount > 0 && (
          <div className="mt-5">
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-2xs uppercase tracking-wider font-semibold text-amber-700">Déduit depuis vos brouillons</h3>
              <span className="text-2xs text-ink-500 tabular-nums">{brain.inferredCount.toLocaleString('fr-FR')} post{brain.inferredCount > 1 ? 's' : ''}</span>
            </div>
            <p className="text-xs text-ink-600 leading-relaxed mb-2">Brouillons Notion, archives non certifiées et idées récurrentes. Pas de garantie de publication réelle sur LinkedIn.</p>
            <ul className="divide-y divide-ink-100 border-t border-b border-ink-100">
              {brain.inferredSources.map(s => (
                <li key={s.source} className="flex items-center justify-between py-2.5">
                  <span className="flex items-center gap-2 text-sm text-ink-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden />
                    {s.label}
                  </span>
                  <span className="text-sm tabular-nums text-ink-600">{s.count.toLocaleString('fr-FR')}</span>
                </li>
              ))}
            </ul>
            {brain.confirmedCount === 0 && (
              <p className="mt-3 text-xs text-amber-700 leading-relaxed">
                Aucun import LinkedIn n&apos;a encore été fait. <Link href="/sources/linkedin" className="underline hover:text-amber-900">Importer mon archive LinkedIn</Link> pour passer en certitude.
              </p>
            )}
          </div>
        )}
      </section>

      {/* === SECTION 2 : Piliers couverts === */}
      {brain.piliers.length > 0 && (
        <section>
          <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-3">Piliers couverts</h2>
          <p className="text-sm text-ink-600 leading-relaxed mb-3">
            {brain.pilierActiveCount}/{brain.piliers.length} piliers actifs sur les 14 derniers jours.
          </p>
          <ul className="divide-y divide-ink-100 border-t border-b border-ink-100">
            {brain.piliers.map(p => {
              const tone = pilierTone(p);
              const label = p.pilier.replace(' · ', ' ');
              return (
                <li key={p.pilier} className="flex items-center gap-3 py-2.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${tone.dot} shrink-0`} aria-hidden />
                  <span className="text-sm text-ink-800 flex-1 truncate">{label}</span>
                  <span className="text-xs text-ink-500 tabular-nums shrink-0">
                    {p.count} post{p.count > 1 ? 's' : ''} · {tone.text}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* === SECTION 3 : Sujets dominants === */}
      {brain.topicsDominant.length > 0 && (
        <section>
          <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-3">Sujets dominants</h2>
          <p className="text-sm text-ink-600 leading-relaxed mb-3">Ce dont vous parlez le plus sur les 60 derniers jours.</p>
          <ul className="space-y-2">
            {brain.topicsDominant.map(t => (
              <li key={t.topic} className="flex items-baseline gap-3">
                <span className="text-sm font-medium text-ink-900 shrink-0">{t.topic}</span>
                <span className="text-sm text-ink-600 flex-1 leading-relaxed">
                  {t.count60d} post{t.count60d > 1 ? 's' : ''} en 60 jours
                  {t.lastDays !== null && `, dernier il y a ${t.lastDays} j`}.
                </span>
              </li>
            ))}
          </ul>
          {brain.saturationNote && (
            <p className="mt-4 text-xs text-ink-500 italic leading-relaxed">{brain.saturationNote}</p>
          )}
        </section>
      )}

      {/* === SECTION 4 : Sujets oubliés === */}
      {(brain.topicsForgotten.length > 0 || brain.topicsNeverPublished.length > 0) && (
        <section>
          <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-3">Sujets oubliés</h2>
          {brain.topicsForgotten.length > 0 && (
            <ul className="space-y-2">
              {brain.topicsForgotten.map(t => (
                <li key={t.topic} className="flex items-baseline gap-3 group">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 self-center" aria-hidden />
                  <span className="text-sm font-medium text-ink-900 shrink-0">{t.topic}</span>
                  <span className="text-sm text-ink-600 flex-1 leading-relaxed">
                    pas évoqué depuis {t.lastDays} j.
                  </span>
                  <Link
                    href={`/posts/new?brief=${encodeURIComponent(`Reprendre le sujet ${t.topic}`)}`}
                    className="text-xs text-brand-700 hover:text-brand-900 transition shrink-0 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    Écrire →
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {brain.topicsNeverPublished.length > 0 && (
            <p className="mt-4 text-sm text-ink-600 leading-relaxed">
              Jamais publié : <span className="text-ink-800">{brain.topicsNeverPublished.join(', ')}</span>.{' '}
              <Link href={`/posts/new?brief=${encodeURIComponent('Reprendre un sujet jamais publié : ' + brain.topicsNeverPublished.join(', '))}`} className="text-brand-700 hover:text-brand-900 transition">Écrire →</Link>
            </p>
          )}
        </section>
      )}

      {/* === SECTION 5 : Posts à recycler === */}
      {brain.recyclables.length > 0 && (
        <section>
          <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-3">Posts à recycler</h2>
          <p className="text-sm text-ink-600 leading-relaxed mb-3">
            Publiés depuis plus de 90 jours, candidats à un nouvel angle.
          </p>
          <ul className="divide-y divide-ink-100 border-t border-b border-ink-100">
            {brain.recyclables.map(r => (
              <li key={r.id} className="flex items-center gap-3 py-2.5 group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink-800 truncate">{r.title}</p>
                  <p className="text-xs text-ink-500 mt-0.5">
                    {r.pilier ? `${r.pilier.replace(' · ', ' ')} · ` : ''}publié il y a {r.daysSince} j
                  </p>
                </div>
                <Link
                  href={`/posts/new?brief=${encodeURIComponent(`Recycler sous nouvel angle : ${r.title}`)}`}
                  className="text-xs text-brand-700 hover:text-brand-900 transition shrink-0 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  Recycler →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* === SECTION 6 : Opportunité du moment === */}
      {brain.topInsight && brain.topInsight.kind !== 'low_data' && (
        <section>
          <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-3">Opportunité de la semaine</h2>
          <div className="border-l-2 border-brand-300 pl-4">
            <p className="text-sm text-ink-800 leading-relaxed">{brain.topInsight.message}</p>
            {brain.topInsight.cta_label && brain.topInsight.cta_href && (
              <div className="mt-3">
                <Link href={brain.topInsight.cta_href} className="text-xs text-brand-700 hover:text-brand-900 font-medium transition">
                  {brain.topInsight.cta_label} →
                </Link>
              </div>
            )}
          </div>
          {brain.otherInsights.length > 0 && (
            <details className="mt-4 text-xs text-ink-500 hover:text-ink-700 cursor-pointer">
              <summary className="select-none">+{brain.otherInsights.length} autre{brain.otherInsights.length > 1 ? 's' : ''} observation{brain.otherInsights.length > 1 ? 's' : ''}</summary>
              <ul className="mt-2 space-y-1.5 pl-3">
                {brain.otherInsights.map((o, i) => (
                  <li key={i} className="text-sm text-ink-700 leading-relaxed">{o.message}</li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {/* === V11.3 — Évolution de votre ligne éditoriale === */}
      {brain.editorialDrifts && brain.editorialDrifts.length > 0 && (
        <section>
          <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-3">Évolution de votre ligne éditoriale</h2>
          <p className="text-xs text-ink-500 leading-relaxed mb-3">
            Ce que Cadence remarque entre vos 60 derniers jours et les 60 précédents.
          </p>
          <ul className="space-y-2.5">
            {brain.editorialDrifts.map((d, i) => {
              const dotClass = d.severity === 'medium' ? 'bg-amber-500' : 'bg-ink-400';
              return (
                <li key={i} className="flex items-start gap-3">
                  <span className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${dotClass}`} aria-hidden />
                  <p className="text-sm text-ink-800 leading-relaxed">{d.message}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* === V10.6.2 — Formats qui bougent === */}
      {brain.formatTrends && brain.formatTrends.length > 0 && (
        <section>
          <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-3">Formats qui bougent</h2>
          <p className="text-xs text-ink-500 leading-relaxed mb-3">
            Impressions moyennes sur les 30 derniers jours vs les 30 précédents, par pilier.
          </p>
          <ul className="space-y-2.5">
            {brain.formatTrends.map((t, i) => {
              const isUp = t.direction === 'progresse';
              const dotClass = isUp ? 'bg-emerald-500' : 'bg-amber-500';
              const textClass = isUp ? 'text-emerald-700' : 'text-amber-700';
              const arrow = isUp ? '↑' : '↓';
              return (
                <li key={i} className="flex items-start gap-3">
                  <span className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${dotClass}`} aria-hidden />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-ink-900">{t.pilier}</span>
                      <span className={`text-2xs tabular-nums ${textClass}`}>{arrow} {t.deltaPct > 0 ? '+' : ''}{t.deltaPct}%</span>
                    </div>
                    <p className="text-xs text-ink-600 leading-relaxed mt-0.5">{t.message}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* === V34.1 — Rythme éditorial : gaps, fatigue, rotation, scènes absentes.
          Cadence parle comme un directeur éditorial qui regarde le flux. */}
      {rhythm.length > 0 && (
        <section>
          <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-3">Rythme éditorial</h2>
          <p className="text-xs text-ink-500 leading-relaxed mb-3">
            Ce que Cadence remarque sur la cadence et l&apos;équilibre de vos 60 derniers jours.
          </p>
          <ul className="space-y-2.5">
            {rhythm.map((r, i) => {
              const dotClass =
                r.severity === 'firm' ? 'bg-amber-500' :
                r.kind === 'rotation_healthy' ? 'bg-emerald-500' :
                'bg-ink-400';
              return (
                <li key={i} className="flex items-start gap-3">
                  <span className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${dotClass}`} aria-hidden />
                  <p className="text-sm text-ink-800 leading-relaxed">{r.message}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* === V18.3 — Mémoire stylistique personnelle ("Votre voix") ===
          Affiché AVANT la mémoire narrative car c'est la signature globale,
          alors que la narrative est une vue plus fine sur les patterns. */}
      <StyleMemoryView />

      {/* === V16.10 — Mémoire narrative : structures détectées sur les 60j ===
          Cadence partage ce qu'elle voit dans VOS structures narratives :
          quelle structure revient, où ça pèche (sans friction, morale assénée,
          etc.). Ton constat éditorial, jamais reproche. */}
      {brain.narrativeStructures && brain.narrativeStructures.length > 0 && (
        <section>
          <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-3">Mémoire narrative</h2>
          <p className="text-xs text-ink-500 leading-relaxed mb-3">
            Structures détectées dans vos posts des 60 derniers jours. Cadence regarde l&apos;ossature avant le lexique.
          </p>
          <ul className="space-y-2.5">
            {brain.narrativeStructures.map((n, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" aria-hidden />
                <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm text-ink-800">{n.label.charAt(0).toUpperCase() + n.label.slice(1)}</span>
                  <span className="text-2xs text-ink-400 tabular-nums">
                    {n.count} post{n.count > 1 ? 's' : ''}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-2xs text-ink-400 italic leading-relaxed">
            Une structure qui revient n&apos;est pas un défaut. La répétition d&apos;une structure faible (morale assénée, sans friction) signale un terrain de progression.
          </p>
        </section>
      )}

      {/* === SECTION 6bis : Zones d'incertitude V9.5 === */}
      {brain.uncertainties.length > 0 && (
        <section>
          <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-3">Zones d&apos;incertitude</h2>
          <p className="text-xs text-ink-500 leading-relaxed mb-3">Ce que Cadence ne peut pas certifier, dit clairement.</p>
          <ul className="space-y-2.5">
            {brain.uncertainties.map((u, i) => {
              const dotTone = u.severity === 'high' ? 'bg-danger-500' : u.severity === 'medium' ? 'bg-amber-500' : 'bg-ink-400';
              return (
                <li key={i} className="flex items-start gap-3">
                  <span className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${dotTone}`} aria-hidden />
                  <p className="text-sm text-ink-800 leading-relaxed">{u.message}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* === SECTION 7 : Ce qu'il ne sait pas encore === */}
      {brain.unknownSources.length > 0 && (
        <section className="pt-6 border-t border-ink-100">
          <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-3">Ce que Cadence ne sait pas encore</h2>
          <p className="text-sm text-ink-600 leading-relaxed">
            Aucun signal lu depuis : <span className="text-ink-800">{brain.unknownSources.map(s => s.label).join(', ')}</span>.{' '}
            Connecter ces sources élargirait la lecture éditoriale de Cadence.{' '}
            <Link href="/sources" className="text-brand-700 hover:text-brand-900 transition">Gérer les sources →</Link>
          </p>
        </section>
      )}
        </div>
      </details>
    </div>
  );
}
