const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

const headers = () => ({
  Authorization: `Bearer ${process.env.NOTION_API_TOKEN!}`,
  'Notion-Version': NOTION_VERSION,
  'Content-Type': 'application/json'
});

export type NotionDraft = {
  id: string;
  content: string;
  pilier?: string;
  anonymisation_ok?: boolean;
  scheduled_at: string;
};

// Search drafts due to publish in the current window
export async function searchNotionDrafts(windowMinutes: number): Promise<NotionDraft[]> {
  const dsId = process.env.NOTION_LINKEDIN_DS_ID!;
  const now = new Date();
  const todayIso = now.toISOString().split('T')[0];

  // Query DB filtered: Tags = "Non publié" AND Date de publication = today
  const queryRes = await fetch(`${NOTION_API}/databases/${dsId}/query`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      filter: {
        and: [
          { property: 'Tags', select: { equals: 'Non publié' } },
          { property: 'Date de publication', date: { equals: todayIso } }
        ]
      },
      page_size: 25
    })
  });
  if (!queryRes.ok) throw new Error(`Notion query failed: ${queryRes.status} ${await queryRes.text()}`);
  const queryJson = await queryRes.json();

  const drafts: NotionDraft[] = [];
  for (const page of queryJson.results || []) {
    // Read time-of-day from "Heure de publication" (rich_text "HH:MM")
    const heureRich = page.properties?.['Heure de publication']?.rich_text?.[0]?.plain_text || '07:30';
    const [hh, mm] = heureRich.split(':').map((x: string) => parseInt(x, 10));
    const scheduledAt = new Date(now);
    scheduledAt.setHours(hh || 7, mm || 30, 0, 0);
    const diffMin = Math.abs((now.getTime() - scheduledAt.getTime()) / 60000);
    if (diffMin > windowMinutes) continue; // out of window

    // Fetch page content (blocks)
    const blocksRes = await fetch(`${NOTION_API}/blocks/${page.id}/children?page_size=100`, { headers: headers() });
    const blocks = await blocksRes.json();
    const text = (blocks.results || [])
      .map((b: any) => {
        const richTexts = b[b.type]?.rich_text || [];
        return richTexts.map((r: any) => r.plain_text).join('');
      })
      .filter(Boolean)
      .join('\n\n');

    drafts.push({
      id: page.id,
      content: text,
      pilier: page.properties?.['Pilier']?.select?.name,
      anonymisation_ok: page.properties?.['Anonymisation OK']?.checkbox || false,
      scheduled_at: scheduledAt.toISOString()
    });
  }
  return drafts;
}

export async function markNotionPublished(pageId: string, postUrn: string): Promise<void> {
  const linkedinUrl = `https://www.linkedin.com/feed/update/${postUrn}`;
  const r = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({
      properties: {
        'Tags': { select: { name: 'Publié' } },
        'URL': { url: linkedinUrl }
      }
    })
  });
  if (!r.ok) throw new Error(`Notion update failed: ${r.status} ${await r.text()}`);
}
