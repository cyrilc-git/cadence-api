import Link from 'next/link';
import { listNotionPosts, notionStatus } from '@/lib/notion';
import StatusBadge from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

const COLORS: Record<string, string> = {
  'Lundi · Cas client':         'bg-blue-50 text-blue-700 ring-blue-500/20',
  'Mardi · Pédagogie':          'bg-green-50 text-green-700 ring-green-500/20',
  'Mercredi · Produit':         'bg-purple-50 text-purple-700 ring-purple-500/20',
  'Jeudi · Opinion':            'bg-orange-50 text-orange-700 ring-orange-500/20',
  'Vendredi · Build in public': 'bg-pink-50 text-pink-700 ring-pink-500/20'
};

export default async function CalendarPage() {
  const status = await notionStatus();
  if (!status.ok) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold text-ink-900">Calendrier</h1>
        <p className="text-sm text-danger-700">Notion inaccessible — voir Settings.</p>
      </div>
    );
  }
  const posts = await listNotionPosts(150);
  const byDate = new Map<string, typeof posts>();
  posts.forEach(p => {
    if (!p.scheduled_at) return;
    const k = p.scheduled_at.slice(0, 10);
    if (!byDate.has(k)) byDate.set(k, []);
    byDate.get(k)!.push(p);
  });

  // Build a 4-week grid starting from Monday of current week
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  monday.setHours(0,0,0,0);
  const weeks: Date[][] = [];
  for (let w = 0; w < 4; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + w * 7 + d);
      week.push(day);
    }
    weeks.push(week);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-ink-900">Calendrier</h1>
          <p className="mt-1 text-ink-500">4 semaines à partir de cette semaine. Cliquez sur un post pour l'ouvrir.</p>
        </div>
        <Link href="/posts/new" className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600">+ Nouveau</Link>
      </header>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-2 text-xs font-medium text-ink-500 uppercase tracking-wide px-1">
        {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d => <div key={d}>{d}</div>)}
      </div>

      <div className="space-y-2">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-2">
            {week.map(d => {
              const k = d.toISOString().slice(0,10);
              const items = byDate.get(k) || [];
              const isToday = k === today.toISOString().slice(0,10);
              const isPast = d < new Date(new Date().setHours(0,0,0,0));
              return (
                <div key={k} className={`rounded-xl p-2 min-h-[100px] ring-1 ring-inset ${isToday ? 'ring-brand-500 bg-brand-50/40' : 'ring-ink-300/30 bg-white'} ${isPast ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-semibold ${isToday ? 'text-brand-700' : 'text-ink-700'}`}>
                      {d.getDate()}
                    </span>
                    {!isPast && (
                      <Link href={`/posts/new?date=${k}`} className="text-ink-400 hover:text-brand-500 text-xs leading-none" title="Créer un post">+</Link>
                    )}
                  </div>
                  <div className="space-y-1">
                    {items.map(p => (
                      <Link key={p.id} href={`/posts/new?from=${p.id}`}
                        className={`block text-[11px] px-1.5 py-1 rounded ring-1 ring-inset truncate ${p.pilier ? COLORS[p.pilier] || 'bg-ink-100 text-ink-700 ring-ink-300/40' : 'bg-ink-100 text-ink-700 ring-ink-300/40'}`}>
                        {p.scheduled_time || ''} {p.title}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20">
        <h2 className="font-semibold text-ink-900">Auto-publication</h2>
        <div className="mt-2 flex items-center gap-3">
          <StatusBadge variant="success">Active</StatusBadge>
          <span className="text-sm text-ink-700">Cron Vercel quotidien à 5h30 UTC (≈ 7h30 Paris).</span>
        </div>
        <p className="mt-2 text-xs text-ink-500">
          Le cron lit la DB Notion, sélectionne les drafts du jour avec "Tags = Non publié", publie et marque "Publié" + URL.
          Pour publier à un autre horaire, utilisez "Publier maintenant" dans l'éditeur ou planifiez via cron-job.org en pingant <code>/api/cron-publish</code> avec le Bearer secret.
        </p>
      </div>
    </div>
  );
}
