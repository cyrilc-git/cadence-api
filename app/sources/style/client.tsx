'use client';

// V58.5 — Éditeur du brand kit visuel. Couleurs, mots-clés de style, format par
// défaut, images de référence. Réglé une fois, appliqué à chaque visuel généré
// par Claude Design (les images passent en vision réelle).

import { useEffect, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { toast } from '@/components/Dialog';

type BrandImage = { key: string; url: string };

const FORMATS: { key: string; label: string; ratio: string }[] = [
  { key: 'landscape', label: 'Paysage', ratio: '1200 × 630' },
  { key: 'square', label: 'Carré', ratio: '1080 × 1080' },
  { key: 'portrait', label: 'Portrait', ratio: '1080 × 1350' },
];

export default function BrandKitClient() {
  const [accent, setAccent] = useState('#2563EB');
  const [background, setBackground] = useState('#F8FAFC');
  const [text, setText] = useState('#0F172A');
  const [style, setStyle] = useState('');
  const [format, setFormat] = useState('landscape');
  const [images, setImages] = useState<BrandImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch('/api/brand-kit', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.accent) setAccent(d.accent);
        if (d.background) setBackground(d.background);
        if (d.text) setText(d.text);
        if (d.style) setStyle(d.style);
        if (d.format) setFormat(d.format);
        setImages(Array.isArray(d.images) ? d.images : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const r = await fetch('/api/brand-kit', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accent, background, text, style, format }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Échec');
      toast.success('Brand kit enregistré');
    } catch (e: any) { toast.error('Erreur : ' + e.message); }
    finally { setSaving(false); }
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { toast.error('Image trop lourde (4 Mo max).'); return; }
    setUploading(true);
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = () => rej(new Error('Lecture impossible'));
        fr.readAsDataURL(file);
      });
      const r = await fetch('/api/brand-kit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Échec');
      setImages(prev => [...prev, d.image]);
      toast.success('Image de référence ajoutée');
    } catch (e: any) { toast.error('Erreur : ' + e.message); }
    finally { setUploading(false); }
  }

  async function removeImage(key: string) {
    setImages(prev => prev.filter(i => i.key !== key));
    try { await fetch(`/api/brand-kit?key=${encodeURIComponent(key)}`, { method: 'DELETE' }); }
    catch { /* silencieux */ }
  }

  if (loading) return <div className="max-w-2xl mx-auto p-8 text-sm text-ink-500">Chargement…</div>;

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-2xs uppercase tracking-wider font-semibold text-ink-400">Sources · Style visuel</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink-900 tracking-tight">Brand kit visuel</h1>
          <p className="mt-2 text-sm text-ink-500 leading-relaxed max-w-lg">
            Réglé une fois, appliqué à chaque visuel généré par Claude Design. Les images de référence sont regardées par Claude (vision), pas juste listées.
          </p>
        </div>
        <Link href="/sources" className="text-xs text-ink-500 hover:text-ink-900 transition">← Sources</Link>
      </header>

      {/* Couleurs */}
      <section>
        <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-3">Couleurs</h2>
        <div className="grid grid-cols-3 gap-3">
          {([['Accent', accent, setAccent], ['Fond', background, setBackground], ['Texte', text, setText]] as const).map(([label, val, set]) => (
            <div key={label}>
              <label className="block text-xs font-medium text-ink-700 mb-1.5">{label}</label>
              <div className="flex items-center gap-2 rounded-lg ring-1 ring-inset ring-ink-200 px-2 py-1.5">
                <input type="color" value={/^#[0-9a-f]{6}$/i.test(val) ? val : '#000000'} onChange={e => set(e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0" aria-label={label} />
                <input value={val} onChange={e => set(e.target.value)} className="flex-1 min-w-0 text-sm font-mono bg-transparent outline-none" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Style */}
      <section>
        <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-3">Style</h2>
        <textarea
          value={style}
          onChange={e => setStyle(e.target.value)}
          rows={3}
          placeholder="Sobre, éditorial, beaucoup d'air, coins arrondis, schémas épurés, une seule couleur d'accent…"
          className="w-full px-3 py-2 rounded-lg ring-1 ring-inset ring-ink-200 text-sm focus:ring-brand-300 outline-none leading-relaxed"
        />
      </section>

      {/* Format par défaut */}
      <section>
        <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-3">Format par défaut</h2>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map(f => (
            <button key={f.key} onClick={() => setFormat(f.key)} className={`px-3.5 py-2 rounded-xl ring-1 ring-inset text-sm transition ${format === f.key ? 'ring-brand-300 bg-brand-50 text-brand-800' : 'ring-ink-200 text-ink-700 hover:bg-ink-50'}`}>
              {f.label} <span className="text-2xs text-ink-400">{f.ratio}</span>
            </button>
          ))}
        </div>
      </section>

      <div>
        <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50">
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

      {/* Images de référence */}
      <section className="pt-6 border-t border-ink-100">
        <h2 className="text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-1">Images de référence</h2>
        <p className="text-xs text-ink-500 leading-relaxed mb-3">Jusqu&apos;à 4 utilisées par génération. Claude s&apos;inspire de leur palette, composition et style.</p>
        <div className="flex flex-wrap gap-3">
          {images.map(img => (
            <div key={img.key} className="relative group w-24 h-24 rounded-lg overflow-hidden ring-1 ring-inset ring-ink-200">
              <img src={img.url} alt="référence" className="w-full h-full object-cover" />
              <button onClick={() => removeImage(img.key)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-ink-900/70 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition" aria-label="Retirer">×</button>
            </div>
          ))}
          <label className={`w-24 h-24 rounded-lg ring-1 ring-inset ring-dashed ring-ink-300 flex flex-col items-center justify-center text-2xs text-ink-500 cursor-pointer hover:bg-ink-50 transition ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <span className="text-lg leading-none">+</span>
            <span>{uploading ? '…' : 'Ajouter'}</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} className="hidden" />
          </label>
        </div>
      </section>
    </div>
  );
}
