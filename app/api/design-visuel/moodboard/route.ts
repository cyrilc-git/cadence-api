import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { tagMoodboardImage } from '@/lib/anthropic';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BUCKET = 'cadence-visuals';
const PREFIX = 'moodboard';
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

async function ensureBucket() {
  try {
    const { data } = await supabase.storage.getBucket(BUCKET);
    if (data) return;
  } catch {}
  try { await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_SIZE }); } catch {}
}

// V8.9 §7 — POST formdata { file } → upload moodboard image
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'fichier manquant' }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: `fichier trop grand (${(file.size/1024/1024).toFixed(1)}MB > 5MB)` }, { status: 400 });
    if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: `type ${file.type} non supporté (PNG/JPEG/WebP/GIF)` }, { status: 400 });

    await ensureBucket();
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `${PREFIX}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    const buffer = await file.arrayBuffer();
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: file.type, upsert: false });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    // Enregistrer dans design_system (category=moodboard, key unique, value=URL)
    const key = `moodboard.${Date.now()}`;
    let meta: any = { filename: file.name, size: file.size, type: file.type, path };
    const { data: inserted, error: tokErr } = await supabase.from('design_system').insert({
      key, value: urlData.publicUrl, category: 'moodboard', meta
    }).select().single();
    if (tokErr) console.warn('moodboard token save warn:', tokErr.message);

    // V9.0 §7 — Async tagging via Claude Vision (ne bloque pas la réponse)
    // On lance le tagging puis update le meta. L'UI verra les tags au prochain GET.
    if (inserted?.id) {
      tagMoodboardImage(urlData.publicUrl)
        .then(async ({ tags, palette, density }) => {
          if (!tags.length) return;
          const newMeta = { ...meta, tags, palette, density, tagged_at: new Date().toISOString() };
          await supabase.from('design_system').update({ meta: newMeta }).eq('id', inserted.id);
        })
        .catch(e => console.warn('moodboard tagging failed:', e.message));
    }

    return NextResponse.json({ ok: true, url: urlData.publicUrl, path, key, id: inserted?.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET — liste des moodboards
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('design_system')
      .select('id, key, value, meta, created_at')
      .eq('category', 'moodboard')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return NextResponse.json({ moodboards: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, moodboards: [] }, { status: 500 });
  }
}
