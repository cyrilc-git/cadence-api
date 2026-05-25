// V9.2 §1 — Page "Mémoire éditoriale" : rend visible ce que Cadence sait, calmement, en prose.
// Pas un dashboard KPI. Une lecture de ce que Cadence a digéré.

import Link from 'next/link';
import { computeBrainState, formatDateFr } from '@/lib/brain';
import { notionStatus } from '@/lib/notion';
import { connectorsStatus } from '@/lib/db';
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

function ConfidenceRing({ overall, memory, linkedin, embeddings }: { overall: number; memory: number; linkedin: number; embeddings: number }) {
  const pct = Math.max(0, Math.min(100, overall));
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;
  const color = pct >= 70 ? '#059669' : pct >= 40 ? '#0A66C2' : '#B45309';
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-24 h-24 shrink-0">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={radius} fill="none" stroke="#E2E8F0" strokeWidth="6" />
          <circle cx="48" cy="48" r={radius} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${dash} ${circumference}`} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums" style={{ color }}>{pct}</span>
          <span className="text-2xs uppercase tracking-wider text-ink-500">global</span>
        </div>
      </div>
      <ul className="text-xs space-y-1 text-ink-600">
        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-ink-700" /> Mémoire <span className="tabular-nums text-ink-900 font-medium">{memory}</span></li>
        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#0A66C2]" /> LinkedIn <span className="tabular-nums text-ink-900 font-medium">{linkedin}</span></li>
        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Embeddings <span className="tabular-nums text-ink-900 font-medium">{embeddings}</span></li>
      </ul>
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
  const brain = await computeBrainState(unknownSources);

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

  return (
    <div className="space-y-12 max-w-3xl mx-auto">
      {/* === HEADER === */}
      <header>
        <p className="text-2xs uppercase tracking-wider font-semibold text-ink-400">Mémoire</p>
        <h1 className="mt-1 text-3xl font-semibold text-ink-900 tracking-tight">Mémoire éditoriale</h1>
        <p className="mt-2 text-sm text-ink-500 leading-relaxed">
          Ce que Cadence a digéré, ce qu&apos;il observe, ce qui lui manque encore.
        </p>
      </header>

      {/* === V10.2 — Score de confiance global + apprentissages === */}
      {brain.totalIndexed > 0 && (
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 items-start">
            <ConfidenceRing
              overall={brain.confidenceScore.overall}
              memory={brain.confidenceScore.memory}
              linkedin={brain.confidenceScore.linkedin}
              embeddings={brain.confidenceScore.embeddings}
            />
            <div className="space-y-2 pt-1">
              <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500">Confiance de Cadence</h2>
              <p className="text-sm text-ink-700 leading-relaxed">
                {brain.confidenceScore.overall >= 70
                  ? 'Cadence comprend votre ligne éditoriale. Les patterns détectés sont fiables.'
                  : brain.confidenceScore.overall >= 40
                  ? 'Cadence se construit une image cohérente, mais certaines zones restent floues.'
                  : 'Cadence connaît peu votre historique. Un import LinkedIn complet aiderait à passer un cap.'}
              </p>
              {brain.weeklyLearnings.length > 0 && (
                <div className="pt-2">
                  <p className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-1">Cette semaine</p>
                  <ul className="space-y-1.5">
                    {brain.weeklyLearnings.slice(0, 3).map((l, i) => (
                      <li key={i} className="text-sm text-ink-800 leading-relaxed flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2 shrink-0" aria-hidden />
                        <span>{l.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

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
              <Link href="/suggestions" className="text-brand-700 hover:text-brand-900 transition">Voir suggestions →</Link>
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
  );
}
