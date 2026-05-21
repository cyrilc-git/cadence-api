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

  const couvertureSummary = brain.totalIndexed > 0
    ? `${brain.totalIndexed} post${brain.totalIndexed > 1 ? 's' : ''} en mémoire. ${brain.publishedKnown} publié${brain.publishedKnown > 1 ? 's' : ''}, ${brain.draftKnown} brouillon${brain.draftKnown > 1 ? 's' : ''} connu${brain.draftKnown > 1 ? 's' : ''}.`
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
