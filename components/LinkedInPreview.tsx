'use client';

import { useState } from 'react';

// Unicode helpers for "bold" / "italic" toolbar inserts (math sans-serif planes)
const UC_BOLD: Record<string,string> = (() => {
  const m: Record<string,string> = {};
  const A='A'.charCodeAt(0), Z='Z'.charCodeAt(0), a='a'.charCodeAt(0), z='z'.charCodeAt(0), z0='0'.charCodeAt(0), z9='9'.charCodeAt(0);
  for (let i=A;i<=Z;i++) m[String.fromCharCode(i)] = String.fromCodePoint(0x1D400 + (i-A));
  for (let i=a;i<=z;i++) m[String.fromCharCode(i)] = String.fromCodePoint(0x1D41A + (i-a));
  for (let i=z0;i<=z9;i++) m[String.fromCharCode(i)] = String.fromCodePoint(0x1D7CE + (i-z0));
  return m;
})();
const UC_ITAL: Record<string,string> = (() => {
  const m: Record<string,string> = {};
  const A='A'.charCodeAt(0), Z='Z'.charCodeAt(0), a='a'.charCodeAt(0), z='z'.charCodeAt(0);
  for (let i=A;i<=Z;i++) m[String.fromCharCode(i)] = String.fromCodePoint(0x1D434 + (i-A));
  for (let i=a;i<=z;i++) m[String.fromCharCode(i)] = String.fromCodePoint(0x1D44E + (i-a));
  m['h'] = String.fromCodePoint(0x210E);
  return m;
})();
export function toBold(s: string): string { return s.split('').map(c => UC_BOLD[c] || c).join(''); }
export function toItalic(s: string): string { return s.split('').map(c => UC_ITAL[c] || c).join(''); }
// V15.3 — Formats LinkedIn natifs (texte brut + Unicode), pas de HTML.
// LinkedIn rend les caractères Unicode et préserve les sauts de ligne.
// On ajoute trois transforms pour la toolbar de sélection.
export function toBulletList(s: string): string {
  // Chaque ligne non-vide devient "• ligne". Si déjà préfixée, on ne re-préfixe pas.
  return s.split('\n').map(line => {
    const t = line.trimStart();
    if (!t) return line;
    if (/^[•·\-▸▪]\s/.test(t)) return line;
    const indent = line.slice(0, line.length - t.length);
    return `${indent}• ${t}`;
  }).join('\n');
}
export function toQuote(s: string): string {
  // Englobe la sélection avec guillemets français + tirets de respiration.
  // Si déjà entouré, on enlève (toggle).
  const trimmed = s.trim();
  if (/^«\s.*\s»$/.test(trimmed)) return s.replace(/^(\s*)«\s/, '$1').replace(/\s»(\s*)$/, '$1');
  return `« ${s.trim()} »`;
}

function renderText(text: string, dark: boolean): React.ReactNode {
  // V8.2 — first pass : extract mentions @[Display](urn:li:type:id) and replace by <Mention>
  // Then handle hashtags + line breaks.
  const MENTION_RE = /@\[([^\]]+)\]\((urn:li:(person|organization|school):[^)\s]+)\)/g;
  const HASH_RE = /(#[a-zA-ZÀ-ÿ0-9_]+)/g;
  const blueClass = dark ? 'text-[#7bb6ff] font-medium' : 'text-[#0a66c2] font-medium';

  const lines = text.split('\n');
  return lines.map((line, li) => {
    // Split by mentions
    const segments: React.ReactNode[] = [];
    let last = 0;
    MENTION_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = MENTION_RE.exec(line)) !== null) {
      if (m.index > last) segments.push(...renderHashtags(line.slice(last, m.index), HASH_RE, blueClass, 's' + li + '_' + segments.length));
      const display = m[1];
      const urn = m[2];
      const isPerson = urn.startsWith('urn:li:person:');
      const url = isPerson ? `https://www.linkedin.com/in/${urn.split(':').pop()}/` : `https://www.linkedin.com/company/${urn.split(':').pop()}/`;
      segments.push(
        <a key={'m' + li + '_' + m.index} href={url} target="_blank" rel="noopener" className={blueClass + ' hover:underline'}>{display}</a>
      );
      last = MENTION_RE.lastIndex;
    }
    if (last < line.length) segments.push(...renderHashtags(line.slice(last), HASH_RE, blueClass, 't' + li));
    return (
      <span key={li}>
        {segments}
        {li < lines.length - 1 && <br />}
      </span>
    );
  });
}

function renderHashtags(text: string, re: RegExp, cls: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(#[a-zA-ZÀ-ÿ0-9_]+)/g);
  return parts.map((s, i) => s.startsWith('#')
    ? <span key={keyPrefix + '_' + i} className={cls}>{s}</span>
    : <span key={keyPrefix + '_' + i}>{s}</span>
  );
}

type Mode = 'desktop' | 'mobile';
type Theme = 'light' | 'dark';

export default function LinkedInPreview({
  text,
  name = 'Cyril Coulange',
  headline = 'Founder · Heelio · Trésorerie pour PME',
  avatar,
  image,
  showToolbar = true,
}: {
  text: string;
  name?: string;
  headline?: string;
  avatar?: string;
  image?: string;
  showToolbar?: boolean;
}) {
  const [mode, setMode] = useState<Mode>('desktop');
  const [theme, setTheme] = useState<Theme>('light');
  const [expanded, setExpanded] = useState(false);

  const limit = mode === 'mobile' ? 140 : 210;
  // V8.2 — mention-aware truncation : count plain (display name) length, not raw markers
  const plain = stripMentionsForCount(text);
  const truncated = plain.length > limit && !expanded;
  const visible = truncated ? truncatePreservingMentions(text, limit) : text;

  const isDark = theme === 'dark';
  const surface = isDark ? '#1B1F23' : '#FFFFFF';
  const textColor = isDark ? '#E7E9EA' : '#000000E0';
  const dimColor = isDark ? '#A0A8B0' : '#666F7A';
  const borderColor = isDark ? '#2D3338' : '#E0E0E0';

  const wrapperWidth = mode === 'mobile' ? 'max-w-[360px]' : 'max-w-[555px]';

  return (
    <div className="space-y-3">
      {showToolbar && (
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center bg-ink-100 rounded-lg p-0.5 gap-0.5">
            <button onClick={() => setMode('desktop')} className={`px-2.5 py-1 rounded-md font-medium transition ${mode === 'desktop' ? 'bg-white text-ink-900 shadow-xs' : 'text-ink-500'}`}>
              <svg className="w-3.5 h-3.5 inline -mt-0.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8 M12 16v4"/></svg>
              Desktop
            </button>
            <button onClick={() => setMode('mobile')} className={`px-2.5 py-1 rounded-md font-medium transition ${mode === 'mobile' ? 'bg-white text-ink-900 shadow-xs' : 'text-ink-500'}`}>
              <svg className="w-3.5 h-3.5 inline -mt-0.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg>
              Mobile
            </button>
          </div>
          <div className="flex items-center bg-ink-100 rounded-lg p-0.5 gap-0.5">
            <button onClick={() => setTheme('light')} className={`px-2.5 py-1 rounded-md font-medium transition ${theme === 'light' ? 'bg-white text-ink-900 shadow-xs' : 'text-ink-500'}`}>Clair</button>
            <button onClick={() => setTheme('dark')} className={`px-2.5 py-1 rounded-md font-medium transition ${theme === 'dark' ? 'bg-white text-ink-900 shadow-xs' : 'text-ink-500'}`}>Sombre</button>
          </div>
          <div className="ml-auto text-2xs text-ink-400 font-medium">{plainCount(text)} caractères</div>
        </div>
      )}

      <div className={`mx-auto ${wrapperWidth} animate-fade-in`}>
        <div
          className="rounded-xl overflow-hidden shadow-card"
          style={{ backgroundColor: surface, color: textColor, border: `1px solid ${borderColor}` }}
        >
          {/* Author header */}
          <div className="px-4 pt-3 pb-2 flex items-start gap-2.5">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-semibold text-base shrink-0">
              {avatar ? <img src={avatar} alt="" className="w-full h-full rounded-full object-cover" /> : 'CC'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[14px] font-semibold leading-tight" style={{ color: textColor }}>{name}</span>
                <span className="text-[12px]" style={{ color: dimColor }}>· 1er</span>
              </div>
              <div className="text-[12px] leading-tight mt-0.5 line-clamp-1" style={{ color: dimColor }}>{headline}</div>
              <div className="text-[12px] leading-tight mt-0.5 flex items-center gap-1" style={{ color: dimColor }}>
                <span>à l'instant</span>
                <span aria-hidden>·</span>
                <svg className="w-3 h-3 inline" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16zm-1-11h2v6h-2zm0-3h2v2h-2z"/></svg>
              </div>
            </div>
            <button className="p-1 rounded-full transition" style={{ color: dimColor }}>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
            </button>
            <button className="p-1 rounded-full transition" style={{ color: dimColor }}>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </div>

          {/* Post text */}
          <div className="px-4 pb-3 text-[14px] leading-[1.5] whitespace-pre-wrap break-words" style={{ color: textColor }}>
            {renderText(visible, isDark)}
            {truncated && <>{' '}<button onClick={() => setExpanded(true)} className="font-medium" style={{ color: dimColor }}>…voir plus</button></>}
          </div>

          {/* Image (or SVG visual) */}
          {image && (
            <div className="border-t border-b" style={{ borderColor }}>
              {image.startsWith('<svg') ? (
                <div className="w-full bg-white" dangerouslySetInnerHTML={{ __html: image }} />
              ) : (
                <img src={image} alt="" className="w-full h-auto" />
              )}
            </div>
          )}

          {/* Reactions row (visual only — no fake metrics) */}
          <div className="px-4 py-2 flex items-center text-[12px]" style={{ color: dimColor, borderTop: `1px solid ${borderColor}` }}>
            <div className="flex -space-x-1">
              <span className="w-4 h-4 rounded-full bg-[#0a66c2] flex items-center justify-center"><svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M2 8h4v12H2zm6.5 0h4v2c.6-1.4 2-2 4-2 3 0 5 2 5 5v7h-4v-6c0-1.5-1-2.5-2.5-2.5S12.5 12.5 12.5 14v6h-4V8zm-4.5-1.5a2 2 0 100-4 2 2 0 000 4z"/></svg></span>
              <span className="w-4 h-4 rounded-full bg-[#df704d] flex items-center justify-center text-[8px]">❤</span>
            </div>
            <span className="ml-2 italic">Aucune réaction, la publication n&apos;a pas encore eu lieu.</span>
          </div>

          {/* Actions row */}
          <div className="grid grid-cols-4 border-t" style={{ borderColor }}>
            {[
              { label: 'J\'aime', icon: 'M19.5 12.6a2 2 0 00-1.8-2H14V6.4a2 2 0 00-2-2 2 2 0 00-2 2v.3l-3 5.9v7h8.4a2 2 0 002-1.8l1-5.2zM4 12h2v8H4z' },
              { label: 'Commenter', icon: 'M21 12c0 4.4-4 8-9 8-1.4 0-2.8-.3-4-.8L3 21l1.5-4C3.5 15.7 3 13.9 3 12c0-4.4 4-8 9-8s9 3.6 9 8z' },
              { label: 'Republier', icon: 'M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3' },
              { label: 'Envoyer', icon: 'M22 2L11 13M22 2l-7 20-4-9-9-4z' },
            ].map(a => (
              <button key={a.label} className="flex items-center justify-center gap-1.5 py-2 text-[13px] font-medium transition" style={{ color: dimColor }}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d={a.icon}/></svg>
                <span className="hidden sm:inline">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


// V8.2 — mention markers @[Display](urn:...) are stored but only the display_name counts toward LinkedIn char limit
const MENTION_RE_GLOBAL = /@\[([^\]]+)\]\(urn:li:(?:person|organization|school):[^)\s]+\)/g;

function stripMentionsForCount(text: string): string {
  return text.replace(MENTION_RE_GLOBAL, (_, display) => display);
}

function plainCount(text: string): number {
  return stripMentionsForCount(text).length;
}

// Truncate based on visible plain length, preserve mention markers entirely (never cut inside an @[](urn:))
function truncatePreservingMentions(text: string, limit: number): string {
  const re = /@\[([^\]]+)\]\((urn:li:(?:person|organization|school):[^)\s]+)\)/g;
  let plainCount = 0;
  let last = 0;
  let out = '';
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const segment = text.slice(last, m.index);
    for (const ch of segment) {
      if (plainCount >= limit) return out;
      out += ch;
      plainCount++;
    }
    const display = m[1];
    if (plainCount + display.length > limit) {
      // Don't include this mention if it would overflow
      return out;
    }
    out += m[0]; // include the full marker
    plainCount += display.length;
    last = re.lastIndex;
  }
  for (const ch of text.slice(last)) {
    if (plainCount >= limit) return out;
    out += ch;
    plainCount++;
  }
  return out;
}
