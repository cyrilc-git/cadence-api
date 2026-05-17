import { NextRequest } from 'next/server';
import { chatAppend } from '@/lib/db';
import { getCredential } from '@/lib/credentials';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM = `Tu es l'assistant éditorial Cadence de Cyril Coulange (fondateur Heelio).
Tu reçois un draft de post LinkedIn et tu aides à l'améliorer selon une instruction utilisateur.
Règles non négociables : vouvoiement systématique, founder voice (pas DAF freelance), aucun tiret long, aucun mot creux IA (seamless, robust, game changer, révolutionner, booster, libérer le potentiel, dans un monde où), pas de "ce n'est pas X c'est Y", pas de "Et vous ?" en fin. Conserve la longueur cible 200-1300 chars (optimal 600-900). Phrases courtes, paragraphes aérés, exemples chiffrés simples, cas anonymisés.
Tu renvoies UNIQUEMENT le post réécrit, sans préambule ni explication. Le texte renvoyé sera utilisable tel quel.`;

// V8.9 — vrai streaming SSE de l'IA. Format : événements `data: {"type":"delta","text":"..."}` puis `data: {"type":"done","full":"..."}` puis fermeture.
// Erreur : `data: {"type":"error","message":"..."}` puis fermeture.

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { notion_page_id, draft, instruction } = body as { notion_page_id?: string; draft?: string; instruction?: string };

  if (!notion_page_id || !draft || !instruction) {
    return new Response(JSON.stringify({ error: 'notion_page_id, draft and instruction required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  const { value: key } = await getCredential('anthropic');
  if (!key) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY manquante' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  const encoder = new TextEncoder();
  function sseEvent(payload: any): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      let full = '';
      let cancelled = false;
      req.signal.addEventListener('abort', () => { cancelled = true; });

      try {
        await chatAppend(notion_page_id, 'user', instruction);

        const client = new Anthropic({ apiKey: key });
        const anthropicStream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          system: SYSTEM,
          messages: [{
            role: 'user',
            content: `Draft actuel :\n---\n${draft}\n---\n\nInstruction : ${instruction}\n\nRéécris le post complet en appliquant l'instruction. Renvoie SEULEMENT le texte.`
          }]
        });

        // V9.1 §3 — Chunking naturel "Cadence tape" :
        // — accumule jusqu'à frontière mot/phrase, flush en chunks rythmés
        // — pause de 60ms après fin de phrase (.?!) pour respiration naturelle
        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
        let buf = '';
        const SENTENCE_END = /[.!?]\s*$/;
        const WORD_END = /\s$/;

        async function flush(force = false) {
          if (!buf) return;
          if (!force && !WORD_END.test(buf) && buf.length < 24) return;
          const out = buf;
          buf = '';
          controller.enqueue(sseEvent({ type: 'delta', text: out }));
          // Respiration : si on vient de finir une phrase, légère pause
          if (SENTENCE_END.test(out)) await sleep(60);
        }

        for await (const event of anthropicStream) {
          if (cancelled) {
            try { anthropicStream.controller.abort(); } catch { /* silent */ }
            break;
          }
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const piece = event.delta.text;
            full += piece;
            buf += piece;
            await flush(false);
          }
        }
        await flush(true);

        if (!cancelled) {
          const trimmed = full.trim();
          await chatAppend(notion_page_id, 'assistant', trimmed);
          controller.enqueue(sseEvent({ type: 'done', full: trimmed }));
        }
      } catch (e: any) {
        controller.enqueue(sseEvent({ type: 'error', message: e?.message || 'stream error' }));
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}
