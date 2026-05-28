import { NextRequest, NextResponse } from 'next/server';
import { generateClaudeDesignSvg, classifyVisualImage } from '@/lib/anthropic';
import { getCredential } from '@/lib/credentials';
import { supabase } from '@/lib/supabase';
import { recordVisualItem, scoreSvgPremium, type VisualFormat } from '@/lib/visual-memory';

export const runtime = 'nodejs';
export const maxDuration = 60;

// V12.1 §3 — Map template UI -> format mémoire visuelle
function templateToFormat(template?: string): VisualFormat | null {
  switch (template) {
    case 'feature':      return 'feature';
    case 'schema':       return 'schema';
    case 'capture':      return 'capture';
    case 'illustration': return 'illustration';
    default:             return null;
  }
}

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
  const { prompt, mode = 'claude-design', notion_page_id, size = '1024x1024', quality = 'standard', template, pilier } =
    body as { prompt?: string; mode?: 'claude-design' | 'openai' | 'gemini'; notion_page_id?: string; size?: string; quality?: 'standard' | 'hd'; template?: string; pilier?: string };
  if (!prompt || prompt.trim().length < 5) return NextResponse.json({ error: 'Prompt trop court (5 caractères minimum).' }, { status: 400 });

  try {
    // V38.2 — Gemini (Nano Banana = gemini-2.5-flash-image). Génère une vraie
    // image bitmap via l'API Google AI. Si pas de clé : erreur claire et
    // actionnable (pas de fake). L'image base64 est uploadée dans le bucket.
    if (mode === 'gemini') {
      const gem = await getCredential('gemini');
      if (!gem.value) {
        return NextResponse.json({ error: 'Clé Gemini introuvable. Ajoutez GEMINI_API_KEY dans Settings → Connecteurs pour activer Nano Banana.' }, { status: 400 });
      }
      const MODEL = 'gemini-2.5-flash-image-preview';
      const gr = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${gem.value}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${prompt}\n\nDirection artistique : sobre, éditorial, premium. Fond clair, une seule couleur d'accent. Pas d'emoji, pas de gradient agressif, beaucoup d'air.` }] }],
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
      });
      const grText = await gr.text();
      let grJson: any = null;
      try { grJson = JSON.parse(grText); } catch {}
      if (!gr.ok) {
        const msg = grJson?.error?.message || `Gemini ${gr.status}`;
        return NextResponse.json({ error: msg, status: gr.status, raw: grText.slice(0, 800) }, { status: gr.status });
      }
      // Extraction de l'image base64 (inlineData)
      const parts = grJson?.candidates?.[0]?.content?.parts || [];
      const imgPart = parts.find((p: any) => p.inlineData?.data || p.inline_data?.data);
      const b64 = imgPart?.inlineData?.data || imgPart?.inline_data?.data;
      const contentType = imgPart?.inlineData?.mimeType || imgPart?.inline_data?.mime_type || 'image/png';
      if (!b64) {
        return NextResponse.json({ error: 'Gemini a répondu sans image. Reformulez le prompt.', raw: grText.slice(0, 500) }, { status: 500 });
      }
      await ensureBucket();
      const ext = contentType.includes('jpeg') ? 'jpg' : 'png';
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const bytes = Buffer.from(b64, 'base64');
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType, upsert: true });
      const publicUrl = upErr ? null : supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      const tracedGem = recordVisualItem({
        source_type: 'cadence_dalle', // pas de kind gemini dédié ; tracé comme génération bitmap
        format: templateToFormat(template),
        pilier: pilier || null,
        url: publicUrl,
        prompt,
        meta: { model: MODEL, engine: 'gemini', notion_page_id: notion_page_id || null },
      }).catch(() => null);
      if (publicUrl) {
        tracedGem.then(async (item) => {
          if (!item) return;
          try {
            const cls = await classifyVisualImage(publicUrl);
            await supabase.from('visual_items').update({
              composition: cls.composition,
              format: cls.format || templateToFormat(template),
              vision_tags: cls.tags.length ? cls.tags : null,
              meta: { ...(item.meta || {}), density: cls.density, vision_pass: true },
            }).eq('id', item.id);
          } catch { /* silent */ }
        }).catch(() => {});
      }
      if (upErr) return NextResponse.json({ error: 'Image générée mais stockage impossible : ' + upErr.message }, { status: 500 });
      return NextResponse.json({ ok: true, mode, model: MODEL, url: publicUrl, format: 'png', notion_page_id });
    }

    if (mode === 'claude-design') {
      const { svg, model } = await generateClaudeDesignSvg(prompt);
      await ensureBucket();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.svg`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, new Blob([svg], { type: 'image/svg+xml' }), { contentType: 'image/svg+xml', upsert: true });
      const publicUrl = upErr ? null : supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      // V12.1 §3 — Trace dans la mémoire visuelle
      const traced = recordVisualItem({
        source_type: 'cadence_claude',
        format: templateToFormat(template),
        pilier: pilier || null,
        url: publicUrl,
        svg,
        prompt,
        meta: { model, notion_page_id: notion_page_id || null },
      }).catch(() => null);

      // V12.8 — Vision pass automatique en background : classifie composition
      // et format réels depuis l'image générée, met à jour la row visual_items.
      // Fire-and-forget : aucune dépendance sur la réponse de génération.
      if (publicUrl) {
        traced.then(async (item) => {
          if (!item) return;
          try {
            const cls = await classifyVisualImage(publicUrl);
            await supabase.from('visual_items').update({
              composition: cls.composition,
              format: cls.format || templateToFormat(template),
              vision_tags: cls.tags.length ? cls.tags : null,
              meta: { ...(item.meta || {}), density: cls.density, vision_pass: true },
            }).eq('id', item.id);
          } catch { /* silent */ }
        }).catch(() => { /* silent */ });
      }

      // V23.1 — Score premium calculé en pure JS sur le SVG (pas d'IA).
      // Renvoyé pour permettre à l'UI de signaler "trop Canva", "trop
      // chargé", "trop coloré" sans attendre la passe Vision async.
      const visualScore = scoreSvgPremium(svg);

      if (upErr) return NextResponse.json({ ok: true, mode, model, svg, format: 'svg', storage_error: upErr.message, visualScore });
      return NextResponse.json({ ok: true, mode, model, url: publicUrl, svg, format: 'svg', notion_page_id, visualScore });
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
    const dalleUrl = parsed.data[0].url;
    // V12.1 §3 — Trace + V12.8 Vision pass DALL-E
    const tracedDalle = recordVisualItem({
      source_type: 'cadence_dalle',
      format: templateToFormat(template),
      pilier: pilier || null,
      url: dalleUrl,
      prompt,
      meta: { model: 'dall-e-3', size: realSize, quality, revised_prompt: parsed.data[0].revised_prompt, notion_page_id: notion_page_id || null },
    }).catch(() => null);
    tracedDalle.then(async (item) => {
      if (!item) return;
      try {
        const cls = await classifyVisualImage(dalleUrl);
        await supabase.from('visual_items').update({
          composition: cls.composition,
          format: cls.format || templateToFormat(template),
          vision_tags: cls.tags.length ? cls.tags : null,
          meta: { ...(item.meta || {}), density: cls.density, vision_pass: true },
        }).eq('id', item.id);
      } catch { /* silent */ }
    }).catch(() => { /* silent */ });
    return NextResponse.json({ ok: true, mode, model: 'dall-e-3', url: dalleUrl, revised_prompt: parsed.data[0].revised_prompt, format: 'png', size: realSize, quality, notion_page_id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
