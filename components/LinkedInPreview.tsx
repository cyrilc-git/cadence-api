'use client';

// Unicode bold/italic mappings for LinkedIn-compatible "rich text" formatting.
// LinkedIn doesn't support markdown — these are mathematical alphanumeric symbols.
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
  m['h'] = String.fromCodePoint(0x210E); // special case
  return m;
})();
export function toBold(s: string): string { return s.split('').map(c => UC_BOLD[c] || c).join(''); }
export function toItalic(s: string): string { return s.split('').map(c => UC_ITAL[c] || c).join(''); }

export default function LinkedInPreview({ text, name = 'Cyril Coulange', headline = 'Founder · Heelio', avatar, image }: { text: string; name?: string; headline?: string; avatar?: string; image?: string }) {
  const lines = (text || '').split('\n');
  const truncated = text.length > 250;
  const visible = truncated ? text.slice(0, 250) + '… ' : text;
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
          {truncated ? <>{visible}<button className="text-ink-500 hover:underline">…voir plus</button></> : text}
        </div>
      </div>
      {image && (
        <div className="bg-ink-50 border-y border-ink-100">
          {image.startsWith('<svg') ? <div className="w-full" dangerouslySetInnerHTML={{ __html: image }} /> : <img src={image} alt="" className="w-full h-auto" />}
        </div>
      )}
      <div className="px-4 py-2 flex items-center justify-between text-[12px] text-ink-500 border-t border-ink-100">
        <div className="flex items-center gap-1">👍❤️🎯 <span className="ml-1">42</span></div>
        <div>3 commentaires · 1 republication</div>
      </div>
      <div className="grid grid-cols-4 border-t border-ink-100 text-[12px] text-ink-600">
        <button className="py-2 hover:bg-ink-50">👍 J'aime</button>
        <button className="py-2 hover:bg-ink-50">💬 Commenter</button>
        <button className="py-2 hover:bg-ink-50">🔁 Republier</button>
        <button className="py-2 hover:bg-ink-50">📤 Envoyer</button>
      </div>
    </div>
  );
}
