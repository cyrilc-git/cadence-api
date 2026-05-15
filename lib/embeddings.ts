// V8.1 — Editorial memory : embeddings + semantic search
// Uses OpenAI text-embedding-3-small (1536 dims, ~$0.02/M tokens, fast).
// pgvector HNSW index on Supabase for sub-100ms k-NN.

import crypto from 'node:crypto';
import { supabase } from './supabase';
import { getCredential } from './credentials';

const MODEL = 'text-embedding-3-small';
const DIM = 1536;

let _key: string | null = null;
async function openaiKey(): Promise<string> {
  if (_key) return _key;
  const { value } = await getCredential('openai');
  if (!value) throw new Error('OPENAI_API_KEY manquante (settings → OpenAI)');
  _key = value;
  return _key;
}

// === Embed a single text ===
export async function embedText(text: string): Promise<number[]> {
  const key = await openaiKey();
  const cleaned = text.trim().slice(0, 8000); // model limit ~8k tokens, we cap chars
  if (!cleaned) throw new Error('embedText: empty input');
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODEL, input: cleaned })
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`OpenAI embeddings ${r.status}: ${err.slice(0, 200)}`);
  }
  const data = await r.json();
  const vec = data?.data?.[0]?.embedding;
  if (!Array.isArray(vec) || vec.length !== DIM) throw new Error(`Bad embedding dim ${vec?.length}`);
  return vec;
}

// === Index a single post ===
export type IndexPostInput = {
  source: 'notion' | 'linkedin_archive' | 'inspiration' | 'manual';
  source_ref: string;
  title: string;
  content: string;
  pilier?: string;
  status?: string;
  scheduled_at?: string | null;
  meta?: any;
};

export async function indexPost(input: IndexPostInput): Promise<{ indexed: boolean; reason?: string }> {
  const text = `${input.title}\n\n${input.content}`.trim();
  if (!text) return { indexed: false, reason: 'empty content' };
  const hash = sha256(text);
  // Skip if already up-to-date
  const { data: existing } = await supabase
    .from('post_embeddings')
    .select('id, hash')
    .eq('source', input.source)
    .eq('source_ref', input.source_ref)
    .maybeSingle();
  if (existing?.hash === hash) return { indexed: false, reason: 'unchanged' };

  const embedding = await embedText(text);
  const row = {
    source: input.source,
    source_ref: input.source_ref,
    title: input.title || '',
    content_excerpt: input.content.slice(0, 500),
    pilier: input.pilier || null,
    status: input.status || null,
    scheduled_at: input.scheduled_at || null,
    embedding,
    embedding_model: MODEL,
    hash,
    meta: input.meta || {},
    indexed_at: new Date().toISOString()
  };
  const { error } = await supabase.from('post_embeddings').upsert(row, { onConflict: 'source,source_ref' });
  if (error) throw error;
  return { indexed: true };
}

// === Search semantically similar posts ===
export type EmbeddingHit = {
  id: string;
  source: string;
  source_ref: string;
  title: string;
  pilier: string | null;
  status: string | null;
  scheduled_at: string | null;
  similarity: number;
};

export async function semanticSearch(query: string, opts?: { limit?: number; floor?: number }): Promise<EmbeddingHit[]> {
  const limit = opts?.limit ?? 10;
  const floor = opts?.floor ?? 0.0;
  const vec = await embedText(query);
  const { data, error } = await supabase.rpc('search_post_embeddings', {
    query_embedding: vec as any,
    match_limit: limit,
    similarity_floor: floor
  });
  if (error) throw error;
  return (data || []) as EmbeddingHit[];
}

// === Novelty / Saturation scoring ===
// Novelty = 1 - max similarity to recent posts (last 60 days). Higher = more novel.
// Saturation = number of similar posts in last N days (>0.75 similarity).
export async function noveltyScore(text: string): Promise<{ novelty: number; saturation: number; nearest?: EmbeddingHit }> {
  try {
    const hits = await semanticSearch(text, { limit: 10, floor: 0.5 });
    const sixtyDays = Date.now() - 1000 * 60 * 60 * 24 * 60;
    const recent = hits.filter(h => h.scheduled_at && new Date(h.scheduled_at).getTime() > sixtyDays);
    const maxSim = recent.length ? Math.max(...recent.map(h => h.similarity)) : 0;
    const saturation = recent.filter(h => h.similarity > 0.75).length;
    return { novelty: Math.max(0, 1 - maxSim), saturation, nearest: recent[0] };
  } catch (e) {
    // fallback : neutral scores if openai down
    return { novelty: 0.5, saturation: 0 };
  }
}

// === Topic clusters (last X days) ===
// Returns posts grouped by similarity threshold. Useful for "you've covered topic X 3 times this month".
export async function listIndexed(opts?: { source?: string; limit?: number }): Promise<EmbeddingHit[]> {
  const q = supabase.from('post_embeddings')
    .select('id, source, source_ref, title, pilier, status, scheduled_at')
    .order('scheduled_at', { ascending: false, nullsFirst: false })
    .limit(opts?.limit ?? 100);
  if (opts?.source) q.eq('source', opts.source);
  const { data } = await q;
  return (data || []).map(d => ({ ...d, similarity: 1 })) as EmbeddingHit[];
}

export async function indexedCount(): Promise<number> {
  const { count } = await supabase.from('post_embeddings').select('*', { count: 'exact', head: true });
  return count || 0;
}

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}
