import { NextRequest, NextResponse } from 'next/server';
import { generateClaudeDesignSvg } from '@/lib/anthropic';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BUCKET = 'cadence-visuals';

async function ensureBucket(): Promise<void> {
  try {
    const { data } = await supabase.storage.getBucket(BUCKET);
    if (data) return;
  } catch {}
  try {
    await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 5 * 1024 * 1024 });
  } catch {
    // Maybe already exists — swallow
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { prompt, mode = 'claude-design', notion_page_id } = body as { prompt?: string; mode?: 'claude-design' | 'openai'; notion_page_id?: string };
  if (!prompt || prompt.trim().length < 5) return NextResponse.json({ error: 'Prompt trop court.' }, { status: 400 });

  try {
    if (mode === 'claude-design') {
      const { svg, model } = await generateClaudeDesignSvg(prompt);
      // Ensure storage bucket
      await ensureBucket();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.svg`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, new Blob([svg], { type: 'image/svg+xml' }), { contentType: 'image/svg+xml', upsert: true });
      if (upErr) {
        return NextResponse.json({ ok: true, mode, model, svg, format: 'svg', storage_error: upErr.message });
      }
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return NextResponse.json({ ok: true, mode, model, url: urlData.publicUrl, svg, format: 'svg', notion_page_id });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY manquante côté serveur.' }, { status: 400 });
    }
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: '1792x1024' })
    });
    if (!r.ok) {
      const detail = await r.text();
      return NextResponse.json({ error: 'OpenAI a refusé la requête.', detail: detail.slice(0, 500) }, { status: 500 });
    }
    const data = await r.json();
    return NextResponse.json({ ok: true, mode, model: 'dall-e-3', url: data.data[0].url, format: 'png', notion_page_id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
