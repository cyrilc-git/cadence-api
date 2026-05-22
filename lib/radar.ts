import { suggestionUpsert, suggestionsList, Suggestion } from './db';
import { getNotionPost } from './notion';
import { listPostSummaries } from './content-items';
import { noveltyScore } from './embeddings';
import { whyNowFor } from './radar-insights';
import { supabase } from './supabase';
import { buildEditorialDrifts } from './brain';

// === Notion deep radar ===
// V8  : reads actual content of recent posts, detects recyclables, surfaces drafts.
// V11.1 : lit la couche canonique content_items (au lieu de Notion direct).
export async function radarFromNotion(): Promise<number> {
  let count = 0;
  try {
    const posts = await listPostSummaries({ limit: 120 });
    const now = Date.now();
    const SIX_MONTHS = 1000 * 60 * 60 * 24 * 180;

    // 1. Drafts récents (< 30 jours, pas encore validés/programmés) — exploiter
    const recentDrafts = posts.filter(p => p.status === 'draft' || (p.status === 'scheduled' && !p.validated));
    for (const p of recentDrafts.slice(0, 8)) {
      if (!p.title || p.title === 'Sans titre') continue;
      // V8.3 — distribute scores (variance réelle pour éviter le 80/100 uniforme)
      const titleLen = (p.title || '').length;
      const lenSignal = titleLen > 60 && titleLen < 120 ? 8 : titleLen > 30 ? 4 : 0;
      const recencyBonus = p.scheduled_at && (Date.now() - new Date(p.scheduled_at).getTime()) < 1000*60*60*24*7 ? 6 : 0;
      const score = Math.min(95, Math.max(30,
        45 + (p.pilier ? 8 : 0) + (p.scheduled_at ? 8 : 0) + (p.cadence_source ? 5 : 0) + lenSignal + recencyBonus + Math.floor(Math.random()*15)
      ));
      const fmt = inferFormat(p.pilier);
      await suggestionUpsert({
        source: 'notion',
        source_ref: `draft-${p.id}`,
        title: p.title,
        hook: pickHookFromTitle(p.title, p.pilier),
        angle: p.pilier ? `Angle ${p.pilier.toLowerCase()}, à étoffer` : 'Angle à préciser',
        pilier: p.pilier,
        score,
        why: p.scheduled_at
          ? `Programmé le ${new Date(p.scheduled_at).toLocaleDateString('fr-FR')} mais non validé — à finaliser`
          : 'Brouillon Notion sans date — angle prêt à exploiter',
        payload: {
          notion_url: p.notion_url,
          scheduled_at: p.scheduled_at,
          format: fmt,
          visual_idea: visualIdeaFor(p.pilier),
          cadence_source: p.cadence_source || null,
          notion_page_id: p.id
        }
      });
      count++;
    }

    // 2. Posts publiés > 6 mois — recyclable
    const recyclables = posts.filter(p => p.status === 'published' && p.scheduled_at && new Date(p.scheduled_at).getTime() < now - SIX_MONTHS);
    for (const p of recyclables.slice(0, 6)) {
      // Try to deep-read the content
      let excerpt = '';
      let theme = '';
      try {
        const full = await getNotionPost(p.id);
        if (full?.content) {
          excerpt = full.content.split('\n').filter(Boolean).slice(0, 3).join(' ').slice(0, 280);
          theme = extractTheme(full.content);
        }
      } catch {/* silent */}

      const monthsAgo = Math.round((now - new Date(p.scheduled_at!).getTime()) / (1000 * 60 * 60 * 24 * 30));
      // Variant 1 : version courte
      await suggestionUpsert({
        source: 'notion',
        source_ref: `recycle-short-${p.id}`,
        title: `Recycler en version courte : « ${truncate(p.title, 60)} »`,
        hook: theme ? `« ${theme} » — relu après 6 mois` : shortHook(p.title),
        angle: 'Réécriture serrée, format 600-700 chars, ton plus assertif',
        pilier: p.pilier,
        score: 78,
        why: `Publié il y a ${monthsAgo} mois (${p.impressions || 0} impressions). Vos lecteurs récents ne l'ont pas vu.`,
        payload: { notion_url: p.notion_url, recycle_from: p.id, variant: 'short', excerpt, format: 'text', visual_idea: visualIdeaFor(p.pilier), original_published_at: p.scheduled_at }
      });
      count++;

      // Variant 2 : carrousel
      await suggestionUpsert({
        source: 'notion',
        source_ref: `recycle-carrousel-${p.id}`,
        title: `Recycler en carrousel : « ${truncate(p.title, 50)} »`,
        hook: 'Le même message en 6 slides illustrées',
        angle: 'Découpage en 6 cartes : problème → contexte → 3 leçons → CTA',
        pilier: p.pilier || 'Mardi · Pédagogie',
        score: 72,
        why: `Performe historiquement sur ce thème. Le carrousel élargit la portée organique.`,
        payload: { notion_url: p.notion_url, recycle_from: p.id, variant: 'carrousel', excerpt, format: 'carousel', visual_idea: 'Carrousel 6 slides, palette Heelio bleu, 1 idée par slide.' }
      });
      count++;

      // Variant 3 : opinion
      await suggestionUpsert({
        source: 'notion',
        source_ref: `recycle-opinion-${p.id}`,
        title: `Recycler en opinion : « ${truncate(p.title, 50)} »`,
        hook: theme ? `Ce que j'ai appris en relisant mon post sur « ${theme} »` : 'Mon avis a évolué sur ce sujet',
        angle: 'Hot take basé sur 6 mois de recul, exemple récent',
        pilier: 'Jeudi · Opinion',
        score: 75,
        why: 'Recyclage en pilier opinion = nouvelle perspective sur un sujet déjà validé par votre audience.',
        payload: { notion_url: p.notion_url, recycle_from: p.id, variant: 'opinion', excerpt, format: 'text', visual_idea: 'Aucun visuel — texte pur en opinion' }
      });
      count++;
    }

    // 3. Top performant récent (impressions > 1000) — capitaliser
    const topPerformers = posts
      .filter(p => p.status === 'published' && (p.impressions || 0) > 1000 && p.scheduled_at && new Date(p.scheduled_at).getTime() > now - SIX_MONTHS)
      .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
      .slice(0, 3);
    for (const p of topPerformers) {
      await suggestionUpsert({
        source: 'notion',
        source_ref: `winner-followup-${p.id}`,
        title: `Suite au top post : « ${truncate(p.title, 50)} »`,
        hook: 'Vous avez aimé ce post — voici la suite',
        angle: 'Approfondir un aspect précis du post original. Format démonstration.',
        pilier: p.pilier || 'Mercredi · Produit',
        score: 82,
        why: `${p.impressions} impressions sur le post original — votre audience est engagée sur ce thème.`,
        payload: { notion_url: p.notion_url, followup_from: p.id, format: 'demo', visual_idea: visualIdeaFor(p.pilier), original_impressions: p.impressions }
      });
      count++;
    }
  } catch (e) {
    console.error('radarFromNotion error:', e);
  }
  return count;
}

// === GitHub radar ===
export async function radarFromGitHub(): Promise<number> {
  const token = process.env.GITHUB_TOKEN;
  const repos = (process.env.GITHUB_REPOS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!token || !repos.length) return 0;
  let count = 0;
  for (const repo of repos) {
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=5`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
      });
      if (!r.ok) continue;
      const commits: any[] = await r.json();
      for (const c of commits) {
        const msg = (c.commit?.message || '').split('\n')[0];
        if (!msg) continue;
        if (/^(chore|merge|docs|test)/i.test(msg)) continue;
        const score = /^(feat|feature)/i.test(msg) ? 80 : /^fix/i.test(msg) ? 65 : 50;
        const isFeat = /^(feat|feature)/i.test(msg);
        await suggestionUpsert({
          source: 'github',
          source_ref: `${repo}@${c.sha}`,
          title: msg.slice(0, 120),
          hook: isFeat ? `On vient de sortir : ${msg.replace(/^(feat|feature)[^:]*:\s*/i, '')}` : msg,
          angle: isFeat ? 'Démo nouveauté : screenshot avant/après ou GIF court' : 'Build in public : ce qui a changé concrètement',
          pilier: isFeat ? 'Mercredi · Produit' : 'Vendredi · Build in public',
          score,
          why: `Commit récent dans ${repo} — angle "nouveauté produit" frais (${new Date(c.commit?.author?.date).toLocaleDateString('fr-FR')})`,
          payload: { repo, sha: c.sha, url: c.html_url, author: c.commit?.author?.name, format: isFeat ? 'demo' : 'text', visual_idea: isFeat ? 'Capture annotée du nouveau flow' : null }
        });
        count++;
      }
      const rel = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
      });
      if (rel.ok) {
        const r2 = await rel.json();
        await suggestionUpsert({
          source: 'github',
          source_ref: `${repo}-release-${r2.id}`,
          title: `${r2.name || r2.tag_name} — annonce release`,
          hook: `${r2.name || r2.tag_name} est en ligne. Voici ce qui change pour vous.`,
          angle: 'Release notes condensées en 1 paragraphe + 3 highlights',
          pilier: 'Mercredi · Produit',
          score: 90,
          why: `Release "${r2.tag_name}" publiée le ${new Date(r2.published_at).toLocaleDateString('fr-FR')}`,
          payload: { repo, url: r2.html_url, tag: r2.tag_name, body: (r2.body || '').slice(0, 500), format: 'demo', visual_idea: `Carte produit : "${r2.tag_name}" en gros, 3 bullets à droite, palette Heelio.` }
        });
        count++;
      }
    } catch {}
  }
  return count;
}

// === Heuristic radar ===
export async function radarHeuristics(): Promise<number> {
  const SEEDS: Array<Partial<Suggestion>> = [
    {
      source: 'heuristic', source_ref: 'dso-explainer',
      title: 'Le DSO en 60 secondes', hook: 'Votre DSO grimpe ? Votre trésorerie fond.',
      angle: 'Pédagogie chiffrée : qu\'est-ce que le DSO, comment le calculer, pourquoi ça compte',
      pilier: 'Mardi · Pédagogie', score: 70,
      why: 'Sujet de prédilection des DAF — pédagogie simple, exemple chiffré',
      payload: { format: 'pedagogie', visual_idea: 'Schéma DSO : flèche temps, encaissement = jours, encadré DSO 30j vs 60j' }
    },
    {
      source: 'heuristic', source_ref: 'erreur-1-treso',
      title: "L'erreur n°1 des dirigeants sur la trésorerie",
      hook: 'Ce que je vois chez 8 PME sur 10.',
      angle: 'Hot take : la confusion P&L vs trésorerie, exemple concret',
      pilier: 'Jeudi · Opinion', score: 75,
      why: 'Hot take, fort engagement', payload: { format: 'opinion', visual_idea: null }
    },
    {
      source: 'heuristic', source_ref: 'cas-client-anon',
      title: 'Cas client : -50% DSO en 3 mois',
      hook: 'Une PME services qui a divisé son DSO par 2.',
      angle: 'Storytelling 3 actes : symptôme → diagnostic → résultat',
      pilier: 'Lundi · Cas client', score: 80,
      why: 'Format storytelling anonymisé, à valider Anonymisation OK',
      payload: { format: 'cas', visual_idea: 'Avant/après en chiffres : DSO 65j → 32j, encaissement +180k€' }
    },
    {
      source: 'heuristic', source_ref: 'build-public-mois',
      title: 'Build in public : MRR du mois',
      hook: 'Voici les chiffres bruts du mois.',
      angle: 'Transparence : MRR, churn, CAC, leçon du mois',
      pilier: 'Vendredi · Build in public', score: 72,
      why: 'Rituel hebdo "transparence", génère du commit', payload: { format: 'build', visual_idea: 'Card chiffres mensuels, sparkline 6 mois' }
    },
    {
      source: 'heuristic', source_ref: 'feature-week',
      title: 'La feature de la semaine en démo',
      hook: 'Cette semaine on a sorti X. Voici à quoi ça sert.',
      angle: 'Démo produit : besoin → solution → bénéfice mesurable',
      pilier: 'Mercredi · Produit', score: 78,
      why: 'Démo produit, visuel Claude Design idéal', payload: { format: 'demo', visual_idea: 'Capture annotée du nouveau flow Heelio, 3 numéros' }
    }
  ];
  let count = 0;
  for (const s of SEEDS) { await suggestionUpsert(s as any); count++; }
  return count;
}

// === V11.2 — Radar enrichi par drift éditorial ===
// Quand le Cerveau détecte un drift (ton corporate, pilier sur-utilisé, hooks
// qui s'allongent), on génère une suggestion contrepoids ciblée. L'idée :
// Cadence ne se contente pas de remarquer le drift dans /cerveau, il pousse
// une action concrète dans /suggestions.
export async function radarFromDrift(): Promise<number> {
  let count = 0;
  try {
    const drifts = await buildEditorialDrifts();
    for (const d of drifts) {
      if (d.kind === 'corporate_tone' && /corporate/.test(d.message)) {
        await suggestionUpsert({
          source: 'heuristic',
          source_ref: 'drift-corporate-counter',
          title: 'Un cas anonymisé concret cette semaine',
          hook: 'Pas de jargon. Un dirigeant, un problème chiffré, un déclic.',
          angle: 'Storytelling court, vocabulaire personnel, exemple anonymisé. Évitez les mots "ROI / KPI / framework" cette semaine.',
          pilier: 'Lundi · Cas client',
          score: 78,
          why: 'Cadence remarque un glissement vers un vocabulaire plus corporate. Un cas concret personnel rééquilibre la perception.',
          payload: { format: 'cas', visual_idea: 'Photo silhouette ou symbole humain, pas de schéma data', from_drift: 'corporate_tone' },
        });
        count++;
      } else if (d.kind === 'pilier_concentration') {
        // Extract le pilier dominant depuis le message
        const m = d.message.match(/pilier "([^"]+)"/);
        const dominant = m?.[1] || '';
        // Choisir un pilier opposé thématique
        const opposite = pickOppositePilier(dominant);
        await suggestionUpsert({
          source: 'heuristic',
          source_ref: `drift-pilier-counter-${opposite.split(' ')[0].toLowerCase()}`,
          title: `Varier l'angle avec un post "${opposite.split(' · ')[1] || opposite}"`,
          hook: pickHookForPilier(opposite),
          angle: `Le pilier "${dominant}" concentre vos posts récents. Un post "${opposite}" recadre la perception sans rien renier.`,
          pilier: opposite,
          score: 76,
          why: `Diversification éditoriale. Cadence détecte que "${dominant}" domine trop sur les 60 derniers jours.`,
          payload: { format: inferFormat(opposite), visual_idea: visualIdeaFor(opposite), from_drift: 'pilier_concentration' },
        });
        count++;
      } else if (d.kind === 'hook_length' && /allongent/.test(d.message)) {
        await suggestionUpsert({
          source: 'heuristic',
          source_ref: 'drift-hook-short',
          title: 'Un hook court, une seule phrase',
          hook: 'Une ligne. Pas deux.',
          angle: 'Test format : hook en moins de 80 caractères, sans virgule. Le reste du post peut respirer.',
          pilier: 'Mardi · Pédagogie',
          score: 70,
          why: 'Cadence remarque que vos hooks s\'allongent depuis 60 jours. Un hook court relance l\'attention.',
          payload: { format: 'text', visual_idea: null, from_drift: 'hook_length' },
        });
        count++;
      } else if (d.kind === 'hook_generic') {
        await suggestionUpsert({
          source: 'heuristic',
          source_ref: 'drift-hook-pointu',
          title: 'Un hook personnel et précis',
          hook: 'Évitez "Voici" et "Comment". Commencez par un fait concret de votre semaine.',
          angle: 'Test format : remplacer le hook générique par un détail vécu, anonymisé si besoin.',
          pilier: 'Jeudi · Opinion',
          score: 72,
          why: 'Cadence remarque que vos hooks deviennent plus génériques ces 60 derniers jours.',
          payload: { format: 'text', visual_idea: null, from_drift: 'hook_generic' },
        });
        count++;
      } else if (d.kind === 'format_dropoff') {
        const m = d.message.match(/posts "([^"]+)"/);
        const lost = m?.[1] || 'cas client';
        await suggestionUpsert({
          source: 'heuristic',
          source_ref: `drift-revive-${lost.toLowerCase().replace(/\s+/g, '-').slice(0, 30)}`,
          title: `Revenir au format "${lost}"`,
          hook: `Votre dernier post "${lost}" date d'il y a plus de deux mois.`,
          angle: `Reprendre ce format sans le forcer. Un seul cas, anonymisé, avec un avant/après chiffré.`,
          pilier: lost.toLowerCase().includes('cas') ? 'Lundi · Cas client'
                : lost.toLowerCase().includes('produit') ? 'Mercredi · Produit'
                : lost.toLowerCase().includes('opinion') ? 'Jeudi · Opinion'
                : lost.toLowerCase().includes('build') ? 'Vendredi · Build in public'
                : 'Mardi · Pédagogie',
          score: 74,
          why: `Cadence remarque que ce format a disparu de vos publications récentes.`,
          payload: { format: 'text', visual_idea: null, from_drift: 'format_dropoff' },
        });
        count++;
      } else if (d.kind === 'topic_avoidance') {
        const m = d.message.match(/de "([^"]+)"/);
        const topic = m?.[1] || 'ce sujet';
        await suggestionUpsert({
          source: 'heuristic',
          source_ref: `drift-revive-topic-${topic.toLowerCase().replace(/\s+/g, '-').slice(0, 30)}`,
          title: `Reprendre "${topic}" sous un nouvel angle`,
          hook: `Le sujet "${topic}" a disparu de vos publications.`,
          angle: `Aborder le sujet par un angle nouveau : retour d'expérience récent, pivot, ou contre-prise.`,
          pilier: 'Jeudi · Opinion',
          score: 76,
          why: `Cadence remarque que vous évitez ce sujet depuis plusieurs semaines, alors qu'il faisait partie de votre matière.`,
          payload: { format: 'opinion', visual_idea: null, from_drift: 'topic_avoidance', topic },
        });
        count++;
      }
    }
  } catch (e) {
    console.error('radarFromDrift error:', e);
  }
  return count;
}

function pickOppositePilier(dominant: string): string {
  const all = ['Lundi · Cas client', 'Mardi · Pédagogie', 'Mercredi · Produit', 'Jeudi · Opinion', 'Vendredi · Build in public'];
  // Opposés thématiques heuristiques : Cas client <-> Opinion, Produit <-> Build, Pédagogie reste pivot.
  const opposites: Record<string, string> = {
    'Cas client': 'Jeudi · Opinion',
    'Pédagogie': 'Vendredi · Build in public',
    'Produit': 'Lundi · Cas client',
    'Opinion': 'Mardi · Pédagogie',
    'Build in public': 'Mercredi · Produit',
  };
  const key = dominant.replace(/^[^·]+·\s*/, '').trim();
  if (opposites[key]) return opposites[key];
  // Fallback : prendre un pilier différent du dominant
  return all.find(p => p !== dominant && !p.includes(key)) || 'Jeudi · Opinion';
}

function pickHookForPilier(pilier: string): string {
  const key = pilier.toLowerCase();
  if (key.includes('opinion')) return 'Ce que personne ne dit sur ce sujet.';
  if (key.includes('build')) return 'Les chiffres bruts de la semaine.';
  if (key.includes('produit')) return 'Voici ce qui change concrètement pour vous.';
  if (key.includes('cas')) return 'Un dirigeant. Un blocage. Un déclic.';
  return 'Le réflexe que vous oubliez tous.';
}

export async function runAllRadars() {
  const [n, g, h, d] = await Promise.all([
    radarFromNotion(),
    radarFromGitHub(),
    radarHeuristics(),
    radarFromDrift(),
  ]);
  let enriched = 0;
  try { enriched = await enrichSuggestionsWithNovelty(40); } catch (e) { /* silent */ }
  return { notion: n, github: g, heuristic: h, drift: d, total: n + g + h + d, enriched };
}

export async function enrichSuggestionsWithNovelty(limit = 40): Promise<number> {
  const pending = await suggestionsList('pending', limit).catch(() => []);
  let touched = 0;
  for (const s of pending) {
    const existing = (s as any).payload || {};
    if (existing.novelty != null && existing.enriched_at && (Date.now() - new Date(existing.enriched_at).getTime() < 1000 * 60 * 60 * 24 * 7)) continue;
    const text = `${s.title}\n${(s as any).hook || ''}\n${(s as any).angle || ''}`.trim();
    if (!text) continue;
    try {
      const { novelty, saturation, nearest } = await noveltyScore(text);
      let score = s.score;
      if (saturation > 2) score = Math.max(20, score - 15);
      else if (novelty > 0.7) score = Math.min(100, score + 5);
      const newPayload = { ...existing, novelty, saturation, nearest_title: nearest?.title || null, enriched_at: new Date().toISOString() };
      // V8.9 — enrichir le 'why' avec faits concrets (pilier silence, topic frais, etc.)
      let newWhy = s.why;
      try {
        const factual = await whyNowFor({ title: s.title, pilier: s.pilier, payload: newPayload });
        if (factual) newWhy = factual + ' · ' + (s.why || '');
      } catch { /* silent */ }
      const { error } = await supabase.from('suggestions').update({ score, payload: newPayload, why: newWhy }).eq('id', s.id);
      if (!error) touched++;
    } catch { /* continue */ }
  }
  return touched;
}

// === Helpers ===
function inferFormat(pilier?: string): string {
  if (!pilier) return 'text';
  if (/Cas client|Cas dirigeant/i.test(pilier)) return 'cas';
  if (/Pédagogie/i.test(pilier)) return 'pedagogie';
  if (/Produit|démo|nouveauté/i.test(pilier)) return 'demo';
  if (/Opinion/i.test(pilier)) return 'opinion';
  if (/Build in public/i.test(pilier)) return 'build';
  return 'text';
}
function visualIdeaFor(pilier?: string): string | null {
  if (!pilier) return null;
  if (/Cas client/i.test(pilier)) return 'Avant/après en chiffres, palette Heelio bleu';
  if (/Pédagogie/i.test(pilier)) return 'Schéma 3 étapes simple, flèches, design system Heelio';
  if (/Produit/i.test(pilier)) return 'Capture stylisée + 3 annotations numérotées';
  if (/Opinion/i.test(pilier)) return null; // opinion pure = pas de visuel
  if (/Build in public/i.test(pilier)) return 'Sparkline + chiffres clés du mois';
  return null;
}
function shortHook(title: string): string {
  return title.length > 80 ? title.slice(0, 77) + '…' : title;
}
function truncate(s: string, n: number): string { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function extractTheme(content: string): string {
  // Naive theme extraction: first noun-ish capitalized word > 4 chars
  const words = content.split(/\s+/).filter(w => w.length >= 5 && /^[A-ZÀ-Ÿa-zà-ÿ]/.test(w));
  if (!words.length) return '';
  // Try to find first uppercase-starting French noun
  const cap = words.find(w => /^[A-ZÀ-Ÿ]/.test(w));
  return (cap || words[0]).replace(/[,.!?;:]$/, '').slice(0, 30);
}


// V8.3 — generate a distinct hook from a title.
// Returns an evocative single sentence that complements the title (not duplicates it).
function pickHookFromTitle(title: string, pilier?: string): string {
  const t = (title || '').trim();
  if (!t) return '';
  const isOpinion = pilier && /Opinion/i.test(pilier);
  const isCas = pilier && /Cas client|dirigeant/i.test(pilier);
  const isProduit = pilier && /Produit|démo/i.test(pilier);
  const isBuild = pilier && /Build in public/i.test(pilier);
  const isPedago = pilier && /Pédagogie/i.test(pilier);
  // Variant hooks by pilier
  const variants = isOpinion ? [
    "Ce que je vois chez la plupart des PME que j'accompagne.",
    "Le débat que personne ne veut avoir.",
    "L'erreur que je vois revenir mois après mois.",
    "Mon avis a évolué — voici pourquoi."
  ] : isCas ? [
    "Un cas concret qui a changé ma vision.",
    "L'histoire d'un dirigeant qui a failli y passer.",
    "Ce qu'on découvre quand on regarde vraiment les chiffres.",
    "Une PME qui pensait aller bien."
  ] : isProduit ? [
    "On vient de sortir quelque chose qui change tout.",
    "Voici ce que vous attendiez (peut-être sans le savoir).",
    "La feature qu'on a mis 3 mois à valider.",
    "Démo : 60 secondes pour comprendre."
  ] : isBuild ? [
    "Voici ce qui s'est passé cette semaine.",
    "Transparence : on partage les chiffres.",
    "On a hésité 2 semaines. Voici la décision.",
    "Le côté caché de la construction d'un SaaS."
  ] : isPedago ? [
    "On me pose cette question 3 fois par semaine.",
    "Sujet technique, mais on va le simplifier.",
    "Une notion essentielle qu'on confond souvent.",
    "Voici la définition en 60 secondes."
  ] : [
    "Ce sujet mérite qu'on s'y arrête une minute.",
    "Un angle que je n'avais pas vu jusqu'ici.",
    "Voici ce que j'ai appris en pratique.",
    "Quelques observations qui m'ont marqué."
  ];
  return variants[Math.floor(Math.random() * variants.length)];
}
