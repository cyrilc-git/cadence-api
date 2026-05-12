import { supabase } from './supabase';

// === Brand DNA ===
export type BrandDnaItem = {
  id: string;
  kind: 'pilier' | 'rule' | 'hashtag' | 'cta' | 'hook' | 'audience' | 'format' | 'anti_pattern';
  label: string;
  body: any;
  position: number;
  active: boolean;
  updated_at: string;
};

export async function brandDnaList(): Promise<BrandDnaItem[]> {
  const { data } = await supabase.from('brand_dna').select('*').order('kind').order('position');
  return (data || []) as BrandDnaItem[];
}
export async function brandDnaUpsert(item: Partial<BrandDnaItem> & { kind: string; label: string }) {
  const { data, error } = await supabase.from('brand_dna').upsert({ ...item, updated_at: new Date().toISOString() }).select().single();
  if (error) throw error;
  return data;
}
export async function brandDnaDelete(id: string) {
  const { error } = await supabase.from('brand_dna').delete().eq('id', id);
  if (error) throw error;
}

// === Inspirations ===
export type Inspiration = {
  id: string;
  name: string;
  url?: string;
  avatar_url?: string;
  category?: string;
  score: number;
  style_notes?: string;
  do_not_copy?: string;
  active: boolean;
  created_at: string;
};

export async function inspirationsList(): Promise<Inspiration[]> {
  const { data } = await supabase.from('inspirations').select('*').order('score', { ascending: false }).order('name');
  return (data || []) as Inspiration[];
}
export async function inspirationUpsert(item: Partial<Inspiration> & { name: string }) {
  const { data, error } = await supabase.from('inspirations').upsert(item).select().single();
  if (error) throw error;
  return data;
}
export async function inspirationDelete(id: string) {
  const { error } = await supabase.from('inspirations').delete().eq('id', id);
  if (error) throw error;
}

// === Connectors ===
export type Connector = {
  id: string;
  kind: string;
  config: any;
  status: 'connected' | 'disconnected' | 'error' | 'needs_setup';
  last_sync_at?: string | null;
  last_error?: string | null;
  updated_at?: string;
};
export const CONNECTOR_KINDS = [
  { kind: 'linkedin', label: 'LinkedIn',         requires: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'] },
  { kind: 'notion',   label: 'Notion',           requires: ['NOTION_API_TOKEN', 'NOTION_LINKEDIN_DS_ID'] },
  { kind: 'anthropic',label: 'Claude (Anthropic)', requires: ['ANTHROPIC_API_KEY'] },
  { kind: 'openai',   label: 'OpenAI (visuels DALL-E)', requires: ['OPENAI_API_KEY'] },
  { kind: 'github',   label: 'GitHub (sources produit)', requires: ['GITHUB_TOKEN', 'GITHUB_REPOS'] },
  { kind: 'gmail',    label: 'Gmail',            requires: ['GMAIL_OAUTH_TOKEN'] },
  { kind: 'gdrive',   label: 'Google Drive',     requires: ['GDRIVE_OAUTH_TOKEN'] },
  { kind: 'onedrive', label: 'OneDrive',         requires: ['ONEDRIVE_OAUTH_TOKEN'] }
];

export async function connectorsStatus(): Promise<Connector[]> {
  // Always derive from env presence + table; env wins for "available"
  const { data } = await supabase.from('connectors').select('*');
  const map = new Map((data || []).map((c: any) => [c.kind, c]));
  const out: Connector[] = [];
  for (const k of CONNECTOR_KINDS) {
    const present = k.requires.every(envKey => !!process.env[envKey]);
    const existing = map.get(k.kind);
    out.push({
      id: existing?.id || k.kind,
      kind: k.kind,
      config: existing?.config || {},
      status: present ? (existing?.status || 'connected') : 'needs_setup',
      last_sync_at: existing?.last_sync_at || null,
      last_error: existing?.last_error || null
    });
  }
  return out;
}

// === Suggestions ===
export type Suggestion = {
  id: string;
  source: string;
  source_ref?: string;
  title: string;
  hook?: string;
  angle?: string;
  pilier?: string;
  score: number;
  why?: string;
  payload?: any;
  status: 'pending' | 'used' | 'ignored' | 'saved';
  created_at: string;
};

export async function suggestionsList(status?: string, limit = 50): Promise<Suggestion[]> {
  let q = supabase.from('suggestions').select('*').order('score', { ascending: false }).order('created_at', { ascending: false }).limit(limit);
  if (status) q = q.eq('status', status);
  const { data } = await q;
  return (data || []) as Suggestion[];
}

export async function suggestionUpsert(item: Partial<Suggestion> & { source: string; title: string }) {
  const { data, error } = await supabase.from('suggestions').upsert(item, { onConflict: 'source,source_ref' }).select().single();
  if (error) throw error;
  return data;
}

export async function suggestionSetStatus(id: string, status: Suggestion['status']) {
  const { error } = await supabase.from('suggestions').update({ status }).eq('id', id);
  if (error) throw error;
}
