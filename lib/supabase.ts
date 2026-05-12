import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

function client(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

// Export a Proxy so existing code that does `supabase.from(...)` still works at runtime
// while build-time module-load doesn't try to construct the real client.
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_t, prop) { return (client() as any)[prop]; }
});

export type LinkedInToken = {
  id: string;
  linkedin_user_id: string;
  access_token: string;
  refresh_token?: string;
  expires_at: string;
  scope?: string;
};

export async function getActiveToken(): Promise<LinkedInToken | null> {
  try {
    const { data } = await client()
      .from('linkedin_tokens')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    return data;
  } catch {
    return null;
  }
}

export async function saveToken(token: Omit<LinkedInToken, 'id'>) {
  const { error } = await client()
    .from('linkedin_tokens')
    .upsert(token, { onConflict: 'linkedin_user_id' });
  if (error) throw error;
}

export async function recentPublishLog(limit = 10) {
  try {
    const { data } = await client()
      .from('publish_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return data || [];
  } catch {
    return [];
  }
}

export async function publishedThisMonthCount(): Promise<number> {
  try {
    const start = new Date();
    start.setDate(1); start.setHours(0,0,0,0);
    const { count } = await client()
      .from('publish_log')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'success')
      .gte('created_at', start.toISOString());
    return count || 0;
  } catch {
    return 0;
  }
}
