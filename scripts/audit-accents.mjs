#!/usr/bin/env node
// V17.1 — Audit accents : scan le repo pour les mots français sans accents
// dans les strings UI ou prompts. Ignore les slugs / IDs / variables
// (internal_keys snake_case ou kebab-case en valeur de mapping).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '_github-workflows-to-install', '.tmp']);
const EXTS = new Set(['.ts', '.tsx', '.mjs']);

// Mots français très communs qui ne devraient JAMAIS apparaître sans accent
// dans un texte utilisateur. Format : mot sans accent (lowercase).
// On ignore les usages comme slug / key / code interne.
const BAD_WORDS = [
  'tresorerie', 'tresoreries',
  'generer', 'generation', 'generee',
  'ameliorer', 'amelioration', 'ameliore',
  'pedagogie', 'pedagogique',
  'ecriture', 'ecrire', 'ecrivez',
  'controle', 'controler',
  'prevu', 'prevoir', 'prevoit',
  'verifie', 'verifier',
  'telecharger', 'telechargement',
  'arrete', 'arreter',
  'eleve', 'elever',
  'revele', 'reveler',
  'presente', 'presenter',
  'definie', 'definir',
  'synthese',
  'realise', 'realiser',
  'periode', 'periodique',
  'enregistre', 'enregistrer',
  'sauvegarde', 'sauvegarder',
  'redige', 'rediger', 'redaction',
  'editoriale', 'editorial', 'editoriale',
  'memoire', 'memoires',
  'derniere', 'dernier',
  'prochaine', 'prochain',
  'recente', 'recent',
  'voila', 'apres',
  'modele', 'modeles',
  'cle', 'cles',
];

const files = [];
function walk(d) {
  for (const n of readdirSync(d)) {
    if (SKIP_DIRS.has(n)) continue;
    const f = join(d, n);
    const s = statSync(f);
    if (s.isDirectory()) walk(f);
    else if (EXTS.has(extname(n))) files.push(f);
  }
}
walk('.');

let total = 0;
const hits = [];

for (const f of files) {
  // Skip the audit script itself and the bad-posts fixture
  if (f.includes('audit-accents.mjs') || f.includes('check-french-accents.mjs') || f.includes('test-narrative.mjs')) continue;
  const txt = readFileSync(f, 'utf8');
  const lines = txt.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip lines that are pure imports
    if (/^\s*(import|export|const|let|var|function|interface|type|enum|class)\s/.test(line.trim())
        && !/['"`]/.test(line)) continue;
    for (const w of BAD_WORDS) {
      const re = new RegExp('\\b' + w + '\\b', 'i');
      const m = line.match(re);
      if (!m) continue;
      // Ignore if it's a snake_case/kebab key on the LEFT of a colon (mapping)
      // e.g.  pedagogie: { label: 'Pédagogie' }  OR  'pedagogie' in URL
      // We accept if the word is *visually a key*: just before a `:` or `,` or `}`
      // OR if it's in a URL slug context (preceded by /, =, or "-")
      const idx = line.toLowerCase().indexOf(w);
      const before = line.slice(Math.max(0, idx - 8), idx);
      const after = line.slice(idx + w.length, idx + w.length + 8);
      const isKey =
        /^['"]$/.test(line[idx - 1] || '') && /['"]\s*:/.test(after) ||  // 'pedagogie': ...
        /^[\w-]$/.test(line[idx - 1] || '') && false ||                   // part of larger word
        /^\s*:/.test(after) ||                                            // pedagogie:
        /[/=?&]/.test(line[idx - 1] || '');                               // URL slug
      if (isKey) continue;
      // Ignore comments that audit themselves or fixture lists
      if (/audit|fixture|EXPECT|BAD_WORDS|TRACKED_KEYWORDS|sanitize|normalize/i.test(line)) continue;
      hits.push({ file: f, line: i + 1, word: w, content: line.trim().slice(0, 160) });
      total++;
    }
  }
}

if (total === 0) {
  console.log('✓ No French words missing accents found');
  process.exit(0);
}

console.log(`Found ${total} potential accents missing:\n`);
for (const h of hits.slice(0, 100)) {
  console.log(`  ${h.file}:${h.line}  [${h.word}]`);
  console.log(`    ${h.content}`);
}
if (hits.length > 100) console.log(`\n…and ${hits.length - 100} more`);

process.exit(hits.length > 0 ? 1 : 0);
