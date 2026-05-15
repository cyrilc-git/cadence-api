'use client';

import { useState } from 'react';

type ParsedPost = { date: string; text: string; url?: string; sharedUrl?: string };

function parseSharesCsv(text: string): ParsedPost[] {
  // LinkedIn Shares.csv has a header line. Columns vary slightly by export year.
  // Common columns : Date, ShareLink, ShareCommentary, SharedUrl, MediaUrl, Visibility
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const header = parseCsvRow(lines[0]).map(s => s.trim().toLowerCase());
  const idx = (name: string) => header.findIndex(h => h.includes(name));
  const idxDate = idx('date');
  const idxLink = idx('sharelink');
  const idxText = idx('sharecommentary');
  const idxShared = idx('sharedurl');
  const out: ParsedPost[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvRow(lines[i]);
    if (cells.length < 2) continue;
    const date = (idxDate >= 0 ? cells[idxDate] : '').trim();
    const text = (idxText >= 0 ? cells[idxText] : '').trim();
    if (!date || !text) continue;
    out.push({
      date,
      text,
      url: idxLink >= 0 ? cells[idxLink].trim() : undefined,
      sharedUrl: idxShared >= 0 ? cells[idxShared]?.trim() : undefined
    });
  }
  return out;
}

function parseCsvRow(row: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (inQuote) {
      if (c === '"') {
        if (row[i+1] === '"') { cur += '"'; i++; }
        else inQuote = false;
      } else cur += c;
    } else {
      if (c === ',') { out.push(cur); cur = ''; }
      else if (c === '"') inQuote = true;
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

export default function LinkedInImportClient() {
  const [posts, setPosts] = useState<ParsedPost[]>([]);
  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number } | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null); setImportResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const text = ev.target?.result as string;
        const parsed = parseSharesCsv(text);
        if (parsed.length === 0) throw new Error('Aucun post trouvé dans ce fichier. Vérifiez que c\'est bien Shares.csv.');
        setPosts(parsed);
      } catch (e: any) { setError(e.message); }
    };
    reader.onerror = () => setError('Lecture du fichier impossible');
    reader.readAsText(file, 'utf-8');
  }

  async function importToNotion() {
    if (!confirm(`Importer ${posts.length} posts dans Notion ? Chaque post sera créé comme draft « Publié » avec source = linkedin_archive. Cadence ne modifiera pas vos posts existants.`)) return;
    setImporting(true); setError(null);
    try {
      const r = await fetch('/api/sources/linkedin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posts: posts.slice(0, 100) }) // hard cap to 100 per import
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setImportResult({ created: d.created, skipped: d.skipped });
    } catch (e: any) { setError(e.message); }
    finally { setImporting(false); }
  }

  return (
    <section className="card p-5">
      <h2 className="font-semibold text-ink-900">Upload Shares.csv</h2>
      <p className="text-xs text-ink-500 mt-0.5">Le parsing se fait <strong>côté navigateur</strong> (RGPD). Le contenu n'est envoyé à Cadence qu'au moment où vous cliquez « Importer ».</p>

      <label className="mt-4 block cursor-pointer">
        <div className="card p-6 border-dashed border-2 border-ink-200 hover:border-brand-300 hover:bg-brand-50/30 transition text-center">
          <svg className="w-8 h-8 mx-auto text-ink-400 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12"/></svg>
          <p className="text-sm text-ink-700">{filename ? <strong>{filename}</strong> : 'Glissez votre Shares.csv ici, ou cliquez pour choisir'}</p>
          <p className="text-2xs text-ink-500 mt-1">CSV jusqu'à 50 MB</p>
          <input type="file" accept=".csv,text/csv" hidden onChange={onFile} />
        </div>
      </label>

      {error && <div className="mt-3 p-3 rounded-lg bg-danger-50 border border-danger-100 text-sm text-danger-700">{error}</div>}

      {posts.length > 0 && (
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold text-ink-900">{posts.length} posts détectés</span>
              <span className="text-xs text-ink-500"> · max 100 importés par session</span>
            </div>
            <button onClick={importToNotion} disabled={importing} className="btn-primary">
              {importing ? 'Import en cours…' : `Importer ${Math.min(posts.length, 100)} posts dans Notion`}
            </button>
          </div>
          {importResult && (
            <div className="card p-3 border-success-100 bg-success-50/40 text-sm">
              <strong className="text-success-700">{importResult.created} créés</strong>
              {importResult.skipped > 0 && <span className="text-ink-500"> · {importResult.skipped} déjà présents (ignorés)</span>}
            </div>
          )}
          <div className="text-2xs uppercase tracking-wider font-semibold text-ink-500">Aperçu (5 premiers)</div>
          <div className="space-y-2">
            {posts.slice(0, 5).map((p, i) => (
              <div key={i} className="card p-3 border-ink-100 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-ink-500">{p.date}</span>
                  {p.url && <a href={p.url} target="_blank" rel="noopener" className="text-brand-700 hover:underline">Voir sur LinkedIn ↗</a>}
                </div>
                <div className="text-ink-800 whitespace-pre-wrap line-clamp-4">{p.text}</div>
              </div>
            ))}
          </div>
          {posts.length > 5 && <div className="text-xs text-ink-500">+{posts.length - 5} autres posts à importer.</div>}
        </div>
      )}
    </section>
  );
}
