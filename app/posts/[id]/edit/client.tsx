'use client';

import { useEffect, useState } from 'react';
import LinkedInPreview, { toBold, toItalic } from '@/components/LinkedInPreview';
import PublishModal from '@/components/PublishModal';
import VisualGenerator from '@/components/VisualGenerator';

const QUICK_ACTIONS = [
  { label: 'Améliorer le hook',          prompt: 'Améliore le hook : rends-le plus accrocheur, < 80 caractères, factuel, sans clickbait.' },
  { label: 'Raccourcir',                 prompt: "Raccourcis ce post à 600-700 caractères en préservant l'essentiel et un exemple chiffré." },
  { label: 'Rendre plus concret',        prompt: 'Rends ce post plus concret : ajoute un exemple chiffré, un cas anonymisé, des paragraphes plus courts.' },
  { label: 'Adapter au vouvoiement',     prompt: 'Vérifie le vouvoiement strict. Corrige tout tutoiement.' },
  { label: 'Améliorer la mise en forme', prompt: 'Améliore la mise en forme LinkedIn : paragraphes courts, hook fort, mots-clés en gras Unicode si pertinent (𝗯𝗼𝗹𝗱), pas de tiret long, hashtags ciblés à la fin.' },
  { label: 'Nettoyer style IA',          prompt: 'Retire tout style IA reconnaissable : phrases creuses, formules signature, mots interdits.' },
  { label: 'Proposer une illustration',  prompt: "Propose un brief d'illustration pour ce post : style design system Heelio (couleurs #6366F1, #4F46E5, fond #F8FAFC), format 1200x630." }
];

export default function EditClient({ initial, validated: initialValidated }: { initial: { summary: any; content: string }; validated: boolean }) {
  const { summary } = initial;
  const [text, setText] = useState(initial.content);
  const [versions, setVersions] = useState<string[]>([initial.content]);
  const [validated, setValidated] = useState(initialValidated);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [chat, setChat] = useState<{ role: string; content: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [publishOpen, setPublishOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function removeFromCadence() {
    if (!confirm(`Retirer ce post de Cadence ? La page Notion reste intacte. Ce post n'apparaîtra plus comme « Créé par Cadence ».`)) return;
    setRemoving(true);
    try {
      const r = await fetch(`/api/cadence-drafts/${summary.id}`, { method: 'DELETE' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      alert('Retiré de Cadence. La page Notion existe toujours.');
      window.location.href = '/posts';
    } catch (e: any) { alert('Erreur : ' + e.message); }
    finally { setRemoving(false); }
  }

  useEffect(() => {
    fetch(`/api/chat?notion_page_id=${summary.id}`).then(r => r.json()).then(d => setChat(d.messages || [])).catch(() => {});
  }, [summary.id]);

  async function runChat(prompt: string) {
    setChatLoading(true); setChatInput('');
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notion_page_id: summary.id, draft: text, instruction: prompt }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setChat(c => [...c, { role: 'user', content: prompt }, { role: 'assistant', content: d.rewrite }]);
    } catch (e: any) {
      setChat(c => [...c, { role: 'user', content: prompt }, { role: 'assistant', content: 'Erreur : ' + e.message }]);
    } finally { setChatLoading(false); }
  }
  function applyRewrite(rewrite: string) { setVersions(v => [...v, rewrite]); setText(rewrite); }
  function revert() {
    if (versions.length < 2) return;
    const v = [...versions]; v.pop(); setVersions(v); setText(v[v.length - 1]);
  }
  function applyTransform(transform: (s: string) => string) {
    const ta = document.getElementById('post-text-editor') as HTMLTextAreaElement | null;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    if (start === end) return;
    setText(text.slice(0, start) + transform(text.slice(start, end)) + text.slice(end));
  }

  async function save() {
    setSaving(true); setSaveMsg(null);
    try {
      const r = await fetch('/api/notion/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: summary.id, title: summary.title, pilier: summary.pilier, date: summary.scheduled_at?.slice(0,10), time: summary.scheduled_time, content: text })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await fetch(`/api/notion/post/${summary.id}/validate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ validated }) });
      setSaveMsg(`Sauvegardé ${validated ? '✓ (validé pour cron)' : '(non validé)'}`);
    } catch (e: any) { setSaveMsg('Erreur : ' + e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs text-ink-500">{summary.pilier || ''}</p>
          <h1 className="text-2xl font-semibold text-ink-900">{summary.title || 'Sans titre'}</h1>
          <p className="mt-1 text-xs text-ink-500">
            {summary.scheduled_at ? new Date(summary.scheduled_at).toLocaleString('fr-FR') : '(pas de date)'}
            {validated ? <span className="ml-2 text-success-700">â validé</span> : <span className="ml-2 text-warn-700">⚠ non validé</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <a href={summary.notion_url} target="_blank" rel="noopener" className="text-xs px-3 py-1.5 rounded-lg ring-1 ring-ink-300 hover:bg-ink-50">Ouvrir dans Notion</a>
          {summary.linkedin_url && <a href={summary.linkedin_url} target="_blank" rel="noopener" className="text-xs px-3 py-1.5 rounded-lg ring-1 ring-ink-300 hover:bg-ink-50">Voir sur LinkedIn</a>}
        </div>
      </header>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <button onClick={() => applyTransform(toBold)}   className="text-xs px-2 py-1 rounded ring-1 ring-ink-300 hover:bg-ink-50" title="Sélection en gras Unicode">𝗕</button>
              <button onClick={() => applyTransform(toItalic)} className="text-xs px-2 py-1 rounded ring-1 ring-ink-300 hover:bg-ink-50" title="Sélection en italique Unicode">𝘐</button>
              <button onClick={() => setText(text.replace(/[—–]/g, ','))} className="text-xs px-2 py-1 rounded ring-1 ring-ink-300 hover:bg-ink-50">Retirer tirets longs</button>
              <button onClick={() => setText(text.replace(/\n+/g, '\n\n').trim())} className="text-xs px-2 py-1 rounded ring-1 ring-ink-300 hover:bg-ink-50">Aérer paragraphes</button>
              <span className="ml-auto text-xs text-ink-500">{text.length} / 1300</span>
            </div>
            <textarea id="post-text-editor" value={text} onChange={e => setText(e.target.value)} rows={16} className="w-full rounded-lg border-ink-300 px-3 py-2 text-sm font-mono focus:ring-brand-500 focus:border-brand-500" />
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20">
            <h3 className="font-semibold text-ink-900 text-sm">Améliorer avec l'IA</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_ACTIONS.map(a => (
                <button key={a.label} onClick={() => runChat(a.prompt)} disabled={chatLoading} className="text-xs px-3 py-1.5 rounded-lg ring-1 ring-ink-300 hover:bg-brand-50 hover:ring-brand-500/30 disabled:opacity-50">{a.label}</button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && chatInput && runChat(chatInput)} placeholder="Ou tapez une instruction libre…" className="flex-1 px-3 py-2 rounded-lg ring-1 ring-ink-300 text-sm" />
              <button onClick={() => chatInput && runChat(chatInput)} disabled={chatLoading || !chatInput} className="px-3 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50">{chatLoading ? '…' : 'Envoyer'}</button>
            </div>
            <div className="mt-4 max-h-96 overflow-y-auto space-y-3">
              {chat.length === 0 && <p className="text-xs text-ink-500 italic">Aucun message. Cliquez sur une suggestion ci-dessus pour démarrer.</p>}
              {chat.map((m, i) => (
                <div key={i} className={`rounded-lg p-3 text-sm ring-1 ring-inset ${m.role === 'user' ? 'ring-ink-300/40 bg-ink-50' : 'ring-brand-500/20 bg-brand-50/30'}`}>
                  <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-500 mb-1">{m.role === 'user' ? 'Vous' : 'Cadence IA'}</div>
                  <div className="whitespace-pre-wrap text-ink-700">{m.content}</div>
                  {m.role === 'assistant' && (
                    <button onClick={() => applyRewrite(m.content)} className="mt-2 text-xs px-2 py-1 rounded-lg bg-brand-500 text-white hover:bg-brand-600">Appliquer cette version</button>
                  )}
                </div>
              ))}
            </div>
            {versions.length > 1 && (
              <button onClick={revert} className="mt-3 text-xs px-3 py-1.5 rounded-lg ring-1 ring-ink-300 hover:bg-ink-50">â¶ Revenir à la version précédente ({versions.length - 1})</button>
            )}
          </div>
        <VisualGenerator defaultPrompt={`Visuel d'accompagnement pour ce post LinkedIn :\n\n${text.slice(0, 300)}\n\n(Style ${summary.pilier || 'Heelio'})`} notionPageId={summary.id} />
        </section>

        <section className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20">
            <h3 className="font-semibold text-ink-900 text-sm mb-3">Aperçu LinkedIn</h3>
            <LinkedInPreview text={text} />
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20 space-y-2">
            <label className="flex items-start gap-3 cursor-pointer select-none p-2 rounded-lg ring-1 ring-ink-100 bg-warn-50/30">
              <input type="checkbox" checked={validated} onChange={e => setValidated(e.target.checked)} className="mt-1 w-4 h-4 rounded border-ink-300 text-brand-500" />
              <span className="text-sm text-ink-700">
                <strong className="block text-ink-900">Validé pour publication automatique</strong>
                <span className="text-xs text-ink-500">Si coché, le cron quotidien publiera ce post à l'heure programmée. Sinon il reste en draft.</span>
              </span>
            </label>
            <button onClick={save} disabled={saving} className="w-full px-4 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50">{saving ? 'Sauvegarde…' : 'Sauvegarder'}</button>
            <button onClick={() => setPublishOpen(true)} disabled={!text.trim()} className="w-full px-4 py-2.5 rounded-lg ring-1 ring-brand-500 text-brand-700 text-sm font-medium hover:bg-brand-50 disabled:opacity-50">Publier maintenant…</button>
            {saveMsg && <p className="text-sm text-ink-700">{saveMsg}</p>}
          </div>
        </section>
      </div>

      <PublishModal open={publishOpen} onClose={() => setPublishOpen(false)} text={text} notionPageId={summary.id} />
    </div>
  );
}
