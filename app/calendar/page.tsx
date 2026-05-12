import CalendarClient from './client';
import { listNotionPosts, notionStatus } from '@/lib/notion';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const status = await notionStatus();
  if (!status.ok) {
    return <div className="space-y-6"><h1 className="text-3xl font-semibold text-ink-900">Calendrier</h1><p className="text-sm text-danger-700">Notion inaccessible.</p></div>;
  }
  const posts = await listNotionPosts(200);
  return <CalendarClient initialPosts={posts} />;
}
