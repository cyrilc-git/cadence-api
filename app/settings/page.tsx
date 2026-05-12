import SettingsClient from './client';
import { getActiveToken } from '@/lib/supabase';
import { validateToken } from '@/lib/linkedin';
import { notionStatus } from '@/lib/notion';
import { connectorsStatus } from '@/lib/db';
import { listCredentials } from '@/lib/credentials';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [tokenRow, notion, connectors, creds] = await Promise.all([
    getActiveToken().catch(() => null),
    notionStatus(),
    connectorsStatus().catch(() => []),
    listCredentials().catch(() => [])
  ]);
  let li: any = { status: 'none' };
  if (tokenRow) {
    const v = await validateToken(tokenRow.access_token);
    const exp = new Date(tokenRow.expires_at).getTime();
    if (v.ok && exp > Date.now()) li = { status: 'connected', name: v.name, email: v.email, expires_at: tokenRow.expires_at };
    else li = { status: 'expired', error: v.ok ? 'Date expiration dépassée' : `LinkedIn API ${v.status}` };
  }
  const masterKeyMissing = !process.env.MASTER_ENCRYPTION_KEY;
  return <SettingsClient li={li} notionOk={notion.ok} notionError={'error' in notion ? notion.error : undefined} connectors={connectors as any[]} initialCreds={creds as any[]} masterKeyMissing={masterKeyMissing} />;
}
