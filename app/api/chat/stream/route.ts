import { NextRequest } from 'next/server';
import { chatAppend } from '@/lib/db';
import { getCredential } from '@/lib/credentials';
import { readStyleMemory } from '@/lib/style-memory';
import { BANNED_LIST } from '@/lib/voice-rules';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 60;

// V25.7 — Le SYSTEM prompt du rewrite est désormais aligné sur la voix
// Cadence enrichie. On ajoute les anti-patterns V25.1 (intensifiers,
// transitions AI, weasel, tells académiques, symbolisme creux, etc.)
// pour que les réécritures respectent les mêmes règles que la génération
// from-scratch. Si la mémoire stylistique est dispo (>= 5 posts), on
// injecte la voice_summary pour respecter la signature personnelle.
const SYSTEM_BASE = `Tu es l'assistant éditorial Cadence de Cyril Coulange (fondateur Heelio).

Tu reçois un draft de post LinkedIn et tu l'améliores selon une instruction utilisateur.

VOIX NON NÉGOCIABLE
- Vouvoiement systématique (jamais "tu", "toi", "ton").
- Founder voice (Cyril, fondateur Heelio · pas DAF freelance).
- Tonalité : expert · simple · avisé · proximité · concret · fiable.
- Hook concret-imagé en 1ère ligne. Leçon implicite (jamais assénée).
- Orthographe française complète : accents é è ê à â î ô û ç systématiques.

INTERDICTIONS (source unique lib/voice-rules)
${BANNED_LIST}

LONGUEUR
- Conserver la cible 200-1300 caractères (optimal 600-900).
- Paragraphes aérés, exemples chiffrés simples, cas anonymisés.

Tu renvoies UNIQUEMENT le post réécrit, sans préambule ni explication. Le texte sera utilisable tel quel.`;

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

        // V25.7 — Injection de la signature stylistique si dispo. Pas
        // d'await long : on tente, sinon on tombe sur SYSTEM_BASE seul.
        let styleAddendum = '';
        try {
          const mem = await readStyleMemory();
          if (mem && mem.posts_analyzed >= 5 && mem.voice_summary) {
            styleAddendum = `\n\nSIGNATURE STYLISTIQUE OBSERVÉE (mémoire de voix) :\n${mem.voice_summary}\n\nRespectez cette signature dans la réécriture (longueur, densité, registre).`;
          }
        } catch { /* silent */ }

        const client = new Anthropic({ apiKey: key });
        const anthropicStream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          system: SYSTEM_BASE + styleAddendum,
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
