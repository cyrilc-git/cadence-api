import { supabase } from './supabase';

// ========== Brand DNA ==========
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

// ========== Inspirations (URL normalization) ==========
export type Inspiration = {
  id: string; name: string; url?: string; avatar_url?: string; category?: string;
  score: number; style_notes?: string; do_not_copy?: string; active: boolean; created_at: string;
};
function normalizeLinkedInUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  let url = trimmed;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url.replace(/^\/+/, '');
  try {
    const u = new URL(url);
    u.protocol = 'https:';
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch { return null; }
}
export async function inspirationsList(): Promise<Inspiration[]> {
  const { data } = await supabase.from('inspirations').select('*').order('score', { ascending: false }).order('name');
  return (data || []) as Inspiration[];
}
export async function inspirationUpsert(item: Partial<Inspiration> & { name: string }) {
  const sanitized = { ...item, url: normalizeLinkedInUrl(item.url) ?? null };
  const { data, error } = await supabase.from('inspirations').upsert(sanitized).select().single();
  if (error) throw error;
  return data;
}
export async function inspirationDelete(id: string) {
  const { error } = await supabase.from('inspirations').delete().eq('id', id);
  if (error) throw error;
}

// ========== Connectors ==========
export type Connector = { id: string; kind: string; config: any; status: 'connected' | 'disconnected' | 'error' | 'needs_setup'; last_sync_at?: string | null; last_error?: string | null; updated_at?: string };
export const CONNECTOR_KINDS = [
  { kind: 'linkedin', label: 'LinkedIn',          requires: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'] },
  { kind: 'notion',   label: 'Notion',            requires: ['NOTION_API_TOKEN', 'NOTION_LINKEDIN_DS_ID'] },
  { kind: 'anthropic',label: 'Claude (Anthropic)',requires: ['ANTHROPIC_API_KEY'] },
  { kind: 'openai',   label: 'OpenAI (DALL-E)',   requires: ['OPENAI_API_KEY'] },
  { kind: 'github',   label: 'GitHub',            requires: ['GITHUB_TOKEN', 'GITHUB_REPOS'] },
  { kind: 'gmail',    label: 'Gmail',             requires: ['GMAIL_OAUTH_TOKEN'] },
  { kind: 'gdrive',   label: 'Google Drive',      requires: ['GDRIVE_OAUTH_TOKEN'] },
  { kind: 'onedrive', label: 'OneDrive',          requires: ['ONEDRIVE_OAUTH_TOKEN'] }
];
export async function connectorsStatus(): Promise<Connector[]> {
  const { data } = await supabase.from('connectors').select('*');
  const map = new Map((data || []).map((c: any) => [c.kind, c]));
  const out: Connector[] = [];
  for (const k of CONNECTOR_KINDS) {
    const present = k.requires.every(envKey => !!process.env[envKey]);
    const existing = map.get(k.kind);
    out.push({ id: existing?.id || k.kind, kind: k.kind, config: existing?.config || {}, status: present ? (existing?.status || 'connected') : 'needs_setup', last_sync_at: existing?.last_sync_at || null, last_error: existing?.last_error || null });
  }
  return out;
}

// ========== Suggestions ==========
export type Suggestion = { id: string; source: string; source_ref?: string; title: string; hook?: string; angle?: string; pilier?: string; score: number; why?: string; payload?: any; status: 'pending' | 'used' | 'ignored' | 'saved'; created_at: string };
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

// ========== Post validation (V7.4) ==========
export async function getValidations(ids: string[]): Promise<Record<string, boolean>> {
  if (!ids.length) return {};
  const { data } = await supabase.from('post_validations').select('notion_page_id, validated').in('notion_page_id', ids);
  const map: Record<string, boolean> = {};
  for (const r of (data || [])) map[r.notion_page_id] = !!r.validated;
  return map;
}
export async function setValidation(notion_page_id: string, validated: boolean) {
  const { error } = await supabase.from('post_validations').upsert({ notion_page_id, validated, validated_at: validated ? new Date().toISOString() : null, updated_at: new Date().toISOString() });
  if (error) throw error;
}
export async function isValidated(notion_page_id: string): Promise<boolean> {
  const { data } = await supabase.from('post_validations').select('validated').eq('notion_page_id', notion_page_id).maybeSingle();
  return !!data?.validated;
}

// ========== Draft chat (V7.4) ==========
export type ChatMessage = { id: string; notion_page_id: string; role: 'user'|'assistant'|'system'; content: string; created_at: string };
export async function chatList(notion_page_id: string, limit = 50): Promise<ChatMessage[]> {
  const { data } = await supabase.from('draft_chat').select('*').eq('notion_page_id', notion_page_id).order('created_at').limit(limit);
  return (data || []) as ChatMessage[];
}
export async function chatAppend(notion_page_id: string, role: ChatMessage['role'], content: string) {
  const { data, error } = await supabase.from('draft_chat').insert({ notion_page_id, role, content }).select().single();
  if (error) throw error;
  return data;
}


// ========== V7.6 : Cadence source tracking ==========
export async function markCadenceDraft(notion_page_id: string, source: string = 'cadence_app', meta: any = {}) {
  try { await supabase.from('cadence_drafts').upsert({ notion_page_id, source, generation_meta: meta }); } catch {}
}
export async function getCadenceDraftSources(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const { data } = await supabase.from('cadence_drafts').select('notion_page_id, source').in('notion_page_id', ids);
  const map: Record<string, string> = {};
  for (const r of (data || [])) map[r.notion_page_id] = r.source;
  return map;
}

// ========== V7.6 : Notion actions log ==========
export async function logNotionAction(action: string, notion_page_id?: string, detail?: string, url?: string) {
  try { await supabase.from('notion_actions').insert({ action, notion_page_id, detail, url }); } catch {}
}
export async function recentNotionActions(limit = 10) {
  const { data } = await supabase.from('notion_actions').select('*').order('created_at', { ascending: false }).limit(limit);
  return data || [];
}

// ========== V7.6 : Design system ==========
export type DesignToken = { id: string; key: string; value: string; category?: string; updated_at: string };
export async function designSystemList(): Promise<DesignToken[]> {
  const { data } = await supabase.from('design_system').select('*').order('category').order('key');
  return (data || []) as DesignToken[];
}
export async function designSystemUpsert(item: { key: string; value: string; category?: string }) {
  const { data, error } = await supabase.from('design_system').upsert({ ...item, updated_at: new Date().toISOString() }, { onConflict: 'key' }).select().single();
  if (error) throw error;
  return data;
}
export async function designSystemDelete(id: string) {
  const { error } = await supabase.from('design_system').delete().eq('id', id);
  if (error) throw error;
}
export async function designSystemPromptBlock(): Promise<string> {
  const tokens = await designSystemList().catch(() => []);
  if (!tokens.length) return '';
  const byCat: Record<string, string[]> = {};
  const moodboardTags = new Set<string>();
  const palettes: string[] = [];
  const densities: string[] = [];
  for (const t of tokens) {
    const c = t.category || 'misc';
    if (c === 'moodboard') {
      // V9.0 §7 — agréger les tags Vision plutôt que lister les URLs
      const meta: any = t.meta || {};
      (meta.tags || []).forEach((tag: string) => moodboardTags.add(tag));
      if (meta.palette) palettes.push(meta.palette);
      if (meta.density) densities.push(meta.density);
      continue;
    }
    if (!byCat[c]) byCat[c] = [];
    byCat[c].push(`- ${t.key} : ${t.value}`);
  }
  let out = Object.entries(byCat).map(([cat, lines]) => `[${cat.toUpperCase()}]\n${lines.join('\n')}`).join('\n\n');
  if (moodboardTags.size > 0) {
    out += `\n\n[MOODBOARD_ANALYSE]\nStyles dominants : ${[...moodboardTags].join(', ')}`;
    if (palettes.length) out += `\nPalettes observées : ${palettes.slice(0, 3).join(' / ')}`;
    if (densities.length) out += `\nDensité : ${[...new Set(densities)].join(', ')}`;
  }
  return out;
}
