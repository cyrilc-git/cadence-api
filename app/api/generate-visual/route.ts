import { NextRequest, NextResponse } from 'next/server';
import { generateClaudeDesignSvg } from '@/lib/anthropic';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { prompt, mode = 'claude-design', notion_page_id } = body as { prompt?: string; mode?: 'claude-design' | 'openai'; notion_page_id?: string };
  if (!prompt) return NextResponse.json({ error: 'prompt_required' }, { status: 400 });

  try {
    if (mode === 'claude-design') {
      const svg = await generateClaudeDesignSvg(prompt);
      // Upload to Supabase Storage
      const path = `cadence-visuals/${Date.now()}-${Math.random().toString(36).slice(2,8)}.svg`;
      const { error: upErr } = await supabase.storage.from('cadence-visuals').upload(path, new Blob([svg], { type: 'image/svg+xml' }), { contentType: 'image/svg+xml', upsert: true });
      if (upErr) return NextResponse.json({ error: 'upload_failed', detail: upErr.message, svg }, { status: 500 });
      const { data: urlData } = supabase.storage.from('cadence-visuals').getPublicUrl(path);
      return NextResponse.json({ ok: true, mode, url: urlData.publicUrl, format: 'svg', notion_page_id });
    }

    // OpenAI mode (DALL-E 3)
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'openai_key_missing' }, { status: 400 });
    }
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: '1024x1024' })
    });
    if (!r.ok) return NextResponse.json({ error: 'openai_failed', detail: await r.text() }, { status: 500 });
    const data = await r.json();
    return NextResponse.json({ ok: true, mode, url: data.data[0].url, format: 'png', notion_page_id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
