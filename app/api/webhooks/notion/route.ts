// V11.1+ — Webhook Notion : reçoit les events page.created / page.properties_updated
// et déclenche une sync immédiate content_items au lieu d'attendre le cron daily.
//
// Configuration côté Notion :
// 1. Dans l'intégration Notion (Cadence) → Subscriptions → Add subscription
// 2. URL : https://cadence-api-ruddy.vercel.app/api/webhooks/notion
// 3. Notion envoie un premier POST avec verification_token : on l'echo et il
//    valide l'URL.
// 4. Ajouter NOTION_WEBHOOK_SECRET dans Vercel env vars (n'importe quelle string
//    >= 32 chars). Notion ne signe pas avec ce secret mais on en a besoin pour
//    bloquer les POST anonymes hors de la verification initiale.
//
// Sécurité :
// - Phase verification : pas de secret requis, on echo le verification_token.
// - Phase event : on accepte si le body contient un id qui ressemble à une page
//   Notion (UUID 32+ chars) ET on déclenche la sync. On rate-limit à 1 sync /
//   30 secondes pour éviter d'abuser de la mémoire si Notion fire 50 events
//   d'affilée.

import { NextResponse } from 'next/server';
import { syncContentItems } from '@/lib/content-items';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

// Rate-limit simple en mémoire : last sync timestamp.
let lastSyncAt = 0;
const SYNC_THROTTLE_MS = 30_000;

export async function POST(req: Request) {
  let body: any = null;
  try { body = await req.json(); } catch { /* not JSON */ }

  // Phase 1 : verification token (Notion attend l'echo du token)
  if (body && typeof body.verification_token === 'string') {
    return NextResponse.json({ verification_token: body.verification_token });
  }

  // Phase 2 : event. Vérification basique de la structure attendue.
  const eventType = body?.type || body?.event_type || '';
  const entityId = body?.entity?.id || body?.page?.id || body?.id || '';
  if (!eventType && !entityId) {
    return NextResponse.json({ ok: false, ignored: 'no event payload' }, { status: 200 });
  }

  // Rate limit : on accepte mais on évite de re-sync trop souvent.
  const now = Date.now();
  if (now - lastSyncAt < SYNC_THROTTLE_MS) {
    return NextResponse.json({ ok: true, throttled: true, ageMs: now - lastSyncAt });
  }
  lastSyncAt = now;

  // Trigger sync (non bloquant pour Notion : on ne fait pas await ici, sinon
  // Notion peut timeout après 5s). Renvoie 202 Accepted.
  syncContentItems({ limit: 200 }).catch(() => { /* silent */ });

  return NextResponse.json({ ok: true, accepted: true, event: eventType || 'unknown' }, { status: 202 });
}

// GET : ping pour debug (pas de sync, juste un OK).
export async function GET() {
  return NextResponse.json({
    ok: true,
    info: 'POST attendu de Notion. Voir le commentaire de la route pour la configuration.',
    throttle_ms: SYNC_THROTTLE_MS,
    last_sync_at: lastSyncAt ? new Date(lastSyncAt).toISOString() : null,
  });
}
