import { supabase } from './supabase';
import { encryptSecret, decryptSecret } from './crypto';

// Provider → env var fallback name(s). First match wins.
const ENV_FALLBACK: Record<string, string[]> = {
  linkedin_client_id:     ['LINKEDIN_CLIENT_ID'],
  linkedin_client_secret: ['LINKEDIN_CLIENT_SECRET'],
  notion:                 ['NOTION_API_TOKEN'],
  notion_ds_id:           ['NOTION_LINKEDIN_DS_ID'],
  anthropic:              ['ANTHROPIC_API_KEY'],
  openai:                 ['OPENAI_API_KEY'],
  // V38.2 — Gemini (Nano Banana = gemini-2.5-flash-image) pour la génération d'images.
  gemini:                 ['GEMINI_API_KEY', 'GOOGLE_AI_API_KEY'],
  // V40 — Moteurs d'image additionnels (clé utilisateur, vraies API REST).
  replicate:              ['REPLICATE_API_TOKEN'],   // Flux, SDXL, Recraft… (méta-fournisseur)
  stability:              ['STABILITY_API_KEY'],     // Stable Diffusion 3.5
  ideogram:               ['IDEOGRAM_API_KEY'],      // Ideogram v3 (texte dans l'image)
  github:                 ['GITHUB_TOKEN'],
  github_repos:           ['GITHUB_REPOS'],
  cockpit_secret:         ['COCKPIT_SECRET'],
  cron_secret:            ['CRON_SECRET'],
  supabase_url:           ['SUPABASE_URL'],
  supabase_service_role:  ['SUPABASE_SERVICE_ROLE_KEY']
};

export type CredentialSource = 'db' | 'env' | 'missing';
export type CredentialInfo = { value: string | null; source: CredentialSource; id?: string };

/** Get a credential by provider name. Reads DB first (if MASTER_ENCRYPTION_KEY exists), else env var. Never logs the value. */
export async function getCredential(provider: string, userId: string | null = null): Promise<CredentialInfo> {
  // DB lookup
  if (process.env.MASTER_ENCRYPTION_KEY) {
    try {
      let q = supabase
        .from('user_credentials')
        .select('id, encrypted_secret, iv, auth_tag, status')
        .eq('provider', provider)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);
      if (userId) q = q.eq('user_id', userId); else q = q.is('user_id', null);
      const { data, error } = await q.maybeSingle();
      if (!error && data) {
        try {
          const v = decryptSecret(data.encrypted_secret, data.iv, data.auth_tag);
          return { value: v, source: 'db', id: data.id };
        } catch {}
      }
    } catch {}
  }
  // Env var fallback
  const envs = ENV_FALLBACK[provider] || [];
  for (const k of envs) {
    if (process.env[k]) return { value: process.env[k] as string, source: 'env' };
  }
  return { value: null, source: 'missing' };
}

/** Convenience: get just the string value, throws on missing. */
export async function requireCredential(provider: string, userId: string | null = null): Promise<string> {
  const r = await getCredential(provider, userId);
  if (!r.value) throw new Error(`Credential "${provider}" manquant (ni en DB user_credentials ni en env var).`);
  return r.value;
}

/** List credentials with masked values only — safe for client display. */
export async function listCredentials() {
  const { data } = await supabase
    .from('user_credentials')
    .select('id, user_id, brand_id, provider, label, masked, status, last_tested_at, last_error, created_at, updated_at')
    .order('created_at', { ascending: false });
  return data || [];
}

/** Save a new credential (encrypts before storing). */
export async function saveCredential(input: { provider: string; secret: string; label?: string; user_id?: string | null; brand_id?: string | null; scopes?: string[] }) {
  const enc = encryptSecret(input.secret);
  const userId = input.user_id ?? null;
  const label = input.label || 'default';
  const dedup_key = `${userId ?? '_default'}:${input.provider}:${label}`;
  const row = {
    user_id: userId,
    brand_id: input.brand_id ?? null,
    provider: input.provider,
    label,
    encrypted_secret: enc.ciphertext,
    iv: enc.iv,
    auth_tag: enc.auth_tag,
    masked: enc.masked,
    scopes: input.scopes ?? null,
    status: 'active',
    updated_at: new Date().toISOString(),
    dedup_key
  } as any;
  const { data, error } = await supabase.from('user_credentials').upsert(row, { onConflict: 'dedup_key' }).select('id, provider, label, masked, status, created_at, updated_at').single();
  if (error) throw error;
  return data;
}

export async function revokeCredential(id: string) {
  const { error } = await supabase.from('user_credentials').update({ status: 'revoked', updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function deleteCredential(id: string) {
  const { error } = await supabase.from('user_credentials').delete().eq('id', id);
  if (error) throw error;
}

export async function markTested(id: string, ok: boolean, error?: string) {
  await supabase.from('user_credentials').update({
    last_tested_at: new Date().toISOString(),
    last_error: ok ? null : (error || 'erreur inconnue'),
    status: ok ? 'active' : 'error',
    updated_at: new Date().toISOString()
  }).eq('id', id);
}

/** Test a credential by hitting its provider's API. Returns ok=true if reachable. */
export async function testCredential(id: string): Promise<{ ok: boolean; error?: string }> {
  const { data } = await supabase.from('user_credentials').select('*').eq('id', id).maybeSingle();
  if (!data) return { ok: false, error: 'credential not found' };
  let plain: string;
  try { plain = decryptSecret(data.encrypted_secret, data.iv, data.auth_tag); }
  catch (e: any) { await markTested(id, false, e.message); return { ok: false, error: e.message }; }

  let res: { ok: boolean; error?: string } = { ok: false };
  try {
    if (data.provider === 'notion') {
      const r = await fetch('https://api.notion.com/v1/users/me', { headers: { Authorization: `Bearer ${plain}`, 'Notion-Version': '2022-06-28' } });
      res = r.ok ? { ok: true } : { ok: false, error: `Notion ${r.status}` };
    } else if (data.provider === 'anthropic') {
      const r = await fetch('https://api.anthropic.com/v1/models', { headers: { 'x-api-key': plain, 'anthropic-version': '2023-06-01' } });
      res = r.ok ? { ok: true } : { ok: false, error: `Anthropic ${r.status}` };
    } else if (data.provider === 'openai') {
      const r = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${plain}` } });
      res = r.ok ? { ok: true } : { ok: false, error: `OpenAI ${r.status}` };
    } else if (data.provider === 'github') {
      const r = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${plain}`, Accept: 'application/vnd.github+json' } });
      res = r.ok ? { ok: true } : { ok: false, error: `GitHub ${r.status}` };
    } else if (data.provider === 'linkedin_client_id' || data.provider === 'linkedin_client_secret') {
      res = { ok: true }; // can't test in isolation, OAuth tested by /api/auth/linkedin redirect dance
    } else {
      res = { ok: true }; // generic providers: no live test
    }
  } catch (e: any) {
    res = { ok: false, error: e.message };
  }
  await markTested(id, res.ok, res.error);
  return res;
}
