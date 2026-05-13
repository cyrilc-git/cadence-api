import NotionSettingsClient from '@/app/settings/notion/client';
import { recentNotionActions } from '@/lib/db';
import { notionStatus } from '@/lib/notion';

export const dynamic = 'force-dynamic';

async function fetchDbInfo() {
  const token = process.env.NOTION_API_TOKEN;
  const dsId = process.env.NOTION_LINKEDIN_DS_ID;
  if (!token || !dsId) return null;
  try {
    const r = await fetch(`https://api.notion.com/v1/databases/${dsId}`, { headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28' } });
    if (!r.ok) return null;
    const d = await r.json();
    return {
      id: d.id,
      title: (d.title?.[0]?.plain_text) || 'Untitled',
      url: d.url,
      properties: Object.entries(d.properties || {}).map(([name, p]: [string, any]) => ({ name, type: p.type }))
    };
  } catch { return null; }
}

export default async function SourcesNotionPage() {
  const [status, dbInfo, actions] = await Promise.all([
    notionStatus(),
    fetchDbInfo(),
    recentNotionActions(15).catch(() => [])
  ]);
  return <NotionSettingsClient status={status} dbInfo={dbInfo} actions={actions} />;
}
