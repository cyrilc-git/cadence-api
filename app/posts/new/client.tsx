'use client';

import { useMemo, useState, useRef } from 'react';
import StatusBadge from '@/components/StatusBadge';
import PublishModal from '@/components/PublishModal';
import VisualGenerator from '@/components/VisualGenerator';
import MentionTextarea, { caretCoords } from '@/components/MentionTextarea';
import SlashMenu, { detectSlashQuery, SlashCommand } from '@/components/SlashMenu';


const PILIERS = [
  'Lundi · Cas client',
  'Lundi · Cas dirigeant anonymisé',
  'Mardi · Pédagogie sans jargon',
  'Mercredi · Produit / démo / nouveauté / release note',
  'Jeudi · Opinion / hot take mesuré',
  'Vendredi · Build in public'
];

type Initial = null | { id?: string; title: string; pilier?: string; content: string; date?: string };

type Recyclable = { id: string; title: string; pilier?: string; impressions?: number; published_at: string };
export default function NewPostClient({
  initial, prefillBrief, prefillHook,
  suggestSource, suggestId, suggestScore, suggestPilier,
  suggestAngle, suggestWhy, suggestVisualIdea,
  filterSource, recyclables = []
}: {
  initial: Initial;
  prefillBrief?: string;
  prefillHook?: string;
  suggestSource?: string | null;
  suggestId?: string | null;
  suggestScore?: number | null;
  suggestPilier?: string | null;
  suggestAngle?: string | null;
  suggestWhy?: string | null;
  suggestVisualIdea?: string | null;
  filterSource?: string | null;
  recyclables?: Recyclable[];
}) {
  const [pilier, setPilier] = useState(initial?.pilier || PILIERS[2]);
  const [brief, setBrief] = useState(prefillBrief || '');
  const [text, setText] = useState(initial?.content || '');
  const [title, setTitle] = useState(initial?.title || '');
  const [date, setDate] = useState(initial?.date || new Date().toISOString().slice(0,10));
  const [time, setTime] = useState('07:30');
  const [anonOk, setAnonOk] = useState(false);
  const [validated, setValidated] = useState(false);

  // Auto-pre-fill date based on pilier
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

  // V8.5 — slash menu + mention textarea ref
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashAnchor, setSlashAnchor] = useState<{ top: number; left: number } | null>(null);
  const [slashTrigger, setSlashTrigger] = useState(0);
  const [aiBusy, setAiBusy] = useState(false);

  function onTextChange(next: string) {
    setText(next);
    const ta = taRef.current;
    if (!ta) { setSlashOpen(false); return; }
    const caret = ta.selectionStart;
    const detection = detectSlashQuery(next, caret);
    if (detection) {
      setSlashOpen(true);
      setSlashQuery(detection.query);
      setSlashTrigger(detection.trigger);
      try { setSlashAnchor(caretCoords(ta, detection.trigger)); } catch {/* silent */}
    } else {
      setSlashOpen(false);
    }
  }

  async function applySlashCommand(cmd: SlashCommand) {
    setSlashOpen(false);
    const ta = taRef.current;
    if (!ta) return;
    const caret = ta.selectionStart;
    const cleaned = text.slice(0, slashTrigger) + text.slice(caret);
    setText(cleaned);
    setAiBusy(true);
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notion_page_id: initial?.id || 'new-post', draft: cleaned || (initial?.content || ''), instruction: cmd.prompt })
      });
      const d = await r.json();
      if (r.ok && d.rewrite) setText(d.rewrite);
      else alert(d.error || 'Erreur IA');
    } catch (e: any) {
      alert('Erreur IA : ' + e.message);
    } finally { setAiBusy(false); }
  }

  const charCount = text.length;
  const lint = useMemo(() => analyzeAntiPatterns(text), [text]);

  async function handleGenerate() {
    setGenLoading(true); setGenError(null); setProposals([]); setGenModel(null);
    try {
      const r = await fetch('/api/generate-post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pilier, brief }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `Erreur ${r.status}`);
      setProposals(data.proposals || []);
      setGenModel(data.model || null);
    } catch (e: any) { setGenError(e.message); }
    finally { setGenLoading(false); }
  }

  async function handleSave(asScheduled: boolean) {
    setSaveLoading(true); setSaveMsg(null);
    try {
      const r = await fetch('/api/notion/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        id: initial?.id,
        title: title || (text.split('\n')[0] || 'Sans titre').slice(0, 80),
        pilier,
        date: asScheduled ? date : undefined,
        time: asScheduled ? time : undefined,
        anonymisation_ok: anonOk,
        content: text
      }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erreur sauvegarde Notion');
      const pageId = data.id || initial?.id;
      if (pageId) await fetch(`/api/notion/post/${pageId}/validate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ validated }) }).catch(() => {});
      setSaveMsg(asScheduled ? `Programmé ${validated ? '✓ (validé pour cron)' : '(à valider)'}` : `Sauvegardé en draft ${validated ? '(validé)' : ''} ✓`);
    } catch (e: any) { setSaveMsg('Erreur : ' + e.message); }
    finally { setSaveLoading(false); }
  }

  const pilierIsCasClient = pilier?.includes('Cas client') || pilier?.includes('Cas dirigeant');
  const visualPromptDefault = text ? `Visuel d'accompagnement pour ce post LinkedIn :\n\n${text.slice(0, 300)}\n\n(Heelio design system, ${pilier})` : '';

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900 tracking-tight">{initial?.id ? 'Modifier le post' : 'Nouveau post'}</h1>
          <p className="mt-1 text-sm text-ink-500 lead">Pilier, brief auto-suggéré, génération IA, validation, programmation.</p>
        </div>
        {!initial?.id && !prefillBrief && (
          <a href="/suggestions" className="btn-secondary text-xs">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M12 3v4M12 17v4M3 12h4M17 12h4"/></svg>
            Voir le Radar
          </a>
        )}
      </header>

      {prefillBrief && !initial?.id && (
        <SuggestionBanner
          source={suggestSource}
          id={suggestId}
          score={suggestScore}
          pilier={suggestPilier}
          brief={prefillBrief}
          hook={prefillHook}
          angle={suggestAngle}
          why={suggestWhy}
          visualIdea={suggestVisualIdea}
          filterSource={filterSource}
          recyclables={recyclables}
        />
      )}
      {!prefillBrief && !initial?.id && recyclables.length > 0 && (
        <RecyclablesPicker recyclables={recyclables} />
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20">
            <Label>Pilier éditorial</Label>
            <select value={pilier} onChange={e => setPilier(e.target.value)} className="mt-1 w-full rounded-lg border-ink-300 px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500">
              {PILIERS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {pilierIsCasClient && (
              <label className="mt-3 flex items-start gap-3 cursor-pointer select-none">
                <input type="checkbox" checked={anonOk} onChange={e => setAnonOk(e.target.checked)} className="mt-1 w-4 h-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500" />
                <span className="text-xs text-ink-700">Anonymisation OK validée (obligatoire avant publication)</span>
              </label>
            )}

            <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
              <Label>Brief / pitch</Label>
              {prefillBrief && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded">
                    Auto-suggéré{suggestSource ? ' · ' + suggestSource : ''}{suggestScore ? ' · ' + suggestScore + '/100' : ''}
                  </span>
                  {suggestId && <a href={'/posts/new?skip=' + suggestId} className="text-[10px] text-brand-700 hover:text-brand-600 underline">Changer d'idée ↻</a>}
                </div>
              )}
            </div>
            <textarea value={brief} onChange={e => setBrief(e.target.value)} rows={4} placeholder="Ex : un client a divisé par 2 son DSO en passant à Heelio. Veux raconter le déclic + résultat sans donner le nom." className="mt-1 w-full rounded-lg border-ink-300 px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />

            <button onClick={handleGenerate} disabled={genLoading || !brief.trim()} className="mt-3 w-full px-4 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50">
              {genLoading ? 'Génération Claude en cours… (15-30 sec)' : '✨ Générer 3 propositions'}
            </button>
            {genError && <div className="mt-3 p-3 rounded-lg bg-danger-50 ring-1 ring-inset ring-danger-500/20 text-sm text-danger-700"><strong className="font-semibold">Erreur Anthropic :</strong> {genError}</div>}
          </div>

          {proposals.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-ink-900 text-sm flex items-center gap-2">Propositions générées{genModel && <StatusBadge variant="brand">{genModel}</StatusBadge>}</h3>
              {proposals.map((p, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 shadow-card ring-1 ring-inset ring-ink-300/20">
                  <div className="flex items-center justify-between mb-2">
                    <StatusBadge variant="brand">Proposition {i + 1}</StatusBadge>
                    <button onClick={() => setText(p)} className="text-xs px-3 py-1.5 rounded-lg bg-ink-100 text-ink-700 hover:bg-ink-200">Utiliser ce texte</button>
                  </div>
                  <p className="text-sm text-ink-700 whitespace-pre-wrap">{p}</p>
                </div>
              ))}
            </div>
          )}

          <VisualGenerator defaultPrompt={visualPromptDefault} notionPageId={initial?.id} />
        </section>

        <section className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20">
            <Label>Titre interne (Notion)</Label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre lisible pour la DB Notion" className="mt-1 w-full rounded-lg border-ink-300 px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" />
            <div className="flex items-center justify-between mt-4">
              <Label>Texte du post LinkedIn</Label>
              <span className={`text-xs ${charCount > 1300 ? 'text-danger-700' : charCount > 900 ? 'text-warn-700' : 'text-ink-500'}`}>{charCount} / 1300</span>
            </div>
            <div className="relative">
              <MentionTextarea
                textareaRef={taRef}
                value={text}
                onChange={onTextChange}
                rows={14}
                placeholder="Tapez / pour les commandes, @ pour mentionner."
                className="mt-1 text-[15px] leading-[1.55] resize-none font-sans"
              />
              {aiBusy && <div className="absolute top-2 right-2 chip chip-brand text-2xs animate-pulse-soft"><span className="dot bg-brand-500" /> Cadence réfléchit…</div>}
              <SlashMenu
                open={slashOpen}
                anchor={slashAnchor}
                query={slashQuery}
                onSelect={applySlashCommand}
                onClose={() => setSlashOpen(false)}
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20">
            <h3 className="font-semibold text-ink-900 text-sm">Garde-fous éditoriaux</h3>
            {lint.length === 0
              ? <p className="mt-2 text-sm text-success-700">Aucun problème détecté.</p>
              : <ul className="mt-2 space-y-1.5">
                  {lint.map(h => (
                    <li key={h.id} className="text-sm">
                      <StatusBadge variant={h.severity === 'critical' ? 'danger' : h.severity === 'high' ? 'warn' : 'neutral'}>{h.severity}</StatusBadge>
                      <span className="ml-2 text-ink-700">{h.label}</span>
                      {h.matches[0] && <span className="ml-2 text-ink-500 text-xs">"{h.matches[0]}"</span>}
                    </li>
                  ))}
                </ul>}
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20">
            <h3 className="font-semibold text-ink-900 text-sm">Programmation</h3>
            <div className="mt-3 flex gap-3">
              <div className="flex-1"><Label>Date</Label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 w-full rounded-lg border-ink-300 px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" /></div>
              <div className="flex-1"><Label>Heure</Label><input type="time" value={time} onChange={e => setTime(e.target.value)} className="mt-1 w-full rounded-lg border-ink-300 px-3 py-2 text-sm focus:ring-brand-500 focus:border-brand-500" /></div>
            </div>
            <p className="mt-2 text-xs text-ink-500">L'auto-publication tourne 1×/jour à 5h30 UTC (≈ 7h30 Paris). Pour publier à l'heure exacte, utilisez « Publier maintenant » après validation.</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20 space-y-2">
            <label className="flex items-start gap-3 cursor-pointer select-none p-2 rounded-lg ring-1 ring-ink-100 bg-warn-50/30">
              <input type="checkbox" checked={validated} onChange={e => setValidated(e.target.checked)} className="mt-1 w-4 h-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500" />
              <span className="text-sm text-ink-700"><strong className="block text-ink-900">Validé pour publication automatique</strong><span className="text-xs text-ink-500">Si coché, le cron quotidien publiera ce post à l'heure programmée. Sinon il reste en draft, même si la date est passée.</span></span>
            </label>
            <button onClick={() => handleSave(false)} disabled={saveLoading || !text.trim()} className="w-full px-4 py-2.5 rounded-lg ring-1 ring-ink-300 text-ink-700 text-sm font-medium hover:bg-ink-50 disabled:opacity-50">{saveLoading ? 'Sauvegarde…' : 'Sauvegarder en draft'}</button>
            <button onClick={() => handleSave(true)} disabled={saveLoading || !text.trim()} className="w-full px-4 py-2.5 rounded-lg ring-1 ring-brand-500 text-brand-700 text-sm font-medium hover:bg-brand-50 disabled:opacity-50">{saveLoading ? 'Sauvegarde…' : `Programmer pour le ${new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} à ${time}`}</button>
            <button onClick={() => setPublishOpen(true)} disabled={!text.trim() || (pilierIsCasClient && !anonOk) || lint.some(h => h.severity === 'critical')} className="w-full px-4 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50">Publier maintenant…</button>
            {pilierIsCasClient && !anonOk && <p className="text-xs text-warn-700">Cochez « Anonymisation OK » avant de publier un cas client.</p>}
            {lint.some(h => h.severity === 'critical') && <p className="text-xs text-danger-700">Corrigez les garde-fous critiques avant publication.</p>}
            {saveMsg && <p className="text-sm text-ink-700">{saveMsg}</p>}
          </div>
        </section>
      </div>

      <PublishModal open={publishOpen} onClose={() => setPublishOpen(false)} text={text} notionPageId={initial?.id} />
    </div>
  );
}

function SuggestionBanner({ source, id, score, pilier, brief, hook, angle, why, visualIdea, filterSource, recyclables }: { source?: string|null; id?: string|null; score?: number|null; pilier?: string|null; brief?: string; hook?: string; angle?: string|null; why?: string|null; visualIdea?: string|null; filterSource?: string|null; recyclables: Recyclable[] }) {
  const [expanded, setExpanded] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showRecyclables, setShowRecyclables] = useState(false);
  const sources = ['notion', 'github', 'heuristic'];
  return (
    <div className="card p-4 border-brand-100 bg-gradient-to-br from-brand-50/40 to-white animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center text-brand-700 text-base shrink-0">✨</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xs uppercase tracking-wider font-semibold text-brand-700">Cadence vous propose</span>
            {source && <span className="chip chip-brand text-2xs">{source}</span>}
            {score != null && <span className="text-2xs text-ink-500">· score {score}/100</span>}
            {pilier && <span className="text-2xs text-ink-500">· {pilier}</span>}
            {filterSource && <span className="chip chip-neutral text-2xs">filtré sur {filterSource}</span>}
          </div>
          <div className="mt-1 text-sm font-medium text-ink-900 leading-snug">{brief}</div>
          {hook && <div className="mt-1.5 text-xs text-ink-600 italic">« {hook} »</div>}
          {expanded && (
            <div className="mt-3 space-y-2 pt-3 border-t border-brand-100 text-xs animate-slide-up">
              {why && <div><span className="font-semibold text-ink-700">Pourquoi maintenant : </span><span className="text-ink-600">{why}</span></div>}
              {angle && <div><span className="font-semibold text-ink-700">Angle suggéré : </span><span className="text-ink-600">{angle}</span></div>}
              {visualIdea && <div><span className="font-semibold text-ink-700">Idée de visuel : </span><span className="text-ink-600">{visualIdea}</span></div>}
              {!why && !angle && !visualIdea && <div className="text-ink-500 italic">Cette suggestion ne contient pas d\'explication détaillée. C\'est probablement une suggestion heuristique.</div>}
            </div>
          )}
          <div className="mt-3 flex items-center gap-1 flex-wrap">
            <button onClick={() => setExpanded(e => !e)} className="btn-ghost text-2xs">
              {expanded ? '↑ Masquer' : '↓ Voir pourquoi'}
            </button>
            {id && <a href={'/posts/new?skip=' + id + (filterSource ? '&source=' + filterSource : '')} className="btn-ghost text-2xs">↻ Changer d\'idée</a>}
            <button onClick={() => setShowSourcePicker(s => !s)} className="btn-ghost text-2xs">⊕ Changer de source</button>
            {recyclables.length > 0 && <button onClick={() => setShowRecyclables(s => !s)} className="btn-ghost text-2xs">⟲ Depuis un ancien post</button>}
          </div>
          {showSourcePicker && (
            <div className="mt-2 p-2 rounded-lg border border-ink-200 bg-white animate-slide-up">
              <div className="text-2xs font-semibold text-ink-500 mb-1.5">Choisir une source</div>
              <div className="flex flex-wrap gap-1">
                <a href="/posts/new" className={`text-2xs px-2 py-1 rounded-md border transition ${!filterSource ? 'bg-brand-50 border-brand-300 text-brand-700' : 'border-ink-200 hover:bg-ink-50'}`}>Toutes</a>
                {sources.map(s => (
                  <a key={s} href={'/posts/new?source=' + s} className={`text-2xs px-2 py-1 rounded-md border transition ${filterSource === s ? 'bg-brand-50 border-brand-300 text-brand-700' : 'border-ink-200 hover:bg-ink-50'}`}>{s}</a>
                ))}
              </div>
            </div>
          )}
          {showRecyclables && recyclables.length > 0 && (
            <div className="mt-2 p-2 rounded-lg border border-ink-200 bg-white animate-slide-up max-h-72 overflow-y-auto">
              <div className="text-2xs font-semibold text-ink-500 mb-1.5">Anciens posts à recycler ({recyclables.length})</div>
              <div className="space-y-1">
                {recyclables.map(r => (
                  <a key={r.id} href={'/posts/new?from=' + r.id + '&recycle=1'} className="block p-2 rounded-md hover:bg-ink-50 text-xs transition">
                    <div className="font-medium text-ink-900 truncate">{r.title}</div>
                    <div className="text-2xs text-ink-500 mt-0.5">{r.pilier || '—'} · publié le {new Date(r.published_at).toLocaleDateString('fr-FR')}{r.impressions ? ' · ' + r.impressions.toLocaleString('fr-FR') + ' impressions' : ''}</div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RecyclablesPicker({ recyclables }: { recyclables: Recyclable[] }) {
  return (
    <div className="card p-4 border-ink-200 animate-slide-up">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-ink-900 text-sm">Aucune suggestion fraîche pour l\'instant</h3>
        <a href="/suggestions" className="btn-ghost text-2xs">Lancer le radar</a>
      </div>
      <p className="text-xs text-ink-500 mb-3">En attendant, voici {recyclables.length} ancien{recyclables.length > 1 ? 's' : ''} post{recyclables.length > 1 ? 's' : ''} qui pourrai{recyclables.length > 1 ? 'ent' : 't'} être recyclé{recyclables.length > 1 ? 's' : ''} :</p>
      <div className="space-y-1">
        {recyclables.slice(0, 5).map(r => (
          <a key={r.id} href={'/posts/new?from=' + r.id + '&recycle=1'} className="block p-2 rounded-lg border border-ink-100 hover:border-brand-200 hover:bg-brand-50/30 transition">
            <div className="text-sm font-medium text-ink-900">{r.title}</div>
            <div className="text-2xs text-ink-500 mt-0.5">{r.pilier || '—'} · publié le {new Date(r.published_at).toLocaleDateString('fr-FR')}{r.impressions ? ' · ' + r.impressions.toLocaleString('fr-FR') + ' impressions' : ''}</div>
          </a>
        ))}
      </div>
    </div>
  );
}

function Label({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <label className={`block text-xs font-medium text-ink-700 ${className}`}>{children}</label>;
}

function analyzeAntiPatterns(text: string) {
  const hits: { id: string; label: string; severity: 'critical' | 'high' | 'medium'; matches: string[] }[] = [];
  if (!text.trim()) return hits;
  if (/[—–]/.test(text)) hits.push({ id: 'em_dash', label: 'Tiret long (— ou –) interdit', severity: 'critical', matches: text.match(/[—–]/g) || [] });
  if (/(c['e]?st|n['e]?st)\s+pas\s+\w+[\s,]+c['e]?st\s+\w+/i.test(text)) hits.push({ id: 'not_x_y', label: '« Ce n\'est pas X, c\'est Y » interdit', severity: 'critical', matches: ['(détecté)'] });
  if (/\b(seamless|robust|delve|leverage|unlock|unleash|deep dive|game[- ]?changer|dans un monde où)\b/i.test(text)) hits.push({ id: 'creux', label: 'Mot creux IA détecté', severity: 'high', matches: text.match(/\b(seamless|robust|delve|leverage|unlock|unleash|deep dive|game[- ]?changer|dans un monde où)\b/gi) || [] });
  const emojiCount = (text.match(/\p{Extended_Pictographic}/gu) || []).length;
  if (emojiCount > 3) hits.push({ id: 'emoji', label: `${emojiCount} emojis (max 3)`, severity: 'medium', matches: [] });
  if (/\b(tu|toi|ton|ta|tes)\b/i.test(text)) hits.push({ id: 'tu', label: 'Tutoiement détecté (vouvoiement requis)', severity: 'high', matches: text.match(/\b(tu|toi|ton|ta|tes)\b/gi) || [] });
  return hits;
}
