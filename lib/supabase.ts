import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
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
  const { data } = await supabase
    .from('linkedin_tokens')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data;
}

export async function saveToken(token: Omit<LinkedInToken, 'id'>) {
  const { error } = await supabase
    .from('linkedin_tokens')
    .upsert(token, { onConflict: 'linkedin_user_id' });
  if (error) throw error;
}
