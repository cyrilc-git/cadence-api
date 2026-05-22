import CalendarClient from './client';
import { notionStatus } from '@/lib/notion';
import { listPostSummaries, ensureFreshContentItems } from '@/lib/content-items';

export const dynamic = 'force-dynamic';

// V11.1 — Calendrier lit la couche canonique content_items.
export default async function CalendarPage() {
  const status = await notionStatus();
  if (!status.ok) {
    return <div className="space-y-6"><h1 className="text-3xl font-semibold text-ink-900">Calendrier</h1><p className="text-sm text-danger-700">Notion inaccessible.</p></div>;
  }
  ensureFreshContentItems(120);
  const posts = await listPostSummaries({ limit: 300 });
  return <CalendarClient initialPosts={posts} />;
}
