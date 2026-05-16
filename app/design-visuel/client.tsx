'use client';

import { useMemo, useState } from 'react';

const CATEGORY_META: Record<string, { label: string; description: string; icon: string }> = {
  brand:      { label: 'Logo & branding',         description: 'Identité visuelle de Cadence', icon: '✦' },
  color:      { label: 'Couleurs',                 description: 'Palette principale et accents', icon: '◐' },
  typography: { label: 'Typographies',             description: 'Police, tailles, hiérarchie', icon: 'Aa' },
  layout:     { label: 'Cards & boutons',          description: 'Radius, ombres, paddings', icon: '▢' },
  format:     { label: 'Formats visuels',          description: 'Tailles, ratios, exports', icon: '↔' },
  style:      { label: "Styles d'illustration",    description: 'Direction artistique, ambiance', icon: '✎' },
  prompt:     { label: 'Prompts visuels réutilisables', description: 'Briefs et instructions Claude', icon: '✨' },
  misc:       { label: 'Autres',                   description: 'Paramètres divers', icon: '⋯' }
};

export default function DesignVisuelClient({ initial }: { initial: any[] }) {
  const [tokens, setTokens] = useState(initial);
  const [editing, setEditing] = useState<any | null>(null);
  const [figmaUrl, setFigmaUrl] = useState('');
  const [savingFigma, setSavingFigma] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');

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

  const byCat = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const t of tokens) {
      const c = t.category || 'misc';
      if (!m[c]) m[c] = [];
      m[c].push(t);
    }
    return m;
  }, [tokens]);

  const colorTokens = byCat['color'] || [];
  const currentFigma = tokens.find(t => t.key === 'figma.url');

  const visibleCats = activeCategory === 'all' ? Object.keys(byCat) : [activeCategory];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900 tracking-tight">Design visuel</h1>
        <p className="mt-1 text-sm text-ink-500 lead">Cadence utilise ces tokens pour générer vos illustrations, schémas et captures. Modifiez ici pour changer le rendu de tous vos visuels en un instant.</p>
      </header>

      {/* V8.7 — hero : preview SVG d'un exemple de visuel généré */}
      <section className="card p-0 overflow-hidden border-brand-100">
        <div className="bg-gradient-to-br from-brand-50 to-white px-6 pt-6 pb-3">
          <div className="text-2xs uppercase tracking-wider font-semibold text-brand-700">Aperçu</div>
          <h2 className="mt-1 text-base font-semibold text-ink-900">Voici à quoi ressembleront vos visuels</h2>
          <p className="text-xs text-ink-500 mt-0.5">Carte produit générée avec vos tokens actuels.</p>
        </div>
        <div className="bg-white px-6 pb-6 pt-3">
          <svg viewBox="0 0 1200 630" className="w-full rounded-lg shadow-card" xmlns="http://www.w3.org/2000/svg">
            <rect width="1200" height="630" fill="#F8FAFC"/>
            <rect x="80" y="80" width="1040" height="470" rx="24" fill="white" stroke="#E2E8F0" strokeWidth="2"/>
            <text x="120" y="170" fontFamily="Inter, sans-serif" fontSize="22" fill="#64748B" fontWeight="600">HEELIO · PRODUIT</text>
            <text x="120" y="240" fontFamily="Inter, sans-serif" fontSize="56" fill="#0F172A" fontWeight="700">P&amp;L estimé en temps réel</text>
            <text x="120" y="285" fontFamily="Inter, sans-serif" fontSize="22" fill="#475569">Sans attendre la clôture comptable.</text>
            <rect x="120" y="340" width="280" height="160" rx="14" fill="#EFF6FF" stroke="#BFDBFE"/>
            <text x="140" y="380" fontFamily="Inter, sans-serif" fontSize="14" fill="#1E40AF" fontWeight="600">MARGE M-1</text>
            <text x="140" y="430" fontFamily="Inter, sans-serif" fontSize="44" fill="#1E40AF" fontWeight="700">+18,4%</text>
            <text x="140" y="470" fontFamily="Inter, sans-serif" fontSize="13" fill="#64748B">vs Banque · +43k€</text>
            <rect x="420" y="340" width="280" height="160" rx="14" fill="#ECFDF5" stroke="#A7F3D0"/>
            <text x="440" y="380" fontFamily="Inter, sans-serif" fontSize="14" fill="#047857" fontWeight="600">FAE/FNP</text>
            <text x="440" y="430" fontFamily="Inter, sans-serif" fontSize="44" fill="#047857" fontWeight="700">112k€</text>
            <text x="440" y="470" fontFamily="Inter, sans-serif" fontSize="13" fill="#64748B">Auto-calculés</text>
            <rect x="720" y="340" width="280" height="160" rx="14" fill="#FFFBEB" stroke="#FCD34D"/>
            <text x="740" y="380" fontFamily="Inter, sans-serif" fontSize="14" fill="#B45309" fontWeight="600">DSO</text>
            <text x="740" y="430" fontFamily="Inter, sans-serif" fontSize="44" fill="#B45309" fontWeight="700">32j</text>
            <text x="740" y="470" fontFamily="Inter, sans-serif" fontSize="13" fill="#64748B">-12j vs N-1</text>
          </svg>
          <p className="mt-3 text-2xs text-ink-400 text-center">Exemple — Cadence respecte vos couleurs, vos cards, votre typo lors de chaque génération.</p>
        </div>
      </section>

      {/* Hero : color palette preview */}
      <section className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-ink-900 text-sm">Aperçu de votre palette</h2>
            <p className="text-xs text-ink-500">Les couleurs sont injectées dans tous les prompts Claude.</p>
          </div>
          <button onClick={() => setEditing({ key: 'color.', value: '#2563EB', category: 'color' })} className="btn-secondary text-xs">+ Ajouter une couleur</button>
        </div>
        {colorTokens.length === 0 ? (
          <div className="grid grid-cols-5 gap-2 text-xs">
            {['#EFF6FF', '#BFDBFE', '#2563EB', '#1D4ED8', '#172554'].map((c, i) => (
              <div key={c} className="space-y-1.5">
                <div className="aspect-square rounded-xl shadow-card" style={{ backgroundColor: c }} />
                <div className="font-mono text-ink-500 text-2xs">{c}</div>
                <div className="text-ink-400 text-2xs">brand-{[50,100,500,600,900][i]}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            {colorTokens.map(c => {
              const isHex = /^#[0-9A-Fa-f]{6}$/.test(c.value);
              return (
                <button key={c.id} onClick={() => setEditing(c)} className="group text-left space-y-1.5 hover:opacity-90 transition">
                  <div className={`aspect-square rounded-xl shadow-card group-hover:shadow-elev transition ${!isHex ? 'border border-dashed border-ink-300' : ''}`} style={{ backgroundColor: isHex ? c.value : '#F1F5F9' }} />
                  <div className="font-mono text-ink-700 text-2xs truncate">{isHex ? c.value : c.value.slice(0, 12) + '…'}</div>
                  <div className="text-ink-500 text-2xs truncate">{c.key.split('.').slice(1).join('.') || c.key}</div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Figma import */}
      <section className="card p-5 bg-gradient-to-br from-brand-50/50 to-white border-brand-100">
        <div className="flex-1">
          <h2 className="font-semibold text-ink-900">Importer depuis Figma</h2>
            <p className="mt-1 text-xs text-ink-500">Collez le lien de votre fichier Figma. Cadence donne le contexte au LLM lors de la génération. L'extraction automatique des tokens (couleurs, typo) arrivera dans une version ultérieure.</p>
            <div className="mt-3 flex gap-2">
              <input value={figmaUrl} onChange={e => setFigmaUrl(e.target.value)} placeholder="https://www.figma.com/file/…" className="input text-sm flex-1" />
              <button onClick={saveFigma} disabled={!figmaUrl || savingFigma} className="btn-primary">{savingFigma ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          {currentFigma && (
            <p className="mt-2 text-xs text-success-700 flex items-center gap-1.5">
              <span className="dot bg-success-500" />
              Lien actif : <a href={currentFigma.value} target="_blank" rel="noopener" className="underline truncate">{currentFigma.value}</a>
            </p>
          )}
        </div>
      </section>

      {/* Mode banner */}
      <div className="card p-3 flex items-center gap-3 text-sm bg-brand-50/40 border-brand-100">
        <span className="chip chip-brand"><span className="dot bg-brand-500" /> Mode actif</span>
        <span className="text-ink-700">
          <strong>Claude Sonnet 4.6</strong> — génération SVG interne. Tous les tokens ci-dessous sont injectés automatiquement dans le prompt.
        </span>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setActiveCategory('all')} className={`text-xs px-3 py-1.5 rounded-full border transition ${activeCategory === 'all' ? 'bg-brand-50 border-brand-300 text-brand-700' : 'bg-white border-ink-200 hover:bg-ink-50'}`}>
          Toutes <span className="text-ink-400">{tokens.length}</span>
        </button>
        {Object.keys(CATEGORY_META).filter(c => byCat[c]?.length).map(c => (
          <button key={c} onClick={() => setActiveCategory(c)} className={`text-xs px-3 py-1.5 rounded-full border transition flex items-center gap-1.5 ${activeCategory === c ? 'bg-brand-50 border-brand-300 text-brand-700' : 'bg-white border-ink-200 hover:bg-ink-50'}`}>
            <span className="text-ink-400">{CATEGORY_META[c].icon}</span>
            {CATEGORY_META[c].label}
            <span className="text-ink-400">{byCat[c]?.length || 0}</span>
          </button>
        ))}
        <button onClick={() => setEditing({ key: '', value: '', category: 'color' })} className="ml-auto btn-primary text-xs">+ Ajouter</button>
      </div>

      {/* Tokens grouped */}
      {visibleCats.map(cat => {
        const list = byCat[cat] || [];
        if (list.length === 0) return null;
        return (
          <section key={cat} className="card p-5">
            <h2 className="font-semibold text-ink-900 flex items-center gap-2">
              <span className="text-ink-400">{CATEGORY_META[cat]?.icon}</span>
              {CATEGORY_META[cat]?.label || cat}
            </h2>
            <p className="text-xs text-ink-500 mt-0.5">{CATEGORY_META[cat]?.description}</p>
            <ul className="mt-4 space-y-1.5">
              {list.map(t => {
                const isHex = /^#[0-9A-Fa-f]{6}$/.test(t.value);
                return (
                  <li key={t.id} className="flex items-start gap-3 p-2.5 rounded-lg border border-ink-100 hover:border-ink-200 transition">
                    <div className="w-44 shrink-0">
                      <div className="text-sm font-medium text-ink-900 truncate">{t.key.split('.').slice(1).join('.') || t.key}</div>
                      <div className="text-2xs text-ink-400 font-mono truncate">{t.key}</div>
                    </div>
                    <span className="flex-1 text-sm text-ink-700 break-words flex items-center gap-2">
                      {isHex && <span className="inline-block w-5 h-5 rounded shrink-0 ring-1 ring-ink-200" style={{ background: t.value }} />}
                      <span className="font-mono text-xs">{t.value}</span>
                    </span>
                    <button onClick={() => setEditing(t)} className="btn-ghost text-2xs">Modifier</button>
                    <button onClick={() => remove(t.id)} className="btn-ghost text-2xs text-danger-700">Supprimer</button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {tokens.length === 0 && (
        <div className="card p-10 text-center">
          <p className="text-sm text-ink-700 font-medium">Aucun token de design défini.</p>
          <p className="mt-1 text-xs text-ink-500">Cadence utilise les valeurs par défaut. Ajoutez vos couleurs, typographies, prompts pour que les visuels respectent votre identité.</p>
          <button onClick={() => setEditing({ key: 'color.brand', value: '#2563EB', category: 'color' })} className="btn-primary mt-4">+ Ajouter votre première couleur</button>
        </div>
      )}

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
              <button onClick={() => setEditing(null)} className="btn-secondary">Annuler</button>
              <button onClick={save} className="btn-primary">Sauvegarder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
