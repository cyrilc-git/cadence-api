import CalendarClient from './client';
import { notionStatus } from '@/lib/notion';
import { listPostSummaries, ensureFreshContentItems } from '@/lib/content-items';

export const dynamic = 'force-dynamic';

// V11.1 — Calendrier lit la couche canonique content_items.
export default async function CalendarPage() {
  const status = await notionStatus();
  if (!status.ok) {
    return (
      <div className="space-y-6 max-w-2xl">
        <header>
          <h1 className="text-2xl font-semibold text-ink-900 tracking-tight">Calendrier</h1>
          <p className="mt-1 text-sm text-ink-500 leading-relaxed">Notion ne répond pas pour l&apos;instant. Le calendrier ne peut pas charger les posts.</p>
        </header>
        <div className="border-l-2 border-danger-300 pl-4">
          <p className="text-sm text-ink-700 leading-relaxed">Vérifiez la connexion dans <a href="/sources" className="text-brand-700 hover:text-brand-900 transition">Sources</a>.</p>
        </div>
      </div>
    );
  }
  ensureFreshContentItems(120);
  const posts = await listPostSummaries({ limit: 300 });
  return <CalendarClient initialPosts={posts} />;
}
