'use client';

// V8.9.1 §C — /design-visuel refondu en studio créatif.
// — Hero studio : 3 vrais previews côte à côte (avant/après variations).
// — Direction artistique : tags humains (sobre / dense / éditorial / agressif LinkedIn).
// — Moodboard central : grille masonry, drag/drop full-zone, hover preview.
// — Figma honnête : "Cadence utilise ce lien comme référence stylistique" (pas de fake parsing).
// — Tokens techniques (hex, radius) cachés sous "Tokens avancés".

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';

const CATEGORY_META: Record<string, { label: string; description: string; icon: string }> = {
  brand:      { label: 'Logo & branding',              description: 'Identité visuelle de Cadence',     icon: '✦' },
  color:      { label: 'Couleurs',                      description: 'Palette principale et accents',    icon: '◐' },
  typography: { label: 'Typographies',                  description: 'Police, tailles, hiérarchie',      icon: 'Aa' },
  layout:     { label: 'Cards & boutons',               description: 'Radius, ombres, paddings',         icon: '▢' },
  format:     { label: 'Formats visuels',               description: 'Tailles, ratios, exports',         icon: '↔' },
  style:      { label: "Styles d'illustration",         description: 'Direction artistique, ambiance',   icon: '✎' },
  prompt:     { label: 'Prompts visuels réutilisables', description: 'Briefs et instructions Claude',    icon: '⊞' },
  moodboard:  { label: 'Moodboard',                     description: 'Images de référence',              icon: '▦' },
  misc:       { label: 'Autres',                        description: 'Paramètres divers',                icon: '⋯' }
};

// Tags humains pour la direction artistique
const ART_DIRECTION = [
  { key: 'sobre',      label: 'Sobre',                hint: 'Peu de couleurs, espace, sérieux' },
  { key: 'dense',      label: 'Dense',                hint: 'Beaucoup d\'information visuelle' },
  { key: 'editorial',  label: 'Éditorial',            hint: 'Style magazine, typo généreuse' },
  { key: 'agressif',   label: 'Agressif LinkedIn',    hint: 'Couleurs vives, hook fort, contraste' },
  { key: 'pedagogue',  label: 'Pédagogique',          hint: 'Schéma, flèches, étapes' },
  { key: 'data',       label: 'Data-first',           hint: 'Chiffres au centre, sparklines' }
];

export default function DesignVisuelClient({ initial }: { initial: any[] }) {
  const [tokens, setTokens] = useState(initial);
  const [editing, setEditing] = useState<any | null>(null);
  const [figmaUrl, setFigmaUrl] = useState('');
  const [savingFigma, setSavingFigma] = useState(false);
  const [moodboards, setMoodboards] = useState<any[]>([]);
  const [uploadingMb, setUploadingMb] = useState(false);
  const [mbError, setMbError] = useState<string | null>(null);
  const [zoomedImg, setZoomedImg] = useState<any | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeArt, setActiveArt] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function save() {
    if (!editing.key || !editing.value) return;
    const r = await fetch('/api/design-system', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
    const d = await r.json();
    if (!r.ok) { alert(d.error); return; }
    const existing = tokens.find(t => t.key === editing.key);
    if (existing) setTokens(tokens.map(t => t.key === editing.key ? d.item : t));
    else setTokens([...tokens, d.item]);
    setEditing(null);
  }

  async function remove(id: string) {
    if (!confirm('Supprimer ce token ?')) return;
    const r = await fetch(`/api/design-system/${id}`, { method: 'DELETE' });
    if (r.ok) setTokens(tokens.filter(t => t.id !== id));
  }

  async function loadMoodboards() {
    try {
      const r = await fetch('/api/design-visuel/moodboard');
      const d = await r.json();
      if (r.ok) setMoodboards(d.moodboards || []);
    } catch { /* silent */ }
  }
  useEffect(() => { loadMoodboards(); }, []);

  const uploadMoodboard = useCallback(async (file: File) => {
    setUploadingMb(true); setMbError(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch('/api/design-visuel/moodboard', { method: 'POST', body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'upload failed');
      await loadMoodboards();
    } catch (e: any) { setMbError(e.message); }
    finally { setUploadingMb(false); }
  }, []);

  async function deleteMoodboard(id: string) {
    if (!confirm('Supprimer cette image de référence ?')) return;
    const r = await fetch(`/api/design-system/${id}`, { method: 'DELETE' });
    if (r.ok) setMoodboards(prev => prev.filter(m => m.id !== id));
  }

  async function saveFigma() {
    if (!figmaUrl) return;
    setSavingFigma(true);
    try {
      const r = await fetch('/api/design-system', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'figma.url', value: figmaUrl, category: 'brand' }) });
      const d = await r.json();
      if (r.ok) {
        const existing = tokens.find(t => t.key === 'figma.url');
        if (existing) setTokens(tokens.map(t => t.key === 'figma.url' ? d.item : t));
        else setTokens([...tokens, d.item]);
        setFigmaUrl('');
      }
    } finally { setSavingFigma(false); }
  }

  async function saveArtDirection(keys: string[]) {
    setActiveArt(keys);
    await fetch('/api/design-system', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'style.direction', value: keys.join(', ') || 'sobre', category: 'style' }) });
  }

  useEffect(() => {
    const tok = tokens.find(t => t.key === 'style.direction');
    if (tok?.value) setActiveArt(tok.value.split(/[,\s]+/).filter(Boolean));
  }, [tokens]);

  const byCat = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const t of tokens) {
      const c = t.category || 'misc';
      if (c === 'moodboard') continue; // moodboard rendu séparément
      if (!m[c]) m[c] = [];
      m[c].push(t);
    }
    return m;
  }, [tokens]);

  const currentFigma = tokens.find(t => t.key === 'figma.url');

  // Drag/drop full-zone for moodboard
  function onZoneDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!dragOver) setDragOver(true);
  }
  function onZoneDragLeave() { setDragOver(false); }
  function onZoneDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    files.forEach(uploadMoodboard);
  }

  return (
    <div className="space-y-10">
      {/* ── HERO STUDIO ─────────────────────────────────────── */}
      <header>
        <p className="text-2xs uppercase tracking-wider font-semibold text-ink-400">Studio</p>
        <h1 className="mt-1 text-3xl font-semibold text-ink-900 tracking-tight">Design visuel</h1>
        <p className="mt-2 text-sm text-ink-500 max-w-2xl">La direction artistique de Cadence. Inspiration, références, ambiance — tout ce qui guide Claude quand il génère vos illustrations.</p>
      </header>

      {/* Sample previews — 3 styles côte à côte */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PreviewSample
            tag="Sobre · éditorial"
            svg={<svg viewBox="0 0 400 300" className="w-full h-full"><rect width="400" height="300" fill="#FAFAF9"/><line x1="40" y1="60" x2="120" y2="60" stroke="#0F172A" strokeWidth="2"/><text x="40" y="120" fontFamily="Georgia, serif" fontSize="32" fill="#0F172A" fontWeight="500">P&amp;L estimé</text><text x="40" y="155" fontFamily="Georgia, serif" fontSize="32" fill="#64748B" fontWeight="400" fontStyle="italic">en temps réel</text><text x="40" y="240" fontFamily="Inter, sans-serif" fontSize="11" fill="#94A3B8" letterSpacing="2">HEELIO · PRODUIT</text></svg>}
          />
          <PreviewSample
            tag="Dense · data"
            svg={<svg viewBox="0 0 400 300" className="w-full h-full"><rect width="400" height="300" fill="#F8FAFC"/><rect x="20" y="20" width="170" height="125" rx="8" fill="white" stroke="#E2E8F0"/><text x="32" y="42" fontFamily="Inter" fontSize="9" fill="#64748B" fontWeight="600">MARGE M-1</text><text x="32" y="90" fontFamily="Inter" fontSize="28" fill="#1E40AF" fontWeight="700">+18,4%</text><text x="32" y="115" fontFamily="Inter" fontSize="9" fill="#64748B">vs Banque · +43k€</text><rect x="210" y="20" width="170" height="125" rx="8" fill="white" stroke="#E2E8F0"/><text x="222" y="42" fontFamily="Inter" fontSize="9" fill="#64748B" fontWeight="600">DSO</text><text x="222" y="90" fontFamily="Inter" fontSize="28" fill="#047857" fontWeight="700">32j</text><text x="222" y="115" fontFamily="Inter" fontSize="9" fill="#64748B">-12j vs N-1</text><rect x="20" y="160" width="360" height="120" rx="8" fill="white" stroke="#E2E8F0"/><polyline points="40,260 90,240 140,250 190,200 240,210 290,180 340,170 380,150" stroke="#2563EB" strokeWidth="2" fill="none"/></svg>}
          />
          <PreviewSample
            tag="Agressif · hook fort"
            svg={<svg viewBox="0 0 400 300" className="w-full h-full"><rect width="400" height="300" fill="#1E40AF"/><text x="200" y="120" fontFamily="Inter" fontSize="44" fill="white" fontWeight="800" textAnchor="middle">-50%</text><text x="200" y="160" fontFamily="Inter" fontSize="14" fill="#BFDBFE" fontWeight="500" textAnchor="middle">DE DSO EN 3 MOIS</text><line x1="160" y1="190" x2="240" y2="190" stroke="white" strokeWidth="2"/><text x="200" y="220" fontFamily="Inter" fontSize="11" fill="white" textAnchor="middle" letterSpacing="2">CAS CLIENT · PME SERVICES</text></svg>}
          />
        </div>
        <p className="mt-3 text-2xs text-ink-400 text-center">Trois directions possibles. Choisissez celle qui vous ressemble en bas.</p>
      </section>

      {/* ── DIRECTION ARTISTIQUE — tags humains ────────────── */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">Comment doit penser Cadence ?</h2>
            <p className="text-xs text-ink-500 mt-0.5">Multi-sélection. Combinez-les. Ces mots guident chaque génération.</p>
          </div>
          {activeArt.length > 0 && <span className="text-2xs text-success-700 flex items-center gap-1"><span className="dot bg-success-500" /> {activeArt.length} active{activeArt.length > 1 ? 's' : ''}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {ART_DIRECTION.map(d => {
            const active = activeArt.includes(d.key);
            return (
              <button
                key={d.key}
                onClick={() => saveArtDirection(active ? activeArt.filter(k => k !== d.key) : [...activeArt, d.key])}
                className={`text-left px-4 py-2.5 rounded-xl border transition-all duration-200 ${active ? 'border-ink-900 bg-ink-900 text-white shadow-sm' : 'border-ink-200 bg-white hover:border-ink-400 hover:shadow-xs'}`}
                title={d.hint}
              >
                <div className={`text-sm font-medium ${active ? 'text-white' : 'text-ink-900'}`}>{d.label}</div>
                <div className={`text-2xs mt-0.5 ${active ? 'text-white/70' : 'text-ink-500'}`}>{d.hint}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── MOODBOARD — central, masonry, drag full-zone ───── */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">Moodboard</h2>
            <p className="text-xs text-ink-500 mt-0.5">Glissez vos images. Cadence les analyse (style, palette, densité) pour guider chaque génération.</p>
          </div>
          {moodboards.length > 0 && (
            <label className="text-xs text-ink-500 hover:text-ink-900 cursor-pointer transition">
              {uploadingMb ? 'Upload…' : '+ Ajouter'}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                disabled={uploadingMb}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadMoodboard(f); e.currentTarget.value = ''; }}
              />
            </label>
          )}
        </div>
        <div
          onDragOver={onZoneDragOver}
          onDragLeave={onZoneDragLeave}
          onDrop={onZoneDrop}
          className={`relative rounded-2xl transition-all duration-200 ${dragOver ? 'ring-2 ring-brand-500 bg-brand-50/40 p-3' : moodboards.length === 0 ? 'border-2 border-dashed border-ink-200 hover:border-ink-300 p-12' : 'p-0'}`}
        >
          {moodboards.length === 0 ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-ink-50 mx-auto mb-3 flex items-center justify-center text-ink-300 text-xl">▦</div>
              <p className="text-sm text-ink-700 font-medium">Glissez vos références ici</p>
              <p className="mt-1 text-xs text-ink-500">Ou cliquez pour parcourir vos fichiers</p>
              <label className="btn-primary text-xs mt-4 inline-block cursor-pointer">
                Choisir des images
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" multiple disabled={uploadingMb}
                  onChange={e => { Array.from(e.target.files || []).forEach(uploadMoodboard); e.currentTarget.value = ''; }}
                />
              </label>
            </div>
          ) : (
            <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 [&>*]:mb-3 [&>*]:break-inside-avoid">
              {moodboards.map(m => {
                const tags: string[] = m.meta?.tags || [];
                return (
                <div key={m.id} className="group relative rounded-xl overflow-hidden border border-ink-100 bg-ink-50 cursor-zoom-in transition-all duration-200 hover:shadow-elev hover:border-ink-300" onClick={() => setZoomedImg(m)}>
                  <img src={m.value} alt="" loading="lazy" className="w-full block transition-transform duration-300 group-hover:scale-[1.02]" />
                  {tags.length > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/70 to-transparent">
                      <div className="flex flex-wrap gap-1">
                        {tags.slice(0, 3).map((t: string) => (
                          <span key={t} className="text-2xs px-1.5 py-0.5 rounded bg-white/90 text-ink-800 font-medium">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteMoodboard(m.id); }}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-white/95 backdrop-blur text-ink-700 hover:text-danger-700 opacity-0 group-hover:opacity-100 transition shadow-xs"
                    title="Supprimer"
                    aria-label="Supprimer cette image"
                  >×</button>
                </div>
                );
              })}
            </div>
          )}
          {dragOver && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-brand-700 font-semibold text-sm bg-white/90 px-4 py-2 rounded-xl shadow-pop">Relâchez pour ajouter</div>
            </div>
          )}
        </div>
        {mbError && <p className="mt-2 text-xs text-danger-700">{mbError}</p>}
      </section>

      {/* ── FIGMA HONNÊTE ─────────────────────────────────── */}
      <section>
        <div className="rounded-2xl border border-ink-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-ink-900">Référence Figma</h2>
          <p className="mt-1 text-xs text-ink-500">Cadence utilise ce lien comme référence stylistique (ne fetch pas le fichier). L'extraction native des tokens viendra avec Figma API.</p>
          <div className="mt-3 flex gap-2">
            <input value={figmaUrl} onChange={e => setFigmaUrl(e.target.value)} placeholder="https://www.figma.com/file/…" className="input text-sm flex-1" />
            <button onClick={saveFigma} disabled={!figmaUrl || savingFigma} className="btn-primary text-xs">{savingFigma ? '…' : 'Enregistrer'}</button>
          </div>
          {currentFigma && (
            <p className="mt-2 text-2xs text-success-700 flex items-center gap-1.5">
              <span className="dot bg-success-500" />
              Actif : <a href={currentFigma.value} target="_blank" rel="noopener" className="underline truncate">{currentFigma.value}</a>
            </p>
          )}
        </div>
      </section>

      {/* ── TOKENS AVANCÉS — disclosure ───────────────────── */}
      <section>
        <button
          onClick={() => setShowAdvanced(o => !o)}
          className="flex items-center gap-2 text-xs text-ink-500 hover:text-ink-900 transition"
        >
          <span>{showAdvanced ? '▾' : '▸'}</span>
          <span>Tokens avancés ({tokens.filter(t => t.category !== 'moodboard').length})</span>
          <span className="text-ink-400">— pour ceux qui veulent contrôler les hex, radius, polices</span>
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 animate-slide-up">
            <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-4 text-2xs text-ink-500">
              Ces valeurs sont injectées dans chaque prompt de génération. Modifiez-les pour changer le rendu de tous vos visuels en un instant.
            </div>
            {Object.keys(CATEGORY_META).filter(c => byCat[c]?.length).map(cat => {
              const list = byCat[cat] || [];
              return (
                <div key={cat} className="rounded-xl border border-ink-100 bg-white p-4">
                  <h3 className="text-xs font-semibold text-ink-900 flex items-center gap-2">
                    <span className="text-ink-400">{CATEGORY_META[cat]?.icon}</span>
                    {CATEGORY_META[cat]?.label || cat}
                  </h3>
                  <ul className="mt-3 space-y-1">
                    {list.map(t => {
                      const isHex = /^#[0-9A-Fa-f]{6}$/.test(t.value);
                      const shortKey = t.key.split('.').slice(1).join('.') || t.key;
                      return (
                        <li key={t.id} className="group flex items-center gap-3 py-1.5 px-2 -mx-2 rounded-md hover:bg-ink-50 transition">
                          <div className="w-32 shrink-0 text-xs font-medium text-ink-700 truncate">{shortKey}</div>
                          <div className="flex-1 flex items-center gap-2 min-w-0">
                            {isHex && <span className="inline-block w-4 h-4 rounded shrink-0 ring-1 ring-ink-200" style={{ background: t.value }} />}
                            <span className="font-mono text-2xs text-ink-600 truncate">{t.value}</span>
                          </div>
                          <button onClick={() => setEditing(t)} className="text-2xs text-ink-400 hover:text-ink-900 opacity-0 group-hover:opacity-100 transition">modifier</button>
                          <button onClick={() => remove(t.id)} className="text-2xs text-ink-400 hover:text-danger-700 opacity-0 group-hover:opacity-100 transition">×</button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            <button onClick={() => setEditing({ key: '', value: '', category: 'color' })} className="text-xs text-brand-700 hover:text-brand-900 transition">+ Ajouter un token</button>
          </div>
        )}
      </section>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-ink-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setEditing(null)}>
          <div className="card max-w-md w-full p-6 space-y-3 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-ink-900">{editing.id ? 'Modifier' : 'Nouveau token'}</h3>
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">Clé (ex : color.primary)</label>
              <input value={editing.key} onChange={e => setEditing({ ...editing, key: e.target.value })} placeholder="color.primary" className="input text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">Catégorie</label>
              <select value={editing.category || 'misc'} onChange={e => setEditing({ ...editing, category: e.target.value })} className="input text-sm">
                {Object.entries(CATEGORY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">Valeur</label>
              <textarea value={editing.value} onChange={e => setEditing({ ...editing, value: e.target.value })} rows={3} className="input text-sm font-mono" placeholder="#2563EB ou texte libre" />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setEditing(null)} className="btn-secondary text-xs">Annuler</button>
              <button onClick={save} className="btn-primary text-xs">Sauvegarder</button>
            </div>
          </div>
        </div>
      )}

      {/* Zoom moodboard */}
      {zoomedImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink-900/80 backdrop-blur-sm animate-fade-in cursor-zoom-out" onClick={() => setZoomedImg(null)}>
          <img src={zoomedImg.value} alt="" className="max-w-full max-h-full rounded-xl shadow-pop" />
        </div>
      )}
    </div>
  );
}

function PreviewSample({ tag, svg }: { tag: string; svg: React.ReactNode }) {
  return (
    <div className="group">
      <div className="aspect-[4/3] rounded-xl overflow-hidden border border-ink-200 bg-white shadow-xs group-hover:shadow-elev transition-all duration-300 group-hover:scale-[1.01]">
        {svg}
      </div>
      <div className="mt-2 text-2xs uppercase tracking-wider font-semibold text-ink-500">{tag}</div>
    </div>
  );
}
