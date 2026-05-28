import { NextResponse } from 'next/server';
import { upsertDraft, replacePageContent, listNotionPosts } from '@/lib/notion';
import { markCadenceDraft } from '@/lib/db';
import { syncContentItems } from '@/lib/content-items';

export const runtime = 'nodejs';
// V36.1 — Import LinkedIn ZIP peut prendre plusieurs minutes sur des
// gros volumes (100+ posts) avec throttle Notion 3 req/s. On monte le
// timeout pour ne pas couper l'import à mi-chemin.
export const maxDuration = 300;

// V36.1 — Throttle Notion 3 req/s avec retry exponentiel sur 429.
// Notion API publique limite à ~3 requêtes/seconde par intégration.
// Avant ce fix : batch import de 95 posts → 2 erreurs 429 + perte de
// données. Maintenant : on espace les writes et on retry jusqu'à 3 fois.
const NOTION_MIN_DELAY_MS = 350;
let notionLastCall = 0;
async function notionThrottle() {
  const now = Date.now();
  const elapsed = now - notionLastCall;
  if (elapsed < NOTION_MIN_DELAY_MS) {
    await new Promise(r => setTimeout(r, NOTION_MIN_DELAY_MS - elapsed));
  }
  notionLastCall = Date.now();
}

async function withRetry429<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    await notionThrottle();
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const msg = e?.message || '';
      // 429 rate limit ou 5xx → on backoff
      if (/429|rate_limit|503|502|504/i.test(msg)) {
        const wait = 1500 * Math.pow(2, attempt); // 1.5s, 3s, 6s
        console.warn(`[notion-import] ${label} 429/5xx (tentative ${attempt + 1}/3) — pause ${wait}ms`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw e; // erreur non rate-limit : on remonte direct
    }
  }
  throw lastErr;
}

// V9.4 — Import LinkedIn enrichi : statut détaillé par post, dédup explicite, log structuré.
// V10.4.3 — Auto-sync content_items après import si created > 0 (non bloquant pour la
//           réponse, mais on attend pour avoir le résumé canonical à jour).

type Incoming = { date: string; text: string; url?: string; sharedUrl?: string; media?: string };
type ResultStatus = 'created' | 'duplicate' | 'error' | 'invalid';
type ResultItem = { index: number; status: ResultStatus; title?: string; error?: string };

// V51 §5 — On ne conserve une couverture que si le média est une URL https
// vers le CDN LinkedIn (licdn). Évite d'injecter une URL douteuse dans la
// couverture Notion (garde-fou « pas de faux état »).
function safeMediaUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:') return undefined;
    const host = u.hostname.toLowerCase();
    if (host !== 'licdn.com' && !host.endsWith('.licdn.com')) return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

// La propriété Notion « URL » attend une URL valide : on ne pousse que des
// liens LinkedIn http(s) bien formés (host exactement linkedin.com ou un
// sous-domaine, jamais un homographe type evil-linkedin.com).
function safeShareUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return undefined;
    const host = u.hostname.toLowerCase();
    if (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const incoming: Incoming[] = Array.isArray(body.posts) ? body.posts.slice(0, 100) : [];
    if (!incoming.length) return NextResponse.json({ error: 'Aucun post à importer' }, { status: 400 });

    // Dédup : hash par (date prefix + first 60 chars titre)
    const existing = await listNotionPosts(200).catch(() => []);
    const sigs = new Set(existing.map(p => `${(p.scheduled_at || '').slice(0, 10)}|${(p.title || '').slice(0, 60).toLowerCase()}`));

    const results: ResultItem[] = [];
    let created = 0, skipped = 0, errors = 0;

    for (let i = 0; i < incoming.length; i++) {
      const p = incoming[i];
      if (!p?.text) {
        results.push({ index: i, status: 'invalid', error: 'Texte manquant' });
        skipped++;
        continue;
      }
      const dateOnly = (p.date || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
      const title = (p.text.split('\n')[0] || '').slice(0, 80) || 'Post LinkedIn (importé)';
      const sig = `${dateOnly}|${title.slice(0, 60).toLowerCase()}`;
      if (sigs.has(sig)) {
        results.push({ index: i, status: 'duplicate', title });
        skipped++;
        continue;
      }
      try {
        // V36.1 — Chaque call Notion passe par withRetry429 + throttle.
        // upsertDraft + replacePageContent = 2 calls par post (+ ajout
        // de blocs si paragraphes multiples). On les espace tous.
        const result = await withRetry429(
          () => upsertDraft({
            title,
            pilier: undefined,
            date: dateOnly,
            time: '07:30',
            anonymisation_ok: true,
            // V51 §5 — On conserve le lien d'origine (ShareLink) et le média.
            url: safeShareUrl(p.url),
            cover: safeMediaUrl(p.media),
          }),
          `upsertDraft ${i}`,
        );
        await withRetry429(
          () => replacePageContent(result.id, p.text),
          `replaceContent ${i}`,
        );
        await markCadenceDraft(result.id, 'linkedin_archive').catch(() => {});
        // Ajoute sa signature pour éviter qu'un doublon dans la même batch passe deux fois
        sigs.add(sig);
        results.push({ index: i, status: 'created', title });
        created++;
      } catch (e: any) {
        results.push({ index: i, status: 'error', title, error: e?.message || 'Erreur Notion' });
        errors++;
      }
    }

    // V10.4.3 — Sync content_items immédiate si des posts ont été créés.
    // Best effort : on logge mais on ne fail pas la réponse import si la sync échoue.
    let synced: { fromNotion: number; fromEmbeddings: number; errors: number } | null = null;
    if (created > 0) {
      try {
        const res = await syncContentItems({ limit: 500 });
        synced = { fromNotion: res.fromNotion, fromEmbeddings: res.fromEmbeddings, errors: res.errors };
      } catch {
        synced = null;
      }
    }

    return NextResponse.json({
      created,
      skipped,
      errors,
      total: incoming.length,
      results,
      synced,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
