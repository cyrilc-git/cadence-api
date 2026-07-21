import { NextRequest } from 'next/server';
import { getCredential } from '@/lib/credentials';
import { readStyleMemory, buildStyleBlock } from '@/lib/style-memory';
import { inspirationsList } from '@/lib/db';
import { STATIC_VOICE, BANNED_LIST } from '@/lib/voice-rules';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 60;

// V57 — « Discuter avec Cadence » : un vrai fil conversationnel. Cyril parle à
// Cadence comme à un directeur éditorial (idées, angles, infographies, rédaction)
// au lieu d'un formulaire one-shot. Streaming SSE, même protocole que /api/chat/stream.

const SYSTEM = `Tu es Cadence, le directeur éditorial et ghostwriter LinkedIn de Cyril Coulange, fondateur de Heelio (pilotage de trésorerie pour PME et dirigeants).

Tu DISCUTES avec Cyril comme un vrai partenaire éditorial : tu donnes des idées, tu creuses un angle, tu proposes des posts ou des concepts d'infographie, tu poses LA bonne question quand il manque un détail concret. Direct, vif, jamais corporate.

CE QUE TU SAIS DE LUI
- Univers : trésorerie, BFR, prévisionnel de trésorerie, cash, DSO, marge, pilotage PME, DAF externalisé, FP&A. Produits : Heelio, Decode.
- Piliers éditoriaux : Lundi cas client, Mardi pédagogie sans jargon, Mercredi produit ou démo, Jeudi opinion mesurée, Vendredi build in public.
- Audience : dirigeants de PME, experts-comptables, DAF.

COMMENT TU RÉPONDS EN CONVERSATION
- Naturel, concis, concret. Pas de blabla, pas de listes interminables.
- Quand il demande des idées : propose 3 à 5 angles PRÉCIS (jamais génériques), chacun en une ligne, ancrés sur son terrain (montants, délais, arbitrages réels).
- Quand il demande une infographie : propose des concepts visuels concrets (avant/après chiffré, timeline d'un closing, schéma d'un flux de trésorerie, comparaison DSO) en décrivant ce que montre le visuel.
- Quand il demande de rédiger un post : écris le post COMPLET, prêt à publier, en respectant la VOIX ci-dessous, et rien d'autre autour (pas de « voici votre post »).

VOIX QUAND TU RÉDIGES UN POST LINKEDIN (applique STRICTEMENT, uniquement pour le post rédigé, jamais pour la conversation autour)
${STATIC_VOICE}

INTERDICTIONS ABSOLUES DANS LE POST
${BANNED_LIST}

Cible 200 à 1300 caractères, paragraphes aérés, exemples chiffrés anonymisés.

Tu réponds toujours en français, avec les accents.`;

const DIM_TEXT: Record<string, string> = { tone: 'Ton et voix', structure: 'Structure et rythme', topics: 'Angles et sujets' };

async function buildContextAddendum(): Promise<string> {
  let add = '';
  try {
    // V58.9 — Bloc de voix riche (hooks réels + openings + vocabulaire), pas
    // seulement le résumé : le composer rédige des posts complets, il mérite la
    // même signature que la génération classique.
    const block = buildStyleBlock(await readStyleMemory());
    if (block) add += `\n\nSA VOIX (observée sur ses vrais posts, à respecter quand tu rédiges) :\n${block}`;
  } catch { /* silencieux */ }
  try {
    const all = await inspirationsList();
    const scoped = all
      .filter(i => i.active && i.style_notes)
      .map(i => {
        const dims = (i.dimensions && i.dimensions.length ? i.dimensions : ['tone', 'structure']).filter(d => d !== 'visual');
        if (!dims.length) return null;
        return `- [${dims.map(d => DIM_TEXT[d]).filter(Boolean).join(', ')}] ${i.style_notes}`;
      })
      .filter((x): x is string => !!x)
      .slice(0, 6);
    if (scoped.length) {
      add += `\n\nNOTES D'INSPIRATION (style abstrait, jamais à recopier ; applique seulement les leviers entre crochets) :\n${scoped.join('\n')}`;
    }
  } catch { /* silencieux */ }
  return add;
}

type Msg = { role: 'user' | 'assistant'; content: string };

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const messages = Array.isArray(body.messages) ? (body.messages as Msg[]) : [];
  const clean = messages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.slice(0, 8000) }))
    .slice(-20);
  if (!clean.length || clean[clean.length - 1].role !== 'user') {
    return new Response(JSON.stringify({ error: 'messages requis (le dernier doit être un message utilisateur)' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const { value: key } = await getCredential('anthropic');
  if (!key) {
    return new Response(JSON.stringify({ error: 'Clé Anthropic manquante.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const encoder = new TextEncoder();
  const sse = (payload: any) => encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);

  const stream = new ReadableStream({
    async start(controller) {
      let full = '';
      let cancelled = false;
      req.signal.addEventListener('abort', () => { cancelled = true; });
      try {
        const addendum = await buildContextAddendum();
        const client = new Anthropic({ apiKey: key });
        const anthropicStream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          system: SYSTEM + addendum,
          messages: clean,
        });

        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
        let buf = '';
        const SENTENCE_END = /[.!?]\s*$/;
        const WORD_END = /\s$/;
        async function flush(force = false) {
          if (!buf) return;
          if (!force && !WORD_END.test(buf) && buf.length < 24) return;
          const out = buf; buf = '';
          controller.enqueue(sse({ type: 'delta', text: out }));
          if (SENTENCE_END.test(out)) await sleep(40);
        }

        for await (const event of anthropicStream) {
          if (cancelled) { try { anthropicStream.controller.abort(); } catch { /* silencieux */ } break; }
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const piece = event.delta.text;
            full += piece; buf += piece;
            await flush(false);
          }
        }
        await flush(true);
        if (!cancelled) controller.enqueue(sse({ type: 'done', full: full.trim() }));
      } catch (e: any) {
        controller.enqueue(sse({ type: 'error', message: e?.message || 'erreur de flux' }));
      } finally {
        try { controller.close(); } catch { /* déjà fermé */ }
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    }
  });
}
