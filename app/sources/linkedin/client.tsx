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
import { confirmDialog, toast } from '@/components/Dialog';

type ParsedPost = { date: string; text: string; url?: string; sharedUrl?: string; media?: string };

// V19.1 §csv-fix — Parser CSV qui respecte les sauts de ligne dans les
// cellules entre guillemets. L'ancien parser splittait le texte par \n
// puis essayait de parser chaque ligne, ce qui cassait sur tous les posts
// LinkedIn dont le texte contient des \n (la quasi-totalité). Symptôme :
// "Cannot read properties of undefined (reading 'trim')" car les rows
// produits avaient une cellule par ligne au lieu d'une cellule par champ.
//
// Implémentation : on parse le CSV en UNE seule passe sur tout le buffer,
// en suivant l'état "inQuote". Les retours-chariot et lignes blanches à
// l'intérieur de cellules quotées sont préservés.
function parseCsvBuffer(text: string): string[][] {
  const rows: string[][] = [];
  let cur = '';
  let row: string[] = [];
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inQuote) {
      if (c === '"') {
        if (next === '"') { cur += '"'; i++; }  // échappement ""
        else { inQuote = false; }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') {
        inQuote = true;
      } else if (c === ',') {
        row.push(cur);
        cur = '';
      } else if (c === '\r') {
        // ignoré (LF qui suit gère la fin de row)
      } else if (c === '\n') {
        row.push(cur);
        // on jette les rows entièrement vides
        if (row.length > 1 || (row.length === 1 && row[0])) rows.push(row);
        row = [];
        cur = '';
      } else {
        cur += c;
      }
    }
  }
  // Flush final
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    if (row.length > 1 || (row.length === 1 && row[0])) rows.push(row);
  }
  return rows;
}

function parseSharesCsv(text: string): ParsedPost[] {
  const rows = parseCsvBuffer(text);
  if (rows.length < 2) return [];
  const header = rows[0].map(s => (s || '').trim().toLowerCase());
  const idx = (name: string) => header.findIndex(h => h.includes(name));
  const idxDate = idx('date');
  const idxLink = idx('sharelink');
  const idxText = idx('sharecommentary');
  const idxShared = idx('sharedurl');
  // V51 §5 — Colonne MediaUrl (média attaché au post) : conservée pour
  // l'afficher en miniature après import. On la cherche après SharedUrl
  // pour ne pas confondre les deux.
  const idxMedia = header.findIndex(h => h.includes('mediaurl') || h === 'media');
  const out: ParsedPost[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.length < 2) continue;
    // Defensive : on coalesce undefined -> '' avant tout trim
    const date = ((idxDate >= 0 ? cells[idxDate] : '') || '').trim();
    const t = ((idxText >= 0 ? cells[idxText] : '') || '').trim();
    if (!date || !t) continue;
    out.push({
      date,
      text: t,
      url: idxLink >= 0 ? ((cells[idxLink] || '').trim() || undefined) : undefined,
      sharedUrl: idxShared >= 0 ? ((cells[idxShared] || '').trim() || undefined) : undefined,
      media: idxMedia >= 0 ? ((cells[idxMedia] || '').trim() || undefined) : undefined,
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
  // V19.1 — Curation : l'utilisateur choisit explicitement quels posts importer.
  // Set<number> = indexes dans `posts`. Sélection initiale = posts récents (1 an)
  // ET texte > 200 chars (filtre les reposts courts).
  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(new Set());
  // Filtres
  const [dateRange, setDateRange] = useState<'all' | '1y' | '6m' | '3m'>('1y');
  const [minLen, setMinLen] = useState<200 | 0 | 500>(200);
  const [pilierFilter, setPilierFilter] = useState<string>('all');
  // Affichage : on borne à 100 items visibles pour ne pas laguer
  const [showAll, setShowAll] = useState(false);

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
        // V18 §fix-shares — LinkedIn nomme maintenant le fichier
        // Shares_64244574.csv (avec suffixe ID member). On accepte
        // Shares.csv ET Shares_<digits>.csv. Aussi tolérant aux
        // sous-dossiers et à la casse.
        const sharesFile = Object.values(zip.files).find(f => /(?:^|\/)shares(?:_\d+)?\.csv$/i.test(f.name));
        if (!sharesFile) {
          throw new Error("Pas de Shares.csv trouvé dans le ZIP. Vérifiez que c'est bien l'archive LinkedIn officielle (le fichier peut s'appeler Shares.csv ou Shares_<ID>.csv).");
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
      // V19.1 — Sélection par défaut : posts récents (1 an) ET texte > 200 chars.
      // Évite d'importer 495 posts dont 80% sont des reposts courts.
      const oneYearAgo = Date.now() - 365 * 86_400_000;
      const defaultSelected = new Set<number>();
      parsed.forEach((p, i) => {
        const t = new Date(p.date).getTime();
        if (!Number.isFinite(t)) return;
        if (t < oneYearAgo) return;
        if (p.text.length < 200) return;
        defaultSelected.add(i);
      });
      setSelectedIdx(defaultSelected);
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
    // V19.1 — n'importe QUE les posts sélectionnés
    const toImport = posts.filter((_, i) => selectedIdx.has(i));
    const count = toImport.length;
    if (count === 0) {
      toast.error('Sélectionnez au moins un post à importer.');
      return;
    }
    const ok = await confirmDialog({
      title: `Importer ${count} post${count > 1 ? 's' : ''} sélectionné${count > 1 ? 's' : ''} ?`,
      body: 'Cadence évite les doublons automatiquement. Les posts seront marqués comme imports LinkedIn vérifiés et alimenteront la mémoire stylistique.',
      confirmLabel: 'Importer',
    });
    if (!ok) return;
    setImporting(true); setError(null); setImportResult(null);
    setProgress({ done: 0, total: count });
    try {
      const BATCH = 10;
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
            <Stat label="Posts détectés" value={posts.length} />
            <Stat label="Longueur moy." value={`${stats.avgLen} car.`} />
            <Stat label="Sélectionnés" value={selectedIdx.size} />
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

          {/* V19.1 — Curation : filtre + liste à cocher + actions batch */}
          {!importResult && (
            <CurationPanel
              posts={posts}
              selectedIdx={selectedIdx}
              setSelectedIdx={setSelectedIdx}
              dateRange={dateRange}
              setDateRange={setDateRange}
              minLen={minLen}
              setMinLen={setMinLen}
              pilierFilter={pilierFilter}
              setPilierFilter={setPilierFilter}
              showAll={showAll}
              setShowAll={setShowAll}
            />
          )}

          {/* Progress + import button */}
          {!importResult && (
            <div className="pt-3 border-t border-ink-100">
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
                  <button onClick={importToNotion} disabled={importing || selectedIdx.size === 0} className="btn-primary text-sm">
                    {importing ? 'Import…' : `Importer la sélection (${selectedIdx.size})`}
                  </button>
                  <span className="text-xs text-ink-500">Cadence détecte et ignore les doublons automatiquement.</span>
                </div>
              )}
            </div>
          )}

          {/* V37.1 — Écran de succès après import : CTA principal qui
              ouvre /calendar sur le mois du post le plus récent importé.
              Sans ce CTA, l'utilisateur ne savait pas où aller. */}
          {importResult && importResult.created > 0 && (() => {
            // Récupère la date du post importé le plus récent en croisant
            // results[].index avec posts[].date.
            let mostRecent: Date | null = null;
            for (const r of importResult.results) {
              if (r.status !== 'created') continue;
              const p = posts[r.index];
              if (!p?.date) continue;
              const d = new Date(p.date);
              if (!Number.isFinite(d.getTime())) continue;
              if (!mostRecent || d > mostRecent) mostRecent = d;
            }
            const targetDate = mostRecent ? mostRecent.toISOString().slice(0, 10) : null;
            const monthLabel = mostRecent
              ? mostRecent.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
              : null;
            return (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-3 animate-fade-in">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden />
                  <p className="text-sm text-emerald-900 font-medium">
                    {importResult.created} post{importResult.created > 1 ? 's' : ''} importé{importResult.created > 1 ? 's' : ''} dans Cadence.
                    {importResult.duplicates > 0 && <span className="text-emerald-700"> {importResult.duplicates} doublon{importResult.duplicates > 1 ? 's' : ''} ignoré{importResult.duplicates > 1 ? 's' : ''}.</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap pt-1">
                  <Link
                    href={targetDate ? `/calendar?d=${targetDate}&source=linkedin` : '/calendar?source=linkedin'}
                    className="btn-primary text-sm"
                  >
                    Voir dans le calendrier →
                  </Link>
                </div>
                {targetDate && monthLabel && (
                  <p className="text-xs text-ink-500">
                    Le calendrier ouvre {monthLabel}, le mois du post le plus récent.
                  </p>
                )}
                <p className="text-2xs text-ink-500 leading-relaxed">
                  {importResult.created} publication{importResult.created > 1 ? 's' : ''} analysée{importResult.created > 1 ? 's' : ''} par Cadence. Vos recommandations dans Aujourd&apos;hui en tiennent compte dès maintenant.
                </p>
              </div>
            );
          })()}

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

          {/* V19.1 — La liste de curation est désormais dans <CurationPanel>
              au-dessus du bouton d'import. On a retiré l'ancien aperçu
              "5 premiers posts" devenu redondant. */}
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

// V19.1 — Panneau de curation : l'utilisateur choisit explicitement quels
// posts entrent dans Cadence. Filtres + actions batch + liste à cocher.
const PILIERS_LABELS = ['Tous', 'Cas client', 'Pédagogie', 'Produit', 'Opinion', 'Build in public', 'Autre'];
function CurationPanel({
  posts, selectedIdx, setSelectedIdx,
  dateRange, setDateRange,
  minLen, setMinLen,
  pilierFilter, setPilierFilter,
  showAll, setShowAll,
}: {
  posts: ParsedPost[];
  selectedIdx: Set<number>;
  setSelectedIdx: (s: Set<number>) => void;
  dateRange: 'all' | '1y' | '6m' | '3m';
  setDateRange: (v: 'all' | '1y' | '6m' | '3m') => void;
  minLen: 0 | 200 | 500;
  setMinLen: (v: 0 | 200 | 500) => void;
  pilierFilter: string;
  setPilierFilter: (v: string) => void;
  showAll: boolean;
  setShowAll: (v: boolean) => void;
}) {
  // Indices filtrés selon les critères courants (visibles en liste)
  const visibleIdx = useMemo(() => {
    const cutoff = dateRange === 'all' ? 0
      : dateRange === '1y' ? Date.now() - 365 * 86_400_000
      : dateRange === '6m' ? Date.now() - 182 * 86_400_000
      : Date.now() - 91 * 86_400_000;
    const out: number[] = [];
    for (let i = 0; i < posts.length; i++) {
      const p = posts[i];
      const t = new Date(p.date).getTime();
      if (Number.isFinite(t) && t < cutoff) continue;
      if (p.text.length < minLen) continue;
      if (pilierFilter !== 'all' && pilierFilter !== 'Tous') {
        if (inferPilier(p.text) !== pilierFilter) continue;
      }
      out.push(i);
    }
    // Tri date desc (plus récent en haut)
    out.sort((a, b) => new Date(posts[b].date).getTime() - new Date(posts[a].date).getTime());
    return out;
  }, [posts, dateRange, minLen, pilierFilter]);

  const displayedIdx = showAll ? visibleIdx : visibleIdx.slice(0, 60);

  // Actions batch
  function selectAllVisible() {
    const next = new Set(selectedIdx);
    for (const i of visibleIdx) next.add(i);
    setSelectedIdx(next);
  }
  function deselectAllVisible() {
    const next = new Set(selectedIdx);
    for (const i of visibleIdx) next.delete(i);
    setSelectedIdx(next);
  }
  function selectTop50Longest() {
    const sorted = [...visibleIdx].sort((a, b) => posts[b].text.length - posts[a].text.length);
    const next = new Set(selectedIdx);
    for (const i of sorted.slice(0, 50)) next.add(i);
    setSelectedIdx(next);
  }
  function selectLastYear() {
    const cutoff = Date.now() - 365 * 86_400_000;
    const next = new Set<number>();
    for (let i = 0; i < posts.length; i++) {
      const t = new Date(posts[i].date).getTime();
      if (Number.isFinite(t) && t >= cutoff && posts[i].text.length >= 200) next.add(i);
    }
    setSelectedIdx(next);
  }
  function toggleOne(i: number) {
    const next = new Set(selectedIdx);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelectedIdx(next);
  }

  return (
    <div className="pt-3 border-t border-ink-100 space-y-3 animate-fade-in">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <h3 className="text-2xs uppercase tracking-wider font-semibold text-ink-500">Choisissez ce que Cadence apprend</h3>
        <span className="text-2xs text-ink-500 tabular-nums">
          {selectedIdx.size} sélectionné{selectedIdx.size > 1 ? 's' : ''} · {visibleIdx.length} visible{visibleIdx.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Filtres en chips horizontaux */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-ink-500">Période :</span>
          <FilterChip active={dateRange === '3m'} onClick={() => setDateRange('3m')}>3 mois</FilterChip>
          <FilterChip active={dateRange === '6m'} onClick={() => setDateRange('6m')}>6 mois</FilterChip>
          <FilterChip active={dateRange === '1y'} onClick={() => setDateRange('1y')}>1 an</FilterChip>
          <FilterChip active={dateRange === 'all'} onClick={() => setDateRange('all')}>Tout</FilterChip>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-ink-500">Longueur min :</span>
          <FilterChip active={minLen === 0} onClick={() => setMinLen(0)}>0</FilterChip>
          <FilterChip active={minLen === 200} onClick={() => setMinLen(200)}>200</FilterChip>
          <FilterChip active={minLen === 500} onClick={() => setMinLen(500)}>500</FilterChip>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-ink-500">Pilier :</span>
          <select
            value={pilierFilter}
            onChange={e => setPilierFilter(e.target.value)}
            className="text-xs px-2 py-0.5 rounded-md border border-ink-200 bg-white hover:bg-ink-50 transition focus:outline-none focus:border-brand-400"
          >
            <option value="all">Tous</option>
            {PILIERS_LABELS.filter(l => l !== 'Tous').map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* Actions batch */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button onClick={selectAllVisible} className="px-2.5 py-1 rounded-md border border-ink-200 hover:bg-ink-50 transition">Tout sélectionner ({visibleIdx.length})</button>
        <button onClick={deselectAllVisible} className="px-2.5 py-1 rounded-md border border-ink-200 hover:bg-ink-50 transition">Désélectionner</button>
        <button onClick={selectTop50Longest} className="px-2.5 py-1 rounded-md border border-ink-200 hover:bg-ink-50 transition" title="Sélectionne les 50 posts les plus longs (visibles)">Top 50 plus longs</button>
        <button onClick={selectLastYear} className="px-2.5 py-1 rounded-md border border-ink-200 hover:bg-ink-50 transition" title="Sélectionne tout ce qui fait > 200 chars sur l'année passée">Année passée &gt; 200 chars</button>
      </div>

      {/* Liste à cocher */}
      {visibleIdx.length === 0 ? (
        <p className="text-xs text-ink-500 italic py-4">Aucun post ne correspond aux filtres. Élargissez la période ou baissez la longueur min.</p>
      ) : (
        <>
          <ul className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
            {displayedIdx.map(i => {
              const p = posts[i];
              const pilier = inferPilier(p.text);
              const dateStr = new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
              const isSelected = selectedIdx.has(i);
              return (
                <li key={i} className={`flex items-start gap-3 rounded-lg border p-3 transition cursor-pointer ${isSelected ? 'border-brand-300 bg-brand-50/40' : 'border-ink-100 hover:border-ink-200 bg-white'}`} onClick={() => toggleOne(i)}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleOne(i)}
                    onClick={e => e.stopPropagation()}
                    className="mt-1 w-3.5 h-3.5 rounded border-ink-300 text-brand-500 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 text-2xs text-ink-500 mb-1 flex-wrap">
                      <span className="tabular-nums">{dateStr}</span>
                      <span className="text-ink-300">·</span>
                      <span>{pilier}</span>
                      <span className="text-ink-300">·</span>
                      <span className="tabular-nums">{p.text.length} car.</span>
                      {p.url && (
                        <>
                          <span className="text-ink-300">·</span>
                          <a href={p.url} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} className="text-brand-700 hover:underline">LinkedIn ↗</a>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-ink-800 leading-relaxed line-clamp-2">{p.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          {visibleIdx.length > displayedIdx.length && (
            <button onClick={() => setShowAll(true)} className="text-xs text-ink-500 hover:text-ink-900 transition underline decoration-dotted underline-offset-2">
              Voir les {visibleIdx.length - displayedIdx.length} restants
            </button>
          )}
        </>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 rounded-md transition ${active ? 'bg-brand-50 text-brand-700 border border-brand-300' : 'border border-transparent text-ink-600 hover:bg-ink-50'}`}
    >
      {children}
    </button>
  );
}
