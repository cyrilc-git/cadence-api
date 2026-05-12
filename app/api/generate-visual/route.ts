import { NextRequest, NextResponse } from 'next/server';
import { generateClaudeDesignSvg } from '@/lib/anthropic';
import { getCredential } from '@/lib/credentials';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BUCKET = 'cadence-visuals';

async function ensureBucket(): Promise<void> {
  try {
    const { data } = await supabase.storage.getBucket(BUCKET);
    if (data) return;
  } catch {}
  try { await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 5 * 1024 * 1024 }); } catch {}
}

const DALL_E_SIZES = new Set(['1024x1024', '1024x1792', '1792x1024']);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { prompt, mode = 'claude-design', notion_page_id, size = '1024x1024', quality = 'standard' } =
    body as { prompt?: string; mode?: 'claude-design' | 'openai'; notion_page_id?: string; size?: string; quality?: 'standard' | 'hd' };
  if (!prompt || prompt.trim().length < 5) return NextResponse.json({ error: 'Prompt trop court (5 caractères minimum).' }, { status: 400 });

  try {
    if (mode === 'claude-design') {
      const { svg, model } = await generateClaudeDesignSvg(prompt);
      await ensureBucket();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.svg`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, new Blob([svg], { type: 'image/svg+xml' }), { contentType: 'image/svg+xml', upsert: true });
      if (upErr) return NextResponse.json({ ok: true, mode, model, svg, format: 'svg', storage_error: upErr.message });
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return NextResponse.json({ ok: true, mode, model, url: urlData.publicUrl, svg, format: 'svg', notion_page_id });
    }

    // OpenAI mode
    const oai = await getCredential('openai');
    if (!oai.value) return NextResponse.json({ error: 'OPENAI_API_KEY introuvable (ni DB ni env). Ajoutez-la dans Settings → Connecteurs.' }, { status: 400 });
    const realSize = DALL_E_SIZES.has(size) ? size : '1024x1024';
    const payload: any = {
      model: 'dall-e-3',
      prompt: prompt.slice(0, 4000),
      n: 1,
      size: realSize,
      quality
    };
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${oai.value}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const raw = await r.text();
    let parsed: any = null;
    try { parsed = JSON.parse(raw); } catch {}
    if (!r.ok) {
      // Bubble up the actual OpenAI error details
      const openaiErr = parsed?.error;
      return NextResponse.json({
        error: openaiErr?.message || `OpenAI ${r.status} (${openaiErr?.type || 'unknown_error'})`,
        code: openaiErr?.code || null,
        type: openaiErr?.type || null,
        status: r.status,
        raw: raw.slice(0, 1500),
        payload_sent: { size: realSize, quality, prompt_chars: payload.prompt.length }
      }, { status: r.status });
    }
    if (!parsed?.data?.[0]?.url) {
      return NextResponse.json({ error: 'OpenAI a répondu sans image.', raw: raw.slice(0, 500) }, { status: 500 });
    }
    return NextResponse.json({ ok: true, mode, model: 'dall-e-3', url: parsed.data[0].url, revised_prompt: parsed.data[0].revised_prompt, format: 'png', size: realSize, quality, notion_page_id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
