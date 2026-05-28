// V18.7 — Export PDF d'un carrousel
//
// POST /api/carousel/export
// Body : { text: string, format?: 'pedagogical'|..., brand?: string }
// Réponse : application/pdf streamé (Content-Disposition: attachment)
//
// Optionnel : persistance dans carousel_items si content_item_id fourni.

import { NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { planSlides } from '@/lib/carousel';
import { CarouselDocument } from '@/lib/carousel-pdf';
import React from 'react';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    // V50.1 — Plan édité : si le client envoie un plan (slides retouchées
    // dans le studio carrousel), on l'utilise tel quel. Sinon on plane le
    // texte. Permet d'exporter exactement ce que l'utilisateur a édité.
    const planOverride = body.plan && Array.isArray(body.plan.slides) ? body.plan : null;
    if (!planOverride && text.length < 80) {
      return new Response(JSON.stringify({ error: 'Texte trop court pour un carrousel (80 chars minimum).' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const plan = planOverride || planSlides(text, { withCta: body.withCta === true });
    const brand = typeof body.brand === 'string' ? body.brand : 'CADENCE · HEELIO';
    const doc = React.createElement(CarouselDocument, { plan, brand });
    const buf = await renderToBuffer(doc as any);
    const filename = `carrousel-${plan.format}-${plan.totalSlides}slides.pdf`;
    // Node Buffer -> Uint8Array transmis comme Body (cast as BodyInit)
    const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    return new Response(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
        'x-carousel-format': plan.format,
        'x-carousel-slides': String(plan.totalSlides),
        // V30.1 — Surface le quality score pour permettre à l'UI de
        // signaler un carrousel déséquilibré sans dénaturer le binaire PDF.
        'x-carousel-quality': typeof plan.qualityScore === 'number' ? plan.qualityScore.toFixed(2) : '',
        'x-carousel-signals': (plan.qualitySignals || [])
          .filter((s: any) => s.kind !== 'good')
          .slice(0, 3)
          .map((s: any) => s.kind)
          .join(','),
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
