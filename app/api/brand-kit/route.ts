import { NextRequest, NextResponse } from 'next/server';
import { readBrandKit, saveBrandKitToken, addBrandImage, removeBrandImage } from '@/lib/brand-kit';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function GET() {
  try { return NextResponse.json(await readBrandKit()); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

// PUT — enregistre couleurs / style / format.
export async function PUT(req: NextRequest) {
  const b = await req.json().catch(() => ({} as any));
  const hex = (v: any) => (typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v.trim())) ? v.trim() : null;
  try {
    if ('accent' in b) { const v = hex(b.accent); if (v) await saveBrandKitToken('accent', v, 'couleurs'); }
    if ('background' in b) { const v = hex(b.background); if (v) await saveBrandKitToken('background', v, 'couleurs'); }
    if ('text' in b) { const v = hex(b.text); if (v) await saveBrandKitToken('text', v, 'couleurs'); }
    if (typeof b.style === 'string') await saveBrandKitToken('style_keywords', b.style.slice(0, 600), 'style');
    if (['landscape', 'square', 'portrait'].includes(b.format)) await saveBrandKitToken('format_default', b.format, 'format');
    return NextResponse.json(await readBrandKit());
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

// POST — ajoute une image de référence (data URL base64).
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({} as any));
  if (typeof b.image !== 'string') return NextResponse.json({ error: 'image (data url) requise' }, { status: 400 });
  try { return NextResponse.json({ ok: true, image: await addBrandImage(b.image) }); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 400 }); }
}

// DELETE ?key= — retire une image de référence.
export async function DELETE(req: NextRequest) {
  const key = new URL(req.url).searchParams.get('key');
  if (!key) return NextResponse.json({ error: 'key requise' }, { status: 400 });
  try { await removeBrandImage(key); return NextResponse.json({ ok: true }); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
