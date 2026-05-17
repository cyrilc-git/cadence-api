import Link from 'next/link';
import { listNotionPosts, notionStatus } from '@/lib/notion';
import { getActiveToken, publishedThisMonthCount } from '@/lib/supabase';
import { validateToken } from '@/lib/linkedin';
import { suggestionsList } from '@/lib/db';
import CadenceObserved from '@/components/CadenceObserved';
import OnboardingHint from '@/components/OnboardingHint';

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
  const topSuggestion = sugg[0] || null;
  const otherSuggestions = sugg.slice(1, 4);

  const weekDays = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const postsOfDay = posts.filter(p => p.scheduled_at && p.scheduled_at.slice(0, 10) === key);
    weekDays.push({ date: d, key, posts: postsOfDay });
  }

  return { liStatus, liInfo, notion, drafts, needsValidation, validatedAndScheduled, late, publishedCount, topSuggestion, otherSuggestions, weekDays, totalPosts: posts.length };
}

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function pilierTone(pilier?: string) {
  if (!pilier) return 'bg-ink-300';
  const day = pilier.split(/[\s·]/)[0];
  return { 'Lundi': 'bg-blue-500', 'Mardi': 'bg-emerald-500', 'Mercredi': 'bg-violet-500', 'Jeudi': 'bg-amber-500', 'Vendredi': 'bg-pink-500' }[day] || 'bg-ink-400';
}

// V9.0 §2 — État éditorial en 1 ligne prose (remplace les colonnes verbeuses)
function editorialStateLine({ validated, needsVal, drafts, publishedCount }: { validated: number; needsVal: number; drafts: number; publishedCount: number }) {
  const parts: string[] = [];
  if (publishedCount > 0) parts.push(`${publishedCount} publié${publishedCount > 1 ? 's' : ''} ce mois`);
  if (validated > 0) parts.push(`${validated} programmé${validated > 1 ? 's' : ''}`);
  if (needsVal > 0) parts.push(`${needsVal} à valider`);
  if (drafts > 0) parts.push(`${drafts} brouillon${drafts > 1 ? 's' : ''}`);
  return parts.length ? parts.join(' · ') : 'Aucun post pour l\'instant.';
}

export default async function HomePage() {
  const { liStatus, liInfo, notion, drafts, needsValidation, validatedAndScheduled, late, publishedCount, topSuggestion, otherSuggestions, weekDays, totalPosts } = await getDashboardData();
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* === HEADER ─────────────────────────────────────────── */}
      <header className="relative">
        <p className="text-xs font-medium text-ink-500 uppercase tracking-wider">{today}</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink-900 tracking-tight">Bonjour Cyril</h1>
      </header>

      {/* === ONBOARDING contextuel (1 banner max) ─────────── V9.0 §8 */}
      <OnboardingHint state={{
        linkedinConnected: liStatus === 'connected',
        notionOk: notion.ok,
        totalPosts,
        validated: validatedAndScheduled.length,
        needsValidation: needsValidation.length
      }} />

      {/* === WARNING — uniquement si urgence ─────────────── */}
      {late.length > 0 && (
        <section className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-danger-50/40 border border-danger-100 animate-fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-danger-500 mt-2 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-ink-800">
              <strong className="text-danger-700">{late.length}</strong> {late.length > 1 ? 'posts sont en retard' : 'post est en retard'}. À recycler, reprogrammer ou archiver.
            </p>
            <Link href="/posts?status=late" className="mt-1.5 inline-block text-xs text-danger-700 hover:text-danger-900 font-medium transition">Trier les {late.length} →</Link>
          </div>
        </section>
      )}

      {/* === CADENCE A REMARQUÉ — insight prioritaire ────── V9.0 §2 */}
      <CadenceObserved />

      {/* === NEXT BEST ACTION ─────────────────────────────── V9.0 §2 */}
      {topSuggestion ? (
        <section className="animate-fade-in">
          <div className="text-2xs uppercase tracking-wider font-semibold text-brand-700 mb-2">Prochaine meilleure action</div>
          <div className="border-l-2 border-brand-300 pl-4">
            <h2 className="text-lg font-semibold text-ink-900 leading-snug">{topSuggestion.title}</h2>
            {topSuggestion.hook && topSuggestion.hook !== topSuggestion.title && (
              <p className="mt-1.5 text-sm text-ink-600 italic">« {topSuggestion.hook} »</p>
            )}
            {topSuggestion.why && (
              <p className="mt-2 text-2xs text-ink-500">{topSuggestion.why}</p>
            )}
            <div className="mt-3 flex items-center gap-3 text-xs">
              <Link href={`/posts/new?suggest=${topSuggestion.id}&pilier=${encodeURIComponent(topSuggestion.pilier || '')}&hook=${encodeURIComponent(topSuggestion.hook || '')}&brief=${encodeURIComponent(topSuggestion.title)}`} className="btn-primary text-xs">
                Écrire ce post →
              </Link>
              {otherSuggestions.length > 0 && (
                <Link href="/suggestions" className="text-ink-500 hover:text-ink-900 transition">
                  Voir {otherSuggestions.length} autre{otherSuggestions.length > 1 ? 's' : ''}
                </Link>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="text-sm text-ink-500 animate-fade-in">
          Pas de suggestion fraîche. <Link href="/suggestions" className="text-brand-700 hover:text-brand-900 font-medium transition">Lancer le Radar →</Link>
        </section>
      )}

      {/* === SEMAINE — vue calme, 7 jours en strip ──────── */}
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-2xs uppercase tracking-wider font-semibold text-ink-500">7 prochains jours</h3>
          <Link href="/calendar" className="text-xs text-ink-500 hover:text-ink-900 transition">Calendrier complet →</Link>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {weekDays.map((d, i) => {
            const isToday = i === 0;
            const dayLabel = DAY_LABELS[d.date.getDay()];
            const dayNum = d.date.getDate();
            return (
              <Link key={d.key} href={`/calendar?d=${d.key}`} className={`rounded-xl p-2 transition border ${isToday ? 'border-brand-300 bg-brand-50/30' : 'border-ink-100 hover:border-ink-200 hover:bg-ink-50/40'}`}>
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
      </section>

      {/* === ÉTAT ÉDITORIAL — 1 ligne prose ──────────────── V9.0 §2 */}
      <section className="pt-2 border-t border-ink-100">
        <p className="text-xs text-ink-500">
          <span className="font-medium text-ink-600">État : </span>
          {editorialStateLine({ validated: validatedAndScheduled.length, needsVal: needsValidation.length, drafts: drafts.length, publishedCount })}
          {(needsValidation.length > 0 || drafts.length > 0) && (
            <Link href="/posts" className="ml-2 text-brand-700 hover:text-brand-900 transition">Bibliothèque →</Link>
          )}
        </p>
      </section>
    </div>
  );
}
