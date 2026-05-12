import { suggestionUpsert, Suggestion } from './db';
import { listNotionPosts } from './notion';

// === Notion radar ===
// Look at recently updated Notion posts that are still drafts → propose to expand
export async function radarFromNotion(): Promise<number> {
  let count = 0;
  try {
    const posts = await listNotionPosts(50);
    for (const p of posts) {
      if (p.status === 'published') continue;
      if (!p.title || p.title === 'Sans titre') continue;
      const score = 60 + (p.pilier ? 10 : 0) + (p.scheduled_at ? 10 : 0);
      await suggestionUpsert({
        source: 'notion',
        source_ref: p.id,
        title: p.title,
        hook: p.title,
        pilier: p.pilier,
        score,
        why: p.scheduled_at
          ? `Programmé le ${new Date(p.scheduled_at).toLocaleDateString('fr-FR')} — à rédiger / valider`
          : 'Draft Notion sans date — angle prêt à exploiter',
        payload: { notion_url: p.notion_url, scheduled_at: p.scheduled_at }
      });
      count++;
    }
  } catch (e) {
    // swallow
  }
  return count;
}

// === GitHub radar ===
// Read recent commits / PRs / releases from configured repos (env GITHUB_REPOS comma-separated owner/repo)
export async function radarFromGitHub(): Promise<number> {
  const token = process.env.GITHUB_TOKEN;
  const repos = (process.env.GITHUB_REPOS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!token || !repos.length) return 0;
  let count = 0;
  for (const repo of repos) {
    try {
      // Last 5 commits
      const r = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=5`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
      });
      if (!r.ok) continue;
      const commits: any[] = await r.json();
      for (const c of commits) {
        const msg = (c.commit?.message || '').split('\n')[0];
        if (!msg) continue;
        // Skip chore / merge
        if (/^(chore|merge|docs|test)/i.test(msg)) continue;
        const score = /^(feat|feature)/i.test(msg) ? 80 : /^fix/i.test(msg) ? 65 : 50;
        await suggestionUpsert({
          source: 'github',
          source_ref: `${repo}@${c.sha}`,
          title: msg.slice(0, 120),
          pilier: 'Mercredi · Produit',
          score,
          why: `Commit récent dans ${repo} — angle "nouveauté produit"`,
          payload: { repo, sha: c.sha, url: c.html_url, author: c.commit?.author?.name }
        });
        count++;
      }
      // Last release
      const rel = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
      });
      if (rel.ok) {
        const r2 = await rel.json();
        await suggestionUpsert({
          source: 'github',
          source_ref: `${repo}-release-${r2.id}`,
          title: `${r2.name || r2.tag_name} — annonce release`,
          pilier: 'Mercredi · Produit',
          score: 90,
          why: `Release "${r2.tag_name}" publiée le ${new Date(r2.published_at).toLocaleDateString('fr-FR')}`,
          payload: { repo, url: r2.html_url, tag: r2.tag_name, body: (r2.body || '').slice(0, 500) }
        });
        count++;
      }
    } catch {}
  }
  return count;
}

// === Heuristic radar ===
// Generic angles to seed when sources are empty
export async function radarHeuristics(): Promise<number> {
  const SEEDS: Array<Partial<Suggestion>> = [
    { source: 'heuristic', source_ref: 'dso-explainer',     title: 'Le DSO en 60 secondes', hook: 'Votre DSO grimpe ? Votre trésorerie fond.', pilier: 'Mardi · Pédagogie', score: 70, why: 'Sujet de prédilection des DAF — pédagogie simple, exemple chiffré' },
    { source: 'heuristic', source_ref: 'erreur-1-treso',    title: 'L\'erreur n°1 des dirigeants sur la trésorerie', hook: 'Ce que je vois chez 8 PME sur 10.', pilier: 'Jeudi · Opinion', score: 75, why: 'Hot take, fort engagement' },
    { source: 'heuristic', source_ref: 'cas-client-anon',   title: 'Cas client : -50% DSO en 3 mois', hook: 'Une PME services qui a divisé son DSO par 2.', pilier: 'Lundi · Cas client', score: 80, why: 'Format storytelling anonymisé, à valider Anonymisation OK' },
    { source: 'heuristic', source_ref: 'build-public-mois', title: 'Build in public : MRR du mois', hook: 'Voici les chiffres bruts du mois.', pilier: 'Vendredi · Build in public', score: 72, why: 'Rituel hebdo "transparence", génère du commit' },
    { source: 'heuristic', source_ref: 'feature-week',      title: 'La feature de la semaine en démo', hook: 'Cette semaine on a sorti X. Voici à quoi ça sert.', pilier: 'Mercredi · Produit', score: 78, why: 'Démo produit, visuel Claude Design idéal' }
  ];
  let count = 0;
  for (const s of SEEDS) {
    await suggestionUpsert(s as any);
    count++;
  }
  return count;
}

export async function runAllRadars() {
  const [n, g, h] = await Promise.all([radarFromNotion(), radarFromGitHub(), radarHeuristics()]);
  return { notion: n, github: g, heuristic: h, total: n + g + h };
}
