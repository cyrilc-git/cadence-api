import Link from 'next/link';
import { listNotionPosts, notionStatus } from '@/lib/notion';
import { getActiveToken, publishedThisMonthCount } from '@/lib/supabase';
import { validateToken } from '@/lib/linkedin';
import { suggestionsList } from '@/lib/db';
import CadenceObserved from '@/components/CadenceObserved';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getDashboardData() {
  const [tokenRow, notion, publishedCount, sugg] = await Promise.all([
    getActiveToken().catch(() => null),
    notionStatus(),
    publishedThisMonthCount().catch(() => 0),
    suggestionsList('pending', 10).catch(() => [])
  ]);

  let liStatus: 'connected' | 'expired' | 'none' | 'error' = 'none';
  let liInfo: { name?: string; email?: string; expires_in_days?: number; error?: string } = {};
  if (tokenRow) {
    const exp = new Date(tokenRow.expires_at).getTime();
    const now = Date.now();
    const v = await validateToken(tokenRow.access_token);
    if (!v.ok) { liStatus = 'expired'; liInfo.error = `LinkedIn ${v.status}`; }
    else if (exp <= now) { liStatus = 'expired'; liInfo.error = 'Token expiré'; }
    else { liStatus = 'connected'; liInfo = { name: v.name, email: v.email, expires_in_days: Math.round((exp - now) / 86400000) }; }
  }

  let posts: any[] = [];
  if (notion.ok) { try { posts = await listNotionPosts(150); } catch {} }
  const drafts = posts.filter(p => p.status === 'draft');
  const scheduledFuture = posts.filter(p => p.status === 'scheduled' && !p.late);
  const needsValidation = scheduledFuture.filter(p => !p.validated);
  const validatedAndScheduled = scheduledFuture.filter(p => p.validated);
  const late = posts.filter(p => p.late);
  const next = scheduledFuture.slice().sort((a, b) => (a.scheduled_at || '').localeCompare(b.scheduled_at || ''))[0];
  const recentPublished = posts.filter(p => p.status === 'published').slice(0, 3);
  const topSuggestion = sugg[0] || null;
  const otherSuggestions = sugg.slice(1, 4);

  // Compute week strip : 7 days starting from today
  const weekDays = [];
  const today = new Date(); today.setHours(0,0,0,0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const postsOfDay = posts.filter(p => p.scheduled_at && p.scheduled_at.slice(0, 10) === key);
    weekDays.push({ date: d, key, posts: postsOfDay });
  }

  return { liStatus, liInfo, notion, drafts, needsValidation, validatedAndScheduled, late, next, publishedCount, topSuggestion, otherSuggestions, recentPublished, weekDays };
}

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function pilierTone(pilier?: string) {
  if (!pilier) return 'bg-ink-300';
  const day = pilier.split(/[\s·]/)[0];
  return { 'Lundi':'bg-blue-500','Mardi':'bg-emerald-500','Mercredi':'bg-violet-500','Jeudi':'bg-amber-500','Vendredi':'bg-pink-500' }[day] || 'bg-ink-400';
}

export default async function HomePage() {
  const { liStatus, liInfo, notion, drafts, needsValidation, validatedAndScheduled, late, next, publishedCount, topSuggestion, otherSuggestions, recentPublished, weekDays } = await getDashboardData();
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <div className="space-y-6">
      <header className="relative">
        <div className="absolute -top-6 -left-6 w-40 h-40 bg-brand-100/40 rounded-full blur-3xl pointer-events-none -z-10" aria-hidden />
        <p className="text-xs font-medium text-ink-500 uppercase tracking-wider">{today}</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink-900 tracking-tight">Bonjour Cyril</h1>
      </header>

      {/* === ALERTE HÉROS si nécessaire === */}
      {late.length > 0 && (
        <section className="card p-5 border-danger-100 bg-gradient-to-br from-danger-50/40 to-white animate-slide-up">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-danger-50 flex items-center justify-center text-danger-700 text-lg shrink-0">⚠</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-danger-700">
                {late.length} {late.length > 1 ? 'posts sont en retard' : 'post est en retard'}
              </div>
              <p className="mt-1 text-xs text-ink-600">
                Date de publication passée, mais pas publiés. Choisissez de recycler, reprogrammer, ou archiver.
              </p>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <Link href="/posts?status=late" className="btn-primary text-xs">Trier les {late.length} posts →</Link>
                <Link href="/posts?status=late&action=recycle" className="btn-secondary text-xs">Recycler en lot</Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* === SUGGESTION HÉROS === */}
      {topSuggestion ? (
        <section className="card p-5 border-brand-100 bg-gradient-to-br from-brand-50/40 to-white animate-fade-in">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center text-brand-700 text-lg shrink-0">✨</div>
            <div className="flex-1 min-w-0">
              <div className="text-2xs uppercase tracking-wider font-semibold text-brand-700">Cadence vous propose aujourd'hui</div>
              <h2 className="mt-1 text-lg font-semibold text-ink-900 leading-snug">{topSuggestion.title}</h2>
              {topSuggestion.hook && topSuggestion.hook !== topSuggestion.title && (
                <p className="mt-2 text-sm text-ink-700 italic border-l-2 border-brand-300 pl-3">« {topSuggestion.hook} »</p>
              )}
              {topSuggestion.why && (
                <p className="mt-2 text-xs text-ink-500"><span className="font-medium text-ink-600">Pourquoi : </span>{topSuggestion.why}</p>
              )}
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <Link href={`/posts/new?suggest=${topSuggestion.id}&pilier=${encodeURIComponent(topSuggestion.pilier || '')}&hook=${encodeURIComponent(topSuggestion.hook || '')}&brief=${encodeURIComponent(topSuggestion.title)}`} className="btn-primary">
                  Écrire ce post →
                </Link>
                {otherSuggestions.length > 0 && (
                  <Link href="/suggestions" className="btn-ghost text-xs">
                    Voir {otherSuggestions.length} autre{otherSuggestions.length > 1 ? 's' : ''} idée{otherSuggestions.length > 1 ? 's' : ''}
                  </Link>
                )}
                {topSuggestion.score != null && (
                  <span className="ml-auto text-2xs text-ink-400 tabular-nums">Score {topSuggestion.score}/100</span>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="card p-6 text-center">
          <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-2 text-brand-500">✨</div>
          <p className="text-sm font-semibold text-ink-900">Pas de suggestion fraîche</p>
          <p className="mt-1 text-xs text-ink-500">Lancez le Radar pour scanner vos sources et générer des idées.</p>
          <Link href="/suggestions" className="btn-primary mt-3 inline-flex">Lancer le Radar →</Link>
        </section>
      )}

      {/* === CADENCE A REMARQUÉ === V8.9 */}
      <CadenceObserved />

      {/* === SEMAINE EN UN COUP D'ŒIL === */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-2xs uppercase tracking-wider font-semibold text-ink-500">Vos 7 prochains jours</h3>
          <Link href="/calendar" className="text-xs text-brand-700 hover:text-brand-800 font-medium">Calendrier complet →</Link>
        </div>
        <div className="card p-3 grid grid-cols-7 gap-1.5">
          {weekDays.map((d, i) => {
            const isToday = i === 0;
            const dayLabel = DAY_LABELS[d.date.getDay()];
            const dayNum = d.date.getDate();
            return (
              <Link key={d.key} href={`/calendar?d=${d.key}`} className={`rounded-lg p-2 transition border ${isToday ? 'border-brand-300 bg-brand-50/30' : 'border-transparent hover:border-ink-200 hover:bg-ink-50/50'}`}>
                <div className={`text-2xs font-semibold uppercase ${isToday ? 'text-brand-700' : 'text-ink-500'}`}>{dayLabel}</div>
                <div className={`text-lg font-semibold tabular-nums leading-tight ${isToday ? 'text-brand-700' : 'text-ink-900'}`}>{dayNum}</div>
                <div className="mt-1.5 flex items-center gap-0.5 flex-wrap min-h-[10px]">
                  {d.posts.slice(0, 4).map((p: any) => (
                    <span key={p.id} className={`block w-1.5 h-1.5 rounded-full ${pilierTone(p.pilier)}`} title={p.title} />
                  ))}
                  {d.posts.length > 4 && <span className="text-2xs text-ink-400">+{d.posts.length - 4}</span>}
                </div>
              </Link>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-ink-500 flex items-center gap-4">
          {validatedAndScheduled.length > 0 && <span><span className="dot bg-brand-500" /> {validatedAndScheduled.length} programmé{validatedAndScheduled.length > 1 ? 's' : ''}</span>}
          {needsValidation.length > 0 && <Link href="/posts?status=needs_validation" className="text-warn-700 hover:underline"><span className="dot bg-warn-500" /> {needsValidation.length} à valider</Link>}
          {drafts.length > 0 && <Link href="/posts?status=draft" className="text-ink-500 hover:underline"><span className="dot bg-ink-400" /> {drafts.length} brouillon{drafts.length > 1 ? 's' : ''}</Link>}
          {validatedAndScheduled.length === 0 && needsValidation.length === 0 && drafts.length === 0 && (
            <Link href="/brand-dna" className="text-brand-700 hover:underline">Aucun post planifié — générez votre semaine →</Link>
          )}
        </p>
      </section>

      {/* === RÉCENTS PUBLIÉS + SOURCES === */}
      <section className="grid lg:grid-cols-3 gap-4">
        {/* Derniers publiés */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-2xs uppercase tracking-wider font-semibold text-ink-500">Derniers publiés <span className="text-ink-400 normal-case">({publishedCount} ce mois)</span></h3>
            <Link href="/posts?status=published" className="text-xs text-brand-700 hover:text-brand-800 font-medium">Tout voir →</Link>
          </div>
          {recentPublished.length === 0 ? (
            <div className="card p-5 text-center">
              <p className="text-sm text-ink-700">Aucun post publié pour l'instant.</p>
              <Link href="/posts/new" className="btn-primary text-xs mt-2 inline-flex">Écrire le premier →</Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {recentPublished.map(p => (
                <Link key={p.id} href={`/posts/${p.id}/edit`} className="card card-hover p-3 block group">
                  <div className="flex items-center gap-2 text-2xs uppercase tracking-wider font-semibold text-success-700 mb-1">
                    <span className="dot bg-success-500" />
                    <span>{p.scheduled_at ? new Date(p.scheduled_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : ''}</span>
                    {p.impressions ? <span className="text-ink-400 normal-case font-normal ml-2">{p.impressions.toLocaleString('fr-FR')} impressions</span> : null}
                  </div>
                  <div className="text-sm font-medium text-ink-900 line-clamp-2 group-hover:text-brand-700 transition">{p.title}</div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Sources compact */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-2xs uppercase tracking-wider font-semibold text-ink-500">Sources</h3>
            <Link href="/sources" className="text-xs text-brand-700 hover:text-brand-800 font-medium">Gérer →</Link>
          </div>
          <div className="card p-3 space-y-1.5">
            <SourceLine name="LinkedIn" ok={liStatus === 'connected'} detail={liStatus === 'connected' ? `${liInfo.name} · ${liInfo.expires_in_days}j` : (liInfo.error || 'Non connecté')} />
            <SourceLine name="Notion" ok={notion.ok} detail={notion.ok ? `${needsValidation.length + validatedAndScheduled.length} posts à venir` : (('error' in notion && notion.error) || 'Erreur')} />
          </div>
        </div>
      </section>
    </div>
  );
}

function SourceLine({ name, ok, detail }: { name: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-ink-50/60 transition">
      <span className={`dot ${ok ? 'bg-success-500' : 'bg-danger-500'} animate-pulse-soft`} />
      <span className="text-sm font-medium text-ink-900">{name}</span>
      <span className="text-xs text-ink-500 truncate ml-auto">{detail}</span>
    </div>
  );
}
