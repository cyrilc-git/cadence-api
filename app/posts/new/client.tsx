'use client';

import { useMemo, useState } from 'react';
import StatusBadge from '@/components/StatusBadge';
import PublishModal from '@/components/PublishModal';
import VisualGenerator from '@/components/VisualGenerator';

const PILIERS = [
  'Lundi Â· Cas client',
  'Mardi Â· PÃ©dagogie',
  'Mercredi Â· Produit',
  'Jeudi Â· Opinion',
  'Vendredi Â· Build in public'
];

type Initial = null | { id?: string; title: string; pilier?: string; content: string; date?: string };

export default function NewPostClient({ initial, prefillBrief, prefillHook }: { initial: Initial; prefillBrief?: string; prefillHook?: string }) {
  const [pilier, setPilier] = useState(initial?.pilier || PILIERS[1]);
  const [brief, setBrief] = useState(prefillBrief || '');
  const [text, setText] = useState(initial?.content || '');
  const [title, setTitle] = useState(initial?.title || '');
  const [date, setDate] = useState(initial?.date || new Date().toISOString().slice(0,10));
  const [time, setTime] = useState('07:30');
  const [anonOk, setAnonOk] = useState(false);
  const [validated, setValidated] = useState(false);

  // Auto-prefill date when pilier changes (only if user hasn't touched date manually)
  const autoDateRef = useState(false);
  useMemo(() => {
    if (!pilier || initial?.id || initial?.date) return;
    const wd = /Lundi/.test(pilier) ? 1 : /Mardi/.test(pilier) ? 2 : /Mercredi/.test(pilier) ? 3 : /Jeudi/.test(pilier) ? 4 : /Vendredi/.test(pilier) ? 5 : -1;
    if (wd < 0) return;
    const today = new Date();
    const next = new Date(today);
    next.setHours(7, 30, 0, 0);
    for (let i = 0; i < 14; i++) {
      if (next.getDay() === wd && next.getTime() > Date.now()) break;
      next.setDate(next.getDate() + 1);
    }
    const y = next.getFullYear(), m = String(next.getMonth() + 1).padStart(2, '0'), d2 = String(next.getDate()).padStart(2, '0');
    setDate(`${y}-${m}-${d2}`);
  }, [pilier]);

  const [proposals, setProposals] = useState<string[]>([]);
  const [genModel, setGenModel] = useState<string | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [publishOpen, setPublishOpen] = useState(false);

  const charCount = text.length;
  const lint = useMemo(() => analyzeAntiPatterns(text), [text]);

  async function handleGenerate() {
    setGenLoading(true); setGenError(null); setProposals([]); setGenModel(null);
    try {
      const r = await fetch('/api/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pilier, brief })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `Erreur ${r.status}`);
      setProposals(data.proposals || []);
      setGenModel(data.model || null);
    } catch (e: any) {
      setGenError(e.message);
    } finally {
      setGenLoading(false);
    }
  }

  async function handleSave(asScheduled: boolean) {
    setSaveLoading(true); setSaveMsg(null);
    try {
      const r = await fetch('/api/notion/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: initial?.id,
          title: title || (text.split('\n')[0] || 'Sans titre').slice(0, 80),
          pilier,
          date: asScheduled ? date : undefined,
          time: asScheduled ? time : undefined,
          anonymisation_ok: anonOk,
          content: text
        })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erreur sauvegarde Notion');
      const pageId = data.id || initial?.id;
      if (pageId) { await fetch(`/api/notion/post/${pageId}/validate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ validated }) }).catch(() => {}); }
      setSaveMsg(asScheduled ? 'ProgrammÃ© dans Notion â' : 'SauvegardÃ© en draft â');
    } catch (e: any) {
      setSaveMsg('Erreur : ' + e.message);
    } finally {
      setSaveLoading(false);
    }
  }

  const pilierIsCasClient = pilier?.includes('Cas client');
  const visualPromptDefault = text ? `Visuel d'accompagnement pour ce post LinkedIn :\n\n${text.slice(0, 300)}\n\n(Heelio design system, ${pilier})` : '';

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-ink-900">{initial ? 'Modifier le post' : 'Nouveau post'}</h1>
        <p className="mt-1 text-ink-500">Pilier, brief, gÃ©nÃ©ration IA, validation manuelle, programmation.</p>
      </header>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* LEFT â Setup + IA + Visual */}
        <section className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20">
            <Label>Pilier Ã©ditorial</Label>
            <select value={pilier} onChange={e => setPilier(e.target.value)} className="mt-1 w-full rounded-lg border-ink-300 px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500">
              {PILIERS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {pilierIsCasClient && (
              <label className="mt-3 flex items-start gap-3 cursor-pointer select-none">
                <input type="checkbox" checked={anonOk} onChange={e => setAnonOk(e.target.checked)} className="mt-1 w-4 h-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500" />
                <span className="text-xs text-ink-700">Anonymisation OK validÃ©e (obligatoire avant publication)</span>
              </label>
            )}

            <Label className="mt-4">Brief / pitch</Label>
            <textarea value={brief} onChange={e => setBrief(e.target.value)} rows={4} placeholder="Ex : un client a divisÃ© par 2 son DSO en passant Ã  Heelio. Veux raconter le dÃ©clic + rÃ©sultat sans donner le nom."
              className="mt-1 w-full rounded-lg border-ink-300 px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />

            <button onClick={handleGenerate} disabled={genLoading || !brief.trim()}
              className="mt-3 w-full px-4 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50">
              {genLoading ? 'GÃ©nÃ©ration Claude en coursâ¦ (15-30 sec)' : 'â¨ GÃ©nÃ©rer 3 propositions'}
            </button>
            {genError && (
              <div className="mt-3 p-3 rounded-lg bg-danger-50 ring-1 ring-inset ring-danger-500/20 text-sm text-danger-700">
                <strong className="font-semibold">Erreur Anthropic :</strong> {genError}
              </div>
            )}
          </div>

          {proposals.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-ink-900 text-sm flex items-center gap-2">
                Propositions gÃ©nÃ©rÃ©es
                {genModel && <StatusBadge variant="brand">{genModel}</StatusBadge>}
              </h3>
              {proposals.map((p, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 shadow-card ring-1 ring-inset ring-ink-300/20">
                  <div className="flex items-center justify-between mb-2">
                    <StatusBadge variant="brand">Proposition {i + 1}</StatusBadge>
                    <button onClick={() => setText(p)} className="text-xs px-3 py-1.5 rounded-lg bg-ink-100 text-ink-700 hover:bg-ink-200">
                      Utiliser ce texte
                    </button>
                  </div>
                  <p className="text-sm text-ink-700 whitespace-pre-wrap">{p}</p>
                </div>
              ))}
            </div>
          )}

          {/* Visual generator */}
          <VisualGenerator defaultPrompt={visualPromptDefault} notionPageId={initial?.id} />
        </section>

        {/* RIGHT â Editor + lint + actions */}
        <section className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20">
            <Label>Titre interne (Notion)</Label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre lisible pour la DB Notion" className="mt-1 w-full rounded-lg border-ink-300 px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />

            <div className="flex items-center justify-between mt-4">
              <Label>Texte du post LinkedIn</Label>
              <span className={`text-xs ${charCount > 1300 ? 'text-danger-700' : charCount > 900 ? 'text-warn-700' : 'text-ink-500'}`}>{charCount} / 1300</span>
            </div>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={14} placeholder="Le texte exact tel qu'il sera publiÃ© sur LinkedIn." className="mt-1 w-full rounded-lg border-ink-300 px-3 py-2 text-sm font-mono focus:ring-brand-500 focus:border-brand-500" />
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20">
            <h3 className="font-semibold text-ink-900 text-sm">Garde-fous Ã©ditoriaux</h3>
            {lint.length === 0
              ? <p className="mt-2 text-sm text-success-700">Aucun problÃ¨me dÃ©tectÃ©.</p>
              : <ul className="mt-2 space-y-1.5">
                  {lint.map(h => (
                    <li key={h.id} className="text-sm">
                      <StatusBadge variant={h.severity === 'critical' ? 'danger' : h.severity === 'high' ? 'warn' : 'neutral'}>
                        {h.severity}
                      </StatusBadge>
                      <span className="ml-2 text-ink-700">{h.label}</span>
                      {h.matches[0] && <span className="ml-2 text-ink-500 text-xs">"{h.matches[0]}"</span>}
                    </li>
                  ))}
                </ul>}
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20">
            <h3 className="font-semibold text-ink-900 text-sm">Programmation</h3>
            <div className="mt-3 flex gap-3">
              <div className="flex-1">
                <Label>Date</Label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 w-full rounded-lg border-ink-300 px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
              </div>
              <div className="flex-1">
                <Label>Heure</Label>
                <input type="time" value={time} onChange={e => setTime(e.target.value)} className="mt-1 w-full rounded-lg border-ink-300 px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-500">L'auto-publication tourne 1Ã/jour Ã  5h30 UTC (â 7h30 Paris). Pour publier Ã  l'heure exacte, utilisez "Publier maintenant" aprÃ¨s validation.</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20 space-y-2">
            <label className="flex items-start gap-3 cursor-pointer select-none p-2 rounded-lg ring-1 ring-ink-100 bg-warn-50/30">
              <input type="checkbox" checked={validated} onChange={e => setValidated(e.target.checked)} className="mt-1 w-4 h-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500" />
              <span className="text-sm text-ink-700">
                <strong className="block text-ink-900">Validé pour publication automatique</strong>
                <span className="text-xs text-ink-500">Si coché, le cron quotidien publiera ce post à l'heure programmée. Sinon il restera en draft, même si la date est passée.</span>
              </span>
            </label>
            <button onClick={() => handleSave(false)} disabled={saveLoading || !text.trim()} className="w-full px-4 py-2.5 rounded-lg ring-1 ring-ink-300 text-ink-700 text-sm font-medium hover:bg-ink-50 disabled:opacity-50">
              {saveLoading ? 'Sauvegardeâ¦' : 'Sauvegarder en draft'}
            </button>
            <button onClick={() => handleSave(true)} disabled={saveLoading || !text.trim()} className="w-full px-4 py-2.5 rounded-lg ring-1 ring-brand-500 text-brand-700 text-sm font-medium hover:bg-brand-50 disabled:opacity-50">
              {saveLoading ? 'Sauvegardeâ¦' : `Programmer pour le ${new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} Ã  ${time}`}
            </button>
            <button
              onClick={() => setPublishOpen(true)}
              disabled={!text.trim() || (pilierIsCasClient && !anonOk) || lint.some(h => h.severity === 'critical')}
              className="w-full px-4 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50">
              Publier maintenantâ¦
            </button>
            {pilierIsCasClient && !anonOk && (
              <p className="text-xs text-warn-700">Cochez "Anonymisation OK" avant de publier un cas client.</p>
            )}
            {lint.some(h => h.severity === 'critical') && (
              <p className="text-xs text-danger-700">Corrigez les garde-fous critiques avant publication.</p>
            )}
            {saveMsg && <p className="text-sm text-ink-700">{saveMsg}</p>}
          </div>
        </section>
      </div>

      <PublishModal open={publishOpen} onClose={() => setPublishOpen(false)} text={text} notionPageId={initial?.id} />
    </div>
  );
}

function Label({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <label className={`block text-xs font-medium text-ink-700 ${className}`}>{children}</label>;
}

function analyzeAntiPatterns(text: string) {
  const hits: { id: string; label: string; severity: 'critical' | 'high' | 'medium'; matches: string[] }[] = [];
  if (!text.trim()) return hits;
  if (/[ââ]/.test(text))                      hits.push({ id: 'em_dash',    label: 'Tiret long (â ou â) interdit', severity: 'critical', matches: text.match(/[ââ]/g) || [] });
  if (/(c['e]?st|n['e]?st)\s+pas\s+\w+[\s,]+c['e]?st\s+\w+/i.test(text)) hits.push({ id: 'not_x_y', label: '"Ce n\'est pas X, c\'est Y" interdit', severity: 'critical', matches: ['(dÃ©tectÃ©)'] });
  if (/\b(seamless|robust|delve|leverage|unlock|unleash|deep dive|game[- ]?changer|dans un monde oÃ¹)\b/i.test(text)) hits.push({ id: 'creux', label: 'Mot creux IA dÃ©tectÃ©', severity: 'high', matches: text.match(/\b(seamless|robust|delve|leverage|unlock|unleash|deep dive|game[- ]?changer|dans un monde oÃ¹)\b/gi) || [] });
  const emojiCount = (text.match(/\p{Extended_Pictographic}/gu) || []).length;
  if (emojiCount > 3) hits.push({ id: 'emoji', label: `${emojiCount} emojis (max 3)`, severity: 'medium', matches: [] });
  if (/\b(tu|toi|ton|ta|tes)\b/i.test(text)) hits.push({ id: 'tu', label: 'Tutoiement dÃ©tectÃ© (vouvoiement requis)', severity: 'high', matches: text.match(/\b(tu|toi|ton|ta|tes)\b/gi) || [] });
  return hits;
}
