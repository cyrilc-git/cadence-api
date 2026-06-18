'use client';

// V57 — « Discuter avec Cadence ». Porte d'entree d'Ecrire quand on arrive sans
// sujet : on parle a Cadence (idees, angles, infographies, redaction) au lieu
// d'un formulaire. Tout post propose s'ouvre dans l'editeur en un clic (brouillon
// content_items via saveDraft).

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/Dialog';

type Msg = { role: 'user' | 'assistant'; content: string };

const STARTERS = [
  'Donne-moi 5 idées de posts sur la trésorerie',
  'Des idées d’infographie sur le BFR',
  'Rédige un post sur un closing qui a failli déraper',
  'J’ai une idée en tête, aide-moi à la creuser',
];

export default function ComposerClient() {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [opening, setOpening] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming]);

  const send = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || streaming) return;
    const next: Msg[] = [...messages, { role: 'user', content }];
    setMessages([...next, { role: 'assistant', content: '' }]);
    setInput('');
    setStreaming(true);
    const ac = new AbortController();
    try {
      const r = await fetch('/api/composer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }), signal: ac.signal,
      });
      if (!r.ok || !r.body) { const d = await r.json().catch(() => ({})); throw new Error(d.error || `HTTP ${r.status}`); }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let pending = '';
      let acc = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += dec.decode(value, { stream: true });
        const blocks = pending.split('\n\n');
        pending = blocks.pop() || '';
        for (const block of blocks) {
          const line = block.trim();
          if (!line.startsWith('data:')) continue;
          const json = line.slice(5).trim();
          if (!json) continue;
          let ev: any; try { ev = JSON.parse(json); } catch { continue; }
          if (ev.type === 'delta') { acc += ev.text; }
          else if (ev.type === 'done') { acc = ev.full || acc; }
          else if (ev.type === 'error') throw new Error(ev.message);
          setMessages(m => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: acc }; return c; });
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        const msg = '(Cadence n’a pas pu répondre : ' + (e?.message || 'erreur') + ')';
        setMessages(m => { const c = [...m]; if (c.length) c[c.length - 1] = { role: 'assistant', content: msg }; return c; });
      }
    } finally { setStreaming(false); }
  }, [messages, streaming]);

  const openInEditor = useCallback(async (content: string, idx: number) => {
    if (opening !== null) return;
    setOpening(idx);
    try {
      const firstLine = content.split('\n').map(l => l.trim()).find(Boolean) || 'Brouillon';
      const r = await fetch('/api/notion/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: firstLine.slice(0, 80), content }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Échec de la sauvegarde');
      router.push(`/posts/${d.id}/edit`);
    } catch (e: any) {
      toast.error('Impossible d’ouvrir dans l’éditeur : ' + e.message);
      setOpening(null);
    }
  }, [opening, router]);

  const empty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen max-w-2xl mx-auto px-5 lg:px-8">
      {/* Fil */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-8 space-y-6">
        {empty ? (
          <div className="h-full flex flex-col justify-center">
            <div className="space-y-3">
              <h1 className="text-2xl font-semibold text-ink-900 tracking-tight font-editorial">Parlez à Cadence.</h1>
              <p className="text-sm text-ink-500 leading-relaxed max-w-md">
                Demandez des idées, un angle, un post, des concepts d&apos;infographie. Cadence connaît votre voix, vos piliers et vos sujets. On discute, puis on ouvre dans l&apos;éditeur.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {STARTERS.map(s => (
                <button key={s} onClick={() => send(s)} className="text-sm text-left px-3.5 py-2 rounded-xl ring-1 ring-inset ring-ink-200 text-ink-700 hover:ring-brand-300 hover:bg-brand-50 transition">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => {
            const isUser = m.role === 'user';
            const isLast = i === messages.length - 1;
            const thinking = !isUser && isLast && streaming && !m.content;
            return (
              <div key={i} className={isUser ? 'flex justify-end' : 'flex justify-start'}>
                <div className={isUser ? 'max-w-[85%]' : 'w-full'}>
                  {isUser ? (
                    <div className="bg-brand-500 text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">{m.content}</div>
                  ) : (
                    <div>
                      <div className="text-2xs uppercase tracking-wider font-semibold text-ink-400 mb-1.5">Cadence</div>
                      {thinking ? (
                        <div className="flex items-center gap-1.5 text-ink-400 text-sm py-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-ink-300 animate-pulse" />
                          <span className="w-1.5 h-1.5 rounded-full bg-ink-300 animate-pulse" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-ink-300 animate-pulse" style={{ animationDelay: '300ms' }} />
                        </div>
                      ) : (
                        <article className="whitespace-pre-wrap text-[15px] text-ink-800 leading-relaxed">{m.content}</article>
                      )}
                      {!thinking && m.content && !(isLast && streaming) && (
                        <div className="mt-2.5">
                          <button
                            onClick={() => openInEditor(m.content, i)}
                            disabled={opening !== null}
                            className="text-xs text-brand-700 hover:text-brand-900 font-medium transition disabled:opacity-50"
                          >
                            {opening === i ? 'Ouverture…' : 'Ouvrir dans l’éditeur →'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Saisie */}
      <div className="shrink-0 pb-5 pt-2">
        <div className="rounded-2xl ring-1 ring-inset ring-ink-200 bg-white focus-within:ring-brand-300 transition px-3 py-2.5 flex items-end gap-2">
          <textarea
            ref={taRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            rows={1}
            placeholder="Écrivez à Cadence. Entrée pour envoyer, Maj+Entrée pour un retour à la ligne."
            className="flex-1 resize-none bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none leading-relaxed max-h-40 py-1"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || streaming}
            className="shrink-0 w-9 h-9 rounded-xl bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 transition disabled:opacity-40"
            aria-label="Envoyer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </div>
        <p className="mt-2 text-2xs text-ink-400 text-center">Cadence écrit dans votre voix. Rien n&apos;est publié sans votre validation.</p>
      </div>
    </div>
  );
}
