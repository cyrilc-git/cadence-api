import { NextRequest, NextResponse } from 'next/server';
import { chatList, chatAppend } from '@/lib/db';
import { getCredential } from '@/lib/credentials';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM = `Tu es l'assistant éditorial Cadence de Cyril Coulange (fondateur Heelio).
Tu reçois un draft de post LinkedIn et tu aides à l'améliorer selon une instruction utilisateur.
Règles non négociables : vouvoiement systématique, founder voice (pas DAF freelance), aucun tiret long, aucun mot creux IA (seamless, robust, game changer, révolutionner, booster, libérer le potentiel, dans un monde où), pas de "ce n'est pas X c'est Y", pas de "Et vous ?" en fin. Conserve la longueur cible 200-1300 chars (optimal 600-900). Phrases courtes, paragraphes aérés, exemples chiffrés simples, cas anonymisés.
Tu renvoies UNIQUEMENT le post réécrit, sans préambule ni explication. Le texte renvoyé sera utilisable tel quel.`;

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
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Draft actuel :\n---\n${draft}\n---\n\nInstruction : ${instruction}\n\nRéécris le post complet en appliquant l'instruction. Renvoie SEULEMENT le texte.` }]
    });
    const rewrite = msg.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n').trim();
    await chatAppend(notion_page_id, 'assistant', rewrite);
    return NextResponse.json({ rewrite });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
