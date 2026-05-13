'use client';

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

function renderText(text: string): React.ReactNode {
  // Auto-detect hashtags and render in brand color
  const parts = text.split(/(#[a-zA-Z0-9_]+)/g);
  return parts.map((p, i) => p.startsWith('#') ? <span key={i} className="text-brand-700 font-medium">{p}</span> : p);
}

export default function LinkedInPreview({ text, name = 'Cyril Coulange', headline = 'Founder · Heelio', avatar, image }: { text: string; name?: string; headline?: string; avatar?: string; image?: string }) {
  const limit = 250;
  const truncated = text.length > limit;
  return (
    <div className="bg-white rounded-2xl shadow-card ring-1 ring-inset ring-ink-300/20 overflow-hidden max-w-[552px] mx-auto">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-semibold text-lg shrink-0">
            {avatar ? <img src={avatar} alt="" className="w-full h-full rounded-full object-cover" /> : 'CC'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-ink-900 leading-tight">{name}</div>
            <div className="text-[12px] text-ink-500 leading-tight mt-0.5">{headline}</div>
            <div className="text-[12px] text-ink-500 leading-tight mt-0.5">à l'instant · 🌐</div>
          </div>
        </div>
        <div className="mt-3 text-[14px] text-ink-900 leading-[1.5] whitespace-pre-wrap break-words">
          {truncated ? <>{renderText(text.slice(0, limit))}<span className="text-ink-500">…voir plus</span></> : renderText(text)}
        </div>
      </div>
      {image && (
        <div className="bg-ink-50 border-y border-ink-100">
          {image.startsWith('<svg') ? <div className="w-full" dangerouslySetInnerHTML={{ __html: image }} /> : <img src={image} alt="" className="w-full h-auto" />}
        </div>
      )}
      <div className="px-4 py-2 text-[11px] text-ink-400 border-t border-ink-100 italic">Aperçu LinkedIn — réactions, commentaires et stats apparaîtront après publication.</div>
    </div>
  );
}
