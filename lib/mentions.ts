// V8.2 — LinkedIn mentions parser, serializer, renderer
//
// FORMAT INTERNE (lisible humain, survit aux edits, simple à parser) :
//   Texte brut avec syntax inline : @[Display Name](urn:li:person:XXX) ou @[Heelio](urn:li:organization:YYY)
//
// AU PUBLISH : convertir vers LinkedIn UGC mention attributes
//   { text: "Hello Heelio !", attributes: [{ start: 6, length: 6, value: { ... } }] }
//
// AU RENDU UI : extraire mentions, afficher en bleu cliquable avec URL profile

export type MentionType = 'person' | 'company' | 'school';

export type ParsedMention = {
  type: MentionType;
  urn: string;
  display_name: string;
  start: number;        // offset dans le texte brut SANS les marqueurs (i.e. après serialize → publish text)
  length: number;       // length du display_name dans ce texte sans marqueurs
  raw_start: number;    // offset dans le texte SOURCE avec marqueurs
  raw_end: number;      // exclusive end
};

const MENTION_RE = /@\[([^\]]+)\]\((urn:li:(person|organization|school):[^)\s]+)\)/g;

// Parse le texte interne (avec marqueurs @[](urn:)) → mentions + texte plat
export function parseMentions(input: string): { plain: string; mentions: ParsedMention[] } {
  const mentions: ParsedMention[] = [];
  let plain = '';
  let last = 0;
  MENTION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MENTION_RE.exec(input)) !== null) {
    const before = input.slice(last, m.index);
    plain += before;
    const display = m[1];
    const urn = m[2];
    const typeFromUrn = urn.startsWith('urn:li:person:') ? 'person'
                      : urn.startsWith('urn:li:organization:') ? 'company'
                      : 'school';
    mentions.push({
      type: typeFromUrn,
      urn,
      display_name: display,
      start: plain.length,
      length: display.length,
      raw_start: m.index,
      raw_end: MENTION_RE.lastIndex
    });
    plain += display;
    last = MENTION_RE.lastIndex;
  }
  plain += input.slice(last);
  return { plain, mentions };
}

// Serialize : input texte plat + mentions (offsets sur texte plat) → format interne avec marqueurs
export function serializeMentions(plain: string, mentions: Array<Omit<ParsedMention, 'raw_start'|'raw_end'|'length'>>): string {
  // Sort by start position descending so we can splice without shifting offsets
  const sorted = [...mentions].sort((a, b) => b.start - a.start);
  let out = plain;
  for (const m of sorted) {
    const end = m.start + m.display_name.length;
    if (out.slice(m.start, end) !== m.display_name) {
      // Mention text doesn't match anymore (user edited) → skip silently to keep text safe
      continue;
    }
    const marker = `@[${m.display_name}](${m.urn})`;
    out = out.slice(0, m.start) + marker + out.slice(end);
  }
  return out;
}

// Convert internal text → LinkedIn UGC postPayload shareCommentary structure
// Returns the plain text + attributes array compatible with LinkedIn API.
//
// Doc : https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/ugc-post-api#mention-an-organization-or-individual-in-a-share
export function toLinkedInPayload(input: string): {
  text: string;
  attributes: Array<{ start: number; length: number; value: any }>;
} {
  const { plain, mentions } = parseMentions(input);
  const attributes = mentions.map(m => ({
    start: m.start,
    length: m.length,
    value: m.type === 'person'
      ? { 'com.linkedin.common.MemberAttributedEntity': { member: m.urn } }
      : { 'com.linkedin.common.CompanyAttributedEntity': { company: m.urn } }
  }));
  return { text: plain, attributes };
}

// Strip mention markers entirely → text only (for char count, lint, etc.)
export function stripMentions(input: string): string {
  return parseMentions(input).plain;
}

// Convert AT TYPING the user input "@xx" — find current mention query at caret position
// Returns null if caret is not inside a typing-mention (no @ before caret without space/newline interruption)
export function detectMentionQuery(text: string, caret: number): { trigger: number; query: string } | null {
  // Walk backward from caret to find '@' (or stop at whitespace/newline/already-matched mention)
  for (let i = caret - 1; i >= 0; i--) {
    const c = text[i];
    if (c === '@') {
      // Make sure it's not part of an already-completed mention @[...](...)
      // Already-completed will have @[ right after, but if caret is in the middle of one we stop.
      if (text[i + 1] === '[') return null; // already in a completed mention
      // Make sure preceded by whitespace or start
      if (i > 0 && /\S/.test(text[i - 1])) return null;
      return { trigger: i, query: text.slice(i + 1, caret) };
    }
    if (/[\s]/.test(c)) return null;
    if (i < caret - 40) return null; // limit query length
  }
  return null;
}

// Insert a mention at the current caret position (replacing the typing query)
export function insertMentionAtCaret(text: string, caret: number, entity: { display_name: string; urn: string }): { text: string; caret: number } {
  const detection = detectMentionQuery(text, caret);
  if (!detection) {
    const marker = `@[${entity.display_name}](${entity.urn}) `;
    return { text: text.slice(0, caret) + marker + text.slice(caret), caret: caret + marker.length };
  }
  const before = text.slice(0, detection.trigger);
  const after = text.slice(caret);
  const marker = `@[${entity.display_name}](${entity.urn}) `;
  return { text: before + marker + after, caret: before.length + marker.length };
}

// Render to React-safe segments : [text|mention,text,text|mention,...]
export type RenderSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; entity: ParsedMention };

export function toSegments(input: string): RenderSegment[] {
  const segments: RenderSegment[] = [];
  let last = 0;
  MENTION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MENTION_RE.exec(input)) !== null) {
    if (m.index > last) segments.push({ type: 'text', value: input.slice(last, m.index) });
    const display = m[1];
    const urn = m[2];
    const typeFromUrn = urn.startsWith('urn:li:person:') ? 'person'
                      : urn.startsWith('urn:li:organization:') ? 'company'
                      : 'school';
    segments.push({
      type: 'mention',
      entity: {
        type: typeFromUrn,
        urn,
        display_name: display,
        start: 0, length: display.length, raw_start: m.index, raw_end: MENTION_RE.lastIndex
      }
    });
    last = MENTION_RE.lastIndex;
  }
  if (last < input.length) segments.push({ type: 'text', value: input.slice(last) });
  return segments;
}

// URL helper : LinkedIn entity URN → public profile URL (best-effort; depends on cached handle)
export function urnToProfileUrl(urn: string, handle?: string): string {
  if (urn.startsWith('urn:li:person:') && handle) return `https://www.linkedin.com/in/${handle}/`;
  if (urn.startsWith('urn:li:organization:') && handle) return `https://www.linkedin.com/company/${handle}/`;
  // Fallback : LinkedIn search by URN slug
  const slug = urn.split(':').pop() || '';
  return `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(slug)}`;
}
