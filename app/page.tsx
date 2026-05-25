import Link from 'next/link';
import { notionStatus } from '@/lib/notion';
import { listPostSummaries, ensureFreshContentItems } from '@/lib/content-items';
import { getActiveToken, publishedThisMonthCount } from '@/lib/supabase';
import { validateToken } from '@/lib/linkedin';
import { suggestionsList } from '@/lib/db';
import CadenceObserved from '@/components/CadenceObserved';
import OnboardingHint from '@/components/OnboardingHint';
import { sanitizeForBrandVoice } from '@/lib/brand-config';

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
  if (notion.ok) {
    try {
      ensureFreshContentItems(120);
      posts = await listPostSummaries({ limit: 200 });
    } catch {}
  }
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

// V11.4 — État éditorial en phrase humaine (au lieu d'un agglutinat de compteurs)
function editorialStateLine({ validated, needsVal, drafts, publishedCount }: { validated: number; needsVal: number; drafts: number; publishedCount: number }) {
  // Si la semaine est vide : phrase de calme.
  if (publishedCount === 0 && validated === 0 && needsVal === 0 && drafts === 0) {
    return 'Le mois est vierge.';
  }
  // Priorité 1 : à valider (action utilisateur immédiate)
  if (needsVal > 0) {
    return needsVal === 1
      ? `Un post programmé attend votre validation.`
      : `${needsVal} posts programmés attendent votre validation.`;
  }
  // Priorité 2 : tout est prêt
  if (validated > 0 && drafts === 0) {
    return validated === 1
      ? `Un post est validé pour partir. Rien d'autre en attente.`
      : `${validated} posts sont validés pour partir. Rien d'autre en attente.`;
  }
  // Priorité 3 : brouillons à finir
  if (drafts > 0 && validated === 0) {
    return drafts === 1
      ? `Un brouillon en cours, pas de programmation en attente.`
      : `${drafts} brouillons en cours, pas de programmation en attente.`;
  }
  // Mix : on garde court et humain
  if (validated > 0 && drafts > 0) {
    return `${validated} validé${validated > 1 ? 's' : ''} prêt${validated > 1 ? 's' : ''} à partir, ${drafts} brouillon${drafts > 1 ? 's' : ''} encore en chantier.`;
  }
  if (publishedCount > 0) {
    return `${publishedCount} post${publishedCount > 1 ? 's' : ''} publié${publishedCount > 1 ? 's' : ''} ce mois. Rien dans le tiroir.`;
  }
  return 'Le mois est vierge.';
}

export default async function HomePage() {
  const { liStatus, liInfo, notion, drafts, needsValidation, validatedAndScheduled, late, publishedCount, topSuggestion, otherSuggestions, weekDays, totalPosts } = await getDashboardData();
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <div className="space-y-10 max-w-3xl mx-auto">
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

      {/* === V11.6 §2 + V14.8 — Idée du moment, hook/title sanitizés contre
          em-dash résiduels de la DB suggestions === */}
      {topSuggestion ? (() => {
        const clean = {
          ...topSuggestion,
          title: sanitizeForBrandVoice(topSuggestion.title || ''),
          hook: topSuggestion.hook ? sanitizeForBrandVoice(topSuggestion.hook) : null,
        };
        return (
        <section className="animate-fade-in">
          <div className="text-2xs font-medium text-ink-500 mb-2">Cadence pense à</div>
          <div className="border-l-2 border-ink-300 pl-4">
            <h2 className="text-lg font-semibold text-ink-900 leading-snug">{clean.title}</h2>
            {clean.hook && clean.hook !== clean.title && (
              <p className="mt-1.5 text-sm text-ink-600 italic">« {clean.hook} »</p>
            )}
            {topSuggestion.why && (
              <p className="mt-2 text-2xs text-ink-500">{topSuggestion.why}</p>
            )}
            <div className="mt-3 flex items-center gap-3 text-xs">
              <Link href={`/posts/new?suggest=${topSuggestion.id}&pilier=${encodeURIComponent(topSuggestion.pilier || '')}&hook=${encodeURIComponent(clean.hook || '')}&brief=${encodeURIComponent(clean.title)}`} className="text-brand-700 hover:text-brand-900 font-medium transition">
                Écrire →
              </Link>
              {otherSuggestions.length > 0 && (
                <Link href="/suggestions" className="text-ink-500 hover:text-ink-900 transition">
                  Voir {otherSuggestions.length} autre{otherSuggestions.length > 1 ? 's' : ''}
                </Link>
              )}
            </div>
          </div>
        </section>
        );
      })() : (
        <section className="text-sm text-ink-500 animate-fade-in">
          Cadence cherche encore. <Link href="/suggestions" className="text-brand-700 hover:text-brand-900 font-medium transition">Ouvrir le radar →</Link>
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

      {/* === V11.4 — État éditorial en prose humaine === */}
      <section className="pt-2 border-t border-ink-100">
        <p className="text-xs text-ink-500 leading-relaxed">
          {editorialStateLine({ validated: validatedAndScheduled.length, needsVal: needsValidation.length, drafts: drafts.length, publishedCount })}
          {(needsValidation.length > 0 || drafts.length > 0) && (
            <Link href="/posts" className="ml-2 text-brand-700 hover:text-brand-900 transition">Voir la bibliothèque →</Link>
          )}
        </p>
      </section>
    </div>
  );
}
