import { NextRequest, NextResponse } from 'next/server';
import { chatList, chatAppend } from '@/lib/db';
import { getCredential } from '@/lib/credentials';
import { readStyleMemory } from '@/lib/style-memory';
import { BANNED_LIST } from '@/lib/voice-rules';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 60;

// V25.7 — SYSTEM aligné sur la voix Cadence enrichie (anti-patterns V25.1
// intensifiers/transitions AI/weasel/tells académiques/symbolisme creux).
// Mirror du SYSTEM_BASE du /api/chat/stream pour cohérence stream <> fallback.
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

Tu renvoies UNIQUEMENT le post réécrit, sans préambule ni explication.`;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get('notion_page_id');
  if (!id) return NextResponse.json({ error: 'notion_page_id required' }, { status: 400 });
  try { return NextResponse.json({ messages: await chatList(id) }); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { notion_page_id, draft, instruction } = body as { notion_page_id?: string; draft?: string; instruction?: string };
  if (!notion_page_id || !draft || !instruction) return NextResponse.json({ error: 'notion_page_id, draft and instruction required' }, { status: 400 });
  const { value: key } = await getCredential('anthropic');
  if (!key) return NextResponse.json({ error: 'ANTHROPIC_API_KEY manquante' }, { status: 400 });

  try {
    await chatAppend(notion_page_id, 'user', instruction);

    // V25.7 — Style memory injection si dispo.
    let styleAddendum = '';
    try {
      const mem = await readStyleMemory();
      if (mem && mem.posts_analyzed >= 5 && mem.voice_summary) {
        styleAddendum = `\n\nSIGNATURE STYLISTIQUE OBSERVÉE :\n${mem.voice_summary}\n\nRespectez cette signature dans la réécriture.`;
      }
    } catch { /* silent */ }

    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: SYSTEM_BASE + styleAddendum,
      messages: [{ role: 'user', content: `Draft actuel :\n---\n${draft}\n---\n\nInstruction : ${instruction}\n\nRéécris le post complet en appliquant l'instruction. Renvoie SEULEMENT le texte.` }]
    });
    const rewrite = msg.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n').trim();
    await chatAppend(notion_page_id, 'assistant', rewrite);
    return NextResponse.json({ rewrite });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
