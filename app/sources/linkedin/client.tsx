'use client';

// V9.1 §1 + V9.4 — Import LinkedIn premium et solide
// - Drag/drop full-zone (ZIP ou CSV).
// - Auto-extract ZIP via JSZip côté navigateur (RGPD).
// - Preview riche : count, range dates, top mots-clés.
// - Progress bar par batch (par 10 posts).
// - Statut détaillé par post : importé / doublon / erreur.
// - Résumé enrichi après import : période, piliers dominants, recyclables.
// - Dédup serveur (par date + 60 chars titre).
// - Après import : CTA "Reconstruire la mémoire éditoriale" (re-index embeddings).

import { useState, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import JSZip from 'jszip';

type ParsedPost = { date: string; text: string; url?: string; sharedUrl?: string };

function parseCsvRow(row: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (inQuote) {
      if (c === '"') {
        if (row[i + 1] === '"') { cur += '"'; i++; }
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

function parseSharesCsv(text: string): ParsedPost[] {
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

// Heuristique pour identifier le pilier d'un post à partir du texte
function inferPilier(text: string): string {
  const t = text.toLowerCase();
  if (/cas (client|dirigeant)|exemple|témoignage|chez/i.test(t)) return 'Cas client';
  if (/feature|on vient de sortir|nouveau|release|release note|update|démo|product/i.test(t)) return 'Produit';
  if (/à mon avis|je pense que|hot take|opinion|mon avis|le débat/i.test(t)) return 'Opinion';
  if (/build in public|cette semaine|mrr|churn|chiffres|transparence/i.test(t)) return 'Build in public';
  if (/pourquoi|comment|le \w+ en \d+|définition|c'est quoi/i.test(t)) return 'Pédagogie';
  return 'Autre';
}

// Top mots significatifs
function topWords(posts: ParsedPost[], n = 6): Array<{ word: string; count: number }> {
  const stop = new Set(['avec', 'pour', 'dans', 'cette', 'cest', 'cest', 'cest', 'cest', 'comme', 'aussi', 'plus', 'tout', 'tous', 'toutes', 'mais', 'sans', 'mais', 'ainsi', 'aussi', 'leurs', 'leur', 'votre', 'vous', 'nous', 'notre', 'nos', 'mes', 'mon', 'ses', 'son', 'sa', 'que', 'qui', 'des', 'les', 'une', 'aux', 'par', 'sur', 'cest', 'd', 'l', 'm', 'n', 's', 't', 'c', 'j']);
  const counts: Record<string, number> = {};
  for (const p of posts) {
    const words = p.text.toLowerCase().replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(w => w.length >= 4 && !stop.has(w));
    for (const w of words) counts[w] = (counts[w] || 0) + 1;
  }
  return Object.entries(counts).map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count).slice(0, n);
}

export default function LinkedInImportClient() {
  const [posts, setPosts] = useState<ParsedPost[]>([]);
  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: number; duplicates: number; synced?: { fromNotion: number; fromEmbeddings: number; errors: number } | null; results: Array<{ index: number; status: 'created'|'duplicate'|'error'|'invalid'; title?: string; error?: string }> } | null>(null);
  const [reindexing, setReindexing] = useState(false);
  const [reindexed, setReindexed] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setImportResult(null);
    setReindexed(null);
    setFilename(file.name);
    setParsing(true);
    try {
      let csvText = '';
      if (file.name.toLowerCase().endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file);
        const sharesFile = Object.values(zip.files).find(f => /shares\.csv$/i.test(f.name));
        if (!sharesFile) {
          throw new Error("Pas de Shares.csv trouvé dans le ZIP. Vérifiez que c'est bien l'archive LinkedIn officielle.");
        }
        csvText = await sharesFile.async('string');
      } else if (file.name.toLowerCase().endsWith('.csv')) {
        csvText = await file.text();
      } else {
        throw new Error('Format non supporté. Glissez le ZIP LinkedIn ou un Shares.csv.');
      }
      const parsed = parseSharesCsv(csvText);
      if (parsed.length === 0) {
        throw new Error("Aucun post trouvé. Le fichier est-il bien Shares.csv ?");
      }
      setPosts(parsed);
    } catch (e: any) {
      setError(e.message);
      setPosts([]);
    } finally {
      setParsing(false);
    }
  }, []);

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = '';
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!dragOver) setDragOver(true);
  }

  // Stats préview
  const stats = useMemo(() => {
    if (!posts.length) return null;
    const dates = posts.map(p => new Date(p.date).getTime()).filter(d => !isNaN(d)).sort((a, b) => a - b);
    const first = dates[0] ? new Date(dates[0]) : null;
    const last = dates[dates.length - 1] ? new Date(dates[dates.length - 1]) : null;
    const piliers: Record<string, number> = {};
    for (const p of posts) {
      const k = inferPilier(p.text);
      piliers[k] = (piliers[k] || 0) + 1;
    }
    const topPiliers = Object.entries(piliers).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const words = topWords(posts, 6);
    const avgLen = Math.round(posts.reduce((s, p) => s + p.text.length, 0) / posts.length);
    return { first, last, topPiliers, words, avgLen };
  }, [posts]);

  async function importToNotion() {
    if (!posts.length) return;
    if (!confirm(`Importer ${Math.min(posts.length, 200)} posts dans Notion ? Cadence évite les doublons automatiquement.`)) return;
    setImporting(true); setError(null); setImportResult(null);
    setProgress({ done: 0, total: Math.min(posts.length, 200) });
    try {
      const BATCH = 10;
      const toImport = posts.slice(0, 200);
      let totalCreated = 0, totalSkipped = 0, totalErrors = 0, totalDuplicates = 0;
      let lastSynced: { fromNotion: number; fromEmbeddings: number; errors: number } | null = null;
      const allResults: Array<{ index: number; status: 'created'|'duplicate'|'error'|'invalid'; title?: string; error?: string }> = [];
      for (let i = 0; i < toImport.length; i += BATCH) {
        const chunk = toImport.slice(i, i + BATCH);
        const r = await fetch('/api/sources/linkedin/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ posts: chunk })
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
        totalCreated += d.created || 0;
        totalSkipped += d.skipped || 0;
        totalErrors += d.errors || 0;
        if (d.synced) lastSynced = d.synced;
        const batchResults: any[] = Array.isArray(d.results) ? d.results : [];
        for (const br of batchResults) {
          allResults.push({ ...br, index: i + (br.index || 0) });
          if (br.status === 'duplicate') totalDuplicates++;
        }
        setProgress({ done: i + chunk.length, total: toImport.length });
      }
      setImportResult({ created: totalCreated, skipped: totalSkipped, errors: totalErrors, duplicates: totalDuplicates, synced: lastSynced, results: allResults });
    } catch (e: any) { setError(e.message); }
    finally { setImporting(false); setProgress(null); }
  }

  async function reindexMemory() {
    setReindexing(true); setError(null);
    try {
      const r = await fetch('/api/embeddings/index', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'linkedin_archive', limit: 200 }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setReindexed(d.indexed || 0);
    } catch (e: any) { setError('Reindex : ' + e.message); }
    finally { setReindexing(false); }
  }

  const showDropzone = !posts.length && !parsing;

  return (
    <section className="space-y-6" onDragOver={onDragOver}>
      {/* Dropzone */}
      <div
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 ${dragOver ? 'border-brand-500 bg-brand-50/60' : 'border-ink-200 hover:border-ink-300'} ${showDropzone ? 'p-12' : 'p-5'}`}
      >
        {parsing && (
          <div className="text-center py-6">
            <div className="inline-flex items-center gap-2 text-sm text-ink-600">
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse-soft" />
              Cadence lit votre archive…
            </div>
          </div>
        )}

        {showDropzone && (
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-ink-50 mx-auto mb-3 flex items-center justify-center text-ink-300 text-xl">↓</div>
            <p className="text-sm text-ink-700 font-medium">Glissez votre archive LinkedIn</p>
            <p className="mt-1 text-xs text-ink-500">ZIP officiel ou Shares.csv, tout reste dans votre navigateur jusqu&apos;à validation.</p>
            <label className="mt-4 inline-block">
              <span className="btn-primary text-xs cursor-pointer">Choisir un fichier</span>
              <input ref={fileInputRef} type="file" accept=".zip,.csv,text/csv" hidden onChange={onFileInput} />
            </label>
          </div>
        )}

        {posts.length > 0 && !parsing && (
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-success-100 flex items-center justify-center text-success-700 text-base shrink-0">✓</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink-900 truncate">{filename}</div>
              <div className="text-2xs text-ink-500">{posts.length} posts détectés</div>
            </div>
            <label className="text-xs text-ink-500 hover:text-ink-900 cursor-pointer transition">
              Changer
              <input type="file" accept=".zip,.csv,text/csv" hidden onChange={onFileInput} />
            </label>
          </div>
        )}

        {dragOver && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-brand-700 font-semibold text-sm bg-white/90 px-4 py-2 rounded-xl shadow-pop">Relâchez pour analyser</div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-danger-700">{error}</p>}

      {/* Stats préview */}
      {stats && (
        <section className="space-y-4 animate-fade-in">
          <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500">Ce que Cadence voit</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Période" value={stats.first && stats.last ? `${stats.first.getFullYear()} → ${stats.last.getFullYear()}` : '...'} />
            <Stat label="Posts" value={posts.length} />
            <Stat label="Longueur moy." value={`${stats.avgLen} car.`} />
            <Stat label="Sera importé" value={Math.min(posts.length, 200)} />
          </div>
          <div>
            <div className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-2">Piliers dominants</div>
            <div className="flex flex-wrap gap-1.5">
              {stats.topPiliers.map(([k, v]) => (
                <span key={k} className="text-xs px-2.5 py-1 rounded-md bg-ink-50 text-ink-700">
                  {k} <span className="text-ink-400 ml-1">{v}</span>
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-2">Sujets récurrents</div>
            <div className="flex flex-wrap gap-1.5">
              {stats.words.map(w => (
                <span key={w.word} className="text-xs px-2.5 py-1 rounded-md bg-ink-50 text-ink-700">
                  {w.word} <span className="text-ink-400 ml-1">{w.count}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Progress + import button */}
          {!importResult && (
            <div className="pt-2 border-t border-ink-100">
              {progress ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-ink-600">
                    <span>Import en cours…</span>
                    <span className="tabular-nums">{progress.done} / {progress.total}</span>
                  </div>
                  <div className="h-1 bg-ink-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 transition-all duration-300" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 flex-wrap">
                  <button onClick={importToNotion} disabled={importing} className="btn-primary text-sm">
                    {importing ? 'Import…' : `Importer ${Math.min(posts.length, 200)} posts`}
                  </button>
                  <span className="text-xs text-ink-500">Cadence détecte et ignore les doublons automatiquement.</span>
                </div>
              )}
            </div>
          )}

          {/* Résultat enrichi V9.4 */}
          {importResult && (
            <div className="pt-2 border-t border-ink-100 space-y-4 animate-fade-in">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ResultStat label="Importés"   value={importResult.created}    tone="success" />
                <ResultStat label="Doublons"   value={importResult.duplicates} tone="ink" />
                <ResultStat label="Erreurs"    value={importResult.errors}     tone={importResult.errors > 0 ? 'danger' : 'ink'} />
                <ResultStat label="Total traité" value={importResult.created + importResult.skipped} tone="ink" />
              </div>
              {stats && (
                <div className="rounded-lg border border-ink-100 p-3 text-xs text-ink-600 leading-relaxed">
                  <p>
                    Période couverte : {stats.first && stats.last
                      ? `${stats.first.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })} → ${stats.last.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`
                      : 'inconnue'}.
                    {' '}Longueur moyenne {stats.avgLen} caractères.
                  </p>
                  {stats.topPiliers.length > 0 && (
                    <p className="mt-1">
                      Piliers dominants : {stats.topPiliers.map(([k, v]) => `${k} (${v})`).join(', ')}.
                    </p>
                  )}
                  {(() => {
                    const oldCutoff = Date.now() - 90 * 86_400_000;
                    const recyclables = posts.filter(p => {
                      const t = new Date(p.date).getTime();
                      return !isNaN(t) && t < oldCutoff;
                    }).length;
                    if (recyclables === 0) return null;
                    return (
                      <p className="mt-1">
                        {recyclables} post{recyclables > 1 ? 's' : ''} publié{recyclables > 1 ? 's' : ''} depuis plus de 90 jours, candidat{recyclables > 1 ? 's' : ''} au recyclage.
                      </p>
                    );
                  })()}
                </div>
              )}
              {importResult.errors > 0 && (
                <details className="text-xs text-ink-500 hover:text-ink-700">
                  <summary className="select-none cursor-pointer">Voir le détail des {importResult.errors} erreur{importResult.errors > 1 ? 's' : ''}</summary>
                  <ul className="mt-2 space-y-1 pl-3 list-disc">
                    {importResult.results.filter(r => r.status === 'error').slice(0, 10).map((r, i) => (
                      <li key={i}>{r.title || `Post #${r.index + 1}`} : <span className="text-danger-700">{r.error || 'erreur inconnue'}</span></li>
                    ))}
                  </ul>
                </details>
              )}
              {importResult.synced && (importResult.synced.fromNotion + importResult.synced.fromEmbeddings) > 0 && (
                <p className="text-xs text-emerald-700 leading-relaxed">
                  Mémoire canonique synchronisée : {importResult.synced.fromNotion + importResult.synced.fromEmbeddings} entrée{(importResult.synced.fromNotion + importResult.synced.fromEmbeddings) > 1 ? 's' : ''} mises à jour. Visible immédiatement dans <Link href="/cerveau" className="underline hover:text-emerald-900">la Mémoire</Link>.
                </p>
              )}
              {importResult.created > 0 && (
                reindexed === null ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <button onClick={reindexMemory} disabled={reindexing} className="btn-primary text-sm">
                      {reindexing ? 'Reconstruction…' : 'Reconstruire la mémoire éditoriale'}
                    </button>
                    <span className="text-xs text-ink-500">Active les patterns, le radar intelligent et les analytics humains.</span>
                  </div>
                ) : (
                  <p className="text-sm text-success-700">
                    <strong>{reindexed} posts indexés.</strong> Mémoire éditoriale prête.
                  </p>
                )
              )}
            </div>
          )}

          {/* Aperçu 5 premiers — discret */}
          <details className="pt-2 border-t border-ink-100">
            <summary className="text-xs text-ink-500 hover:text-ink-900 cursor-pointer transition">
              Aperçu des 5 premiers posts
            </summary>
            <div className="mt-3 space-y-2">
              {posts.slice(0, 5).map((p, i) => (
                <div key={i} className="rounded-lg border border-ink-100 p-3 text-xs">
                  <div className="flex items-center justify-between mb-1 text-ink-500">
                    <span>{new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    {p.url && <a href={p.url} target="_blank" rel="noopener" className="text-brand-700 hover:underline">LinkedIn ↗</a>}
                  </div>
                  <p className="text-ink-800 whitespace-pre-wrap line-clamp-3">{p.text}</p>
                </div>
              ))}
            </div>
          </details>
        </section>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xl font-semibold text-ink-900 tabular-nums">{value}</div>
      <div className="text-2xs text-ink-500 mt-0.5">{label}</div>
    </div>
  );
}

function ResultStat({ label, value, tone }: { label: string; value: number; tone: 'success' | 'danger' | 'ink' }) {
  const color = { success: 'text-success-700', danger: 'text-danger-700', ink: 'text-ink-900' }[tone];
  return (
    <div>
      <div className={`text-xl font-semibold tabular-nums ${color}`}>{value}</div>
      <div className="text-2xs text-ink-500 mt-0.5">{label}</div>
    </div>
  );
}
