import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cockpit-secret');
  if (!secret || secret !== process.env.COCKPIT_SECRET) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { prompt, notion_page_id, style } = body as { prompt?: string; notion_page_id?: string; style?: string };
  if (!prompt || prompt.trim().length < 5) return NextResponse.json({ error: 'prompt_too_short' }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'no_openai_key', hint: 'Set OPENAI_API_KEY in Vercel env vars' }, { status: 501 });
  const styleSuffix: Record<string, string> = {
    illustration: ' Style: clean modern flat illustration with soft pastel colors, minimalist composition.',
    photorealistic: ' Style: photorealistic, high quality, professional editorial photo.',
    minimalist: ' Style: minimalist abstract design, geometric shapes, brand colors purple/indigo.'
  };
  const fullPrompt = prompt + (styleSuffix[style || 'minimalist'] || styleSuffix.minimalist);
  try {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'dall-e-3', prompt: fullPrompt, n: 1, size: '1024x1024', response_format: 'b64_json' })
    });
    if (!r.ok) throw new Error(`OpenAI: ${r.status}`);
    const j = await r.json();
    const buffer = Buffer.from(j.data[0].b64_json, 'base64');
    const fileName = `${Date.now()}_${notion_page_id || 'visual'}.png`;
    let { error } = await supabase.storage.from('cadence-visuals').upload(fileName, buffer, { contentType: 'image/png' });
    if (error?.message?.includes('not found') || error?.message?.includes('does not exist')) {
      await supabase.storage.createBucket('cadence-visuals', { public: true });
      const retry = await supabase.storage.from('cadence-visuals').upload(fileName, buffer, { contentType: 'image/png' });
      if (retry.error) throw retry.error;
    } else if (error) throw error;
    const publicUrl = supabase.storage.from('cadence-visuals').getPublicUrl(fileName).data.publicUrl;
    if (notion_page_id && process.env.NOTION_API_TOKEN) {
      await fetch(`https://api.notion.com/v1/pages/${notion_page_id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${process.env.NOTION_API_TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: { 'Visuel prêt': { checkbox: true } } })
      }).catch(() => {});
    }
    return NextResponse.json({ success: true, image_url: publicUrl, prompt: fullPrompt });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
