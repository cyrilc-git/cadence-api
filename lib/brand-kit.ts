// V58.5 — Brand kit visuel : couleurs, style, format par défaut, images de
// référence. Stocké dans la table design_system (tokens key/value/category/meta),
// lu par generateClaudeDesignSvg (designSystemPromptBlock + designSystemMoodboardUrls
// + designSystemDefaultFormat). Un seul endroit à régler, appliqué à chaque visuel.

import { supabase } from './supabase';

const BUCKET = 'cadence-visuals';

export type BrandImage = { key: string; url: string };
export type BrandKit = {
  accent: string | null;
  background: string | null;
  text: string | null;
  style: string | null;
  format: string;
  images: BrandImage[];
};

export async function readBrandKit(): Promise<BrandKit> {
  const { data } = await supabase.from('design_system').select('key,value,category,meta');
  const rows = (data || []) as any[];
  const val = (k: string) => rows.find(r => r.key === k)?.value ?? null;
  const images = rows
    .filter(r => (r.category || '') === 'moodboard' && r.meta && r.meta.url)
    .map(r => ({ key: r.key as string, url: String(r.meta.url) }));
  return {
    accent: val('accent'),
    background: val('background'),
    text: val('text'),
    style: val('style_keywords'),
    format: val('format_default') || 'landscape',
    images,
  };
}

export async function saveBrandKitToken(key: string, value: string, category: string) {
  const { error } = await supabase
    .from('design_system')
    .upsert({ key, value, category, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
}

// Ajoute une image de référence : data URL base64 -> bucket -> token moodboard.
export async function addBrandImage(dataUrl: string): Promise<BrandImage> {
  const m = String(dataUrl).match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!m) throw new Error('Image invalide (data URL base64 attendue).');
  const ct = m[1];
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > 4 * 1024 * 1024) throw new Error('Image trop lourde (4 Mo max).');
  const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('svg') ? 'svg' : 'jpg';
  const path = `brandkit/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: ct, upsert: true });
  if (upErr) throw new Error(upErr.message);
  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const key = `moodboard_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const { error } = await supabase
    .from('design_system')
    .upsert({ key, value: url, category: 'moodboard', meta: { url }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
  return { key, url };
}

export async function removeBrandImage(key: string) {
  const { error } = await supabase.from('design_system').delete().eq('key', key).eq('category', 'moodboard');
  if (error) throw error;
}
