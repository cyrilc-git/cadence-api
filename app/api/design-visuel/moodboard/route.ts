import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 30;

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

    // Enregistrer dans design_system_tokens (category=moodboard, key unique, value=URL)
    const key = `moodboard.${Date.now()}`;
    const { error: tokErr } = await supabase.from('design_system').insert({
      key, value: urlData.publicUrl, category: 'moodboard', meta: { filename: file.name, size: file.size, type: file.type, path }
    });
    if (tokErr) console.warn('moodboard token save warn:', tokErr.message);

    return NextResponse.json({ ok: true, url: urlData.publicUrl, path, key });
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
