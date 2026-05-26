#!/usr/bin/env node
// V17.4 — Test de non-régression : scanne le repo pour les mots français
// qui ABSOLUMENT REQUIS un accent dans leur forme normale. Échoue si on
// trouve un usage user-facing sans accent.
//
// Ignore strictement les contextes "internal slug" :
// - Clé d'objet à gauche d'un ':' (pedagogie: 'Pédagogie')
// - Argument de chaîne dans une URL/href (?source=pedagogie)
// - Nom de classe CSS (font-editorial, cadence-editorial)
// - Comparaison .toLowerCase()/.normalize() où l'accent serait normalisé
// - Liste de TRACKED_KEYWORDS qui dédoublonne avec/sans accent
// - Commentaires de code (// commentaire)
// - Type/enum literal ('pedagogie' | 'cas' | ...)
//
// Usage : node scripts/check-french-accents.mjs
// Exit 0 si tout OK, 1 si une régression est trouvée.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '_github-workflows-to-install', '.tmp']);
const SKIP_FILES = new Set([
  'scripts/check-french-accents.mjs',
  'scripts/audit-accents.mjs',
  'scripts/test-narrative.mjs',
  'scripts/scan-mojibake.mjs',
]);
const EXTS = new Set(['.ts', '.tsx', '.mjs']);

// Mots français qui DOIVENT avoir un accent. Format : { bad, good, hint }
// On match \b<bad>\b (case-insensitive) UNIQUEMENT dans les strings
// utilisateur (entre ' " `).
const REQUIRED_ACCENTS = [
  { bad: 'tresorerie',  good: 'trésorerie',  hint: 'mot métier' },
  { bad: 'tresoreries', good: 'trésoreries', hint: 'mot métier' },
  { bad: 'generer',     good: 'générer',     hint: 'verbe' },
  { bad: 'generes',     good: 'générés',     hint: 'participe' },
  { bad: 'ameliorer',   good: 'améliorer',   hint: 'verbe' },
  { bad: 'ameliore',    good: 'amélioré',    hint: 'participe' },
  { bad: 'pedagogie',   good: 'pédagogie',   hint: 'nom commun' },
  { bad: 'pedagogique', good: 'pédagogique', hint: 'adjectif' },
  { bad: 'ecriture',    good: 'écriture',    hint: 'nom commun' },
  { bad: 'ecrire',      good: 'écrire',      hint: 'verbe' },
  { bad: 'ecrit',       good: 'écrit',       hint: 'participe' },
  { bad: 'ecrivez',     good: 'écrivez',     hint: 'verbe' },
  { bad: 'previsionnel',good: 'prévisionnel',hint: 'adjectif' },
  { bad: 'memoire',     good: 'mémoire',     hint: 'nom commun' },
  { bad: 'theme',       good: 'thème',       hint: 'nom commun' },
  { bad: 'apres',       good: 'après',       hint: 'préposition' },
  { bad: 'modele',      good: 'modèle',      hint: 'nom commun' },
  { bad: 'meme',        good: 'même',        hint: 'pronom' },
  { bad: 'caractere',   good: 'caractère',   hint: 'nom commun' },
  { bad: 'caracteres',  good: 'caractères',  hint: 'nom commun' },
  { bad: 'systeme',     good: 'système',     hint: 'nom commun' },
  { bad: 'editoriale',  good: 'éditoriale',  hint: 'adjectif' },
  { bad: 'editorialement', good: 'éditorialement', hint: 'adverbe' },
  { bad: 'controle',    good: 'contrôle',    hint: 'nom commun' },
  { bad: 'controler',   good: 'contrôler',   hint: 'verbe' },
  { bad: 'verifie',     good: 'vérifie',     hint: 'verbe' },
  { bad: 'verifier',    good: 'vérifier',    hint: 'verbe' },
  { bad: 'definie',     good: 'définie',     hint: 'adjectif' },
  { bad: 'definir',     good: 'définir',     hint: 'verbe' },
  { bad: 'reussir',     good: 'réussir',     hint: 'verbe' },
  { bad: 'reussite',    good: 'réussite',    hint: 'nom commun' },
  { bad: 'realise',     good: 'réalisé',     hint: 'participe' },
  { bad: 'realiser',    good: 'réaliser',    hint: 'verbe' },
  { bad: 'reseau',      good: 'réseau',      hint: 'nom commun' },
  { bad: 'periode',     good: 'période',     hint: 'nom commun' },
  { bad: 'present',     good: 'présent',     hint: 'adjectif' },
  { bad: 'precise',     good: 'précis',      hint: 'adjectif' },
  { bad: 'numerique',   good: 'numérique',   hint: 'adjectif' },
  { bad: 'reactivite',  good: 'réactivité',  hint: 'nom commun' },
  { bad: 'experience',  good: 'expérience',  hint: 'nom commun' },
  { bad: 'preciser',    good: 'préciser',    hint: 'verbe' },
];

// Bag de strings à ignorer (variables/slugs internes qu'on accepte sans accent)
const INTERNAL_SLUGS = new Set([
  'pedagogie',     // slug format
  'editorial',     // CSS class : font-editorial, cadence-editorial, editorial-canvas
  'systeme',       // sometimes internal
]);

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

// On scanne : pour chaque ligne, extraire les portions qui sont DANS des
// strings TS/TSX/JS (entre ' ou " ou `), puis chercher les bad words dans
// CES portions. Ça évite les noms de variables (let pedagogie = ...) qui
// sont du code interne.

function extractStringLiterals(line) {
  // Extrait les VRAIS contenus de strings, en ignorant le JS dans `${...}`
  // pour les template literals. Pour ' et ", l'intérieur entier est du texte.
  const out = [];
  let i = 0;
  while (i < line.length) {
    const c = line[i];
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let buf = '';
      while (j < line.length && line[j] !== quote) {
        if (line[j] === '\\' && j + 1 < line.length) { buf += line[j+1]; j += 2; continue; }
        buf += line[j];
        j++;
      }
      out.push({ value: buf, quote, start: i });
      i = j + 1;
    } else if (c === '`') {
      // Template literal : on parse les parties texte et on SKIP les ${...}
      let j = i + 1;
      let buf = '';
      while (j < line.length && line[j] !== '`') {
        if (line[j] === '\\' && j + 1 < line.length) { buf += line[j+1]; j += 2; continue; }
        if (line[j] === '$' && line[j+1] === '{') {
          // Skip jusqu'à la } correspondante (naïf : ne gère pas les imbriqués mais OK pour notre cas)
          let depth = 1;
          j += 2;
          while (j < line.length && depth > 0) {
            if (line[j] === '{') depth++;
            else if (line[j] === '}') depth--;
            if (depth > 0) j++;
          }
          j++; // skip the closing }
          continue;
        }
        buf += line[j];
        j++;
      }
      out.push({ value: buf, quote: '`', start: i });
      i = j + 1;
    } else {
      i++;
    }
  }
  return out;
}

let total = 0;
const hits = [];

for (const f of files) {
  if (SKIP_FILES.has(f.replaceAll('\\', '/'))) continue;
  const rel = f.replaceAll('\\', '/');
  if (SKIP_FILES.has(rel)) continue;
  // Skip lib/brand-config TRACKED_KEYWORDS list and similar dual-lookup arrays
  // qui contiennent volontairement les deux orthographes
  const skipDualForms = /lib\/brain\.ts|app\/api\/.*\/route\.ts/.test(rel);
  const txt = readFileSync(f, 'utf8');
  const lines = txt.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    // Skip pure comment lines
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue;
    // Skip imports/exports
    if (/^\s*(import|export)\s+/.test(line)) continue;
    // Skip type/interface lines (likely enums)
    if (/^\s*(type|interface|enum)\s/.test(trimmed)) continue;
    const literals = extractStringLiterals(line);
    if (literals.length === 0) continue;
    for (const lit of literals) {
      // Skip strings that are clearly code paths/URLs
      if (lit.value.startsWith('/') || lit.value.startsWith('./') || lit.value.startsWith('../')) continue;
      if (lit.value.includes('http://') || lit.value.includes('https://')) continue;
      // Skip strings that contain typical slug context
      if (/^[a-z][a-z0-9_-]*$/.test(lit.value) && INTERNAL_SLUGS.has(lit.value)) continue;
      // Skip simple short slugs (≤ 16 chars, lowercase, hyphens/underscores only)
      if (/^[a-z][a-z0-9_-]{0,16}$/.test(lit.value)) continue;
      // Skip CSS class strings (contains class-like tokens : -, :, multiple spaces, etc.)
      if (/\b(?:bg|text|p|m|flex|grid|w|h|rounded|shadow|hover|focus|sm|md|lg|xl|disabled)-/.test(lit.value) && lit.value.length > 40) continue;
      // Skip if the literal mentions the GOOD form alongside the BAD (teaching examples in prompts)
      // We'll check this per-(bad,good) below.
      for (const { bad, good, hint } of REQUIRED_ACCENTS) {
        const re = new RegExp('\\b' + bad + '\\b', 'i');
        if (!re.test(lit.value)) continue;
        // V17.4 — Skip si la VRAIE forme accentuée est PRÉSENTE dans le même
        // literal. Couvre : (a) TRACKED_KEYWORDS dual-lookup, (b) phrases du
        // prompt système qui DONNENT l'exemple « tresorerie au lieu de
        // trésorerie », (c) tout cas où l'utilisateur voit le bon mot.
        if (lit.value.toLowerCase().includes(good.toLowerCase())) continue;
        // Skip si dans une regex (form match dual)
        if (lit.value.includes(`${bad}|`) || lit.value.includes(`|${bad}`)) continue;
        // Skip if it's a single-word slug literal that maps to an accented label elsewhere
        if (/^[a-z][a-z0-9_-]*$/.test(lit.value) && lit.value.toLowerCase() === bad) continue;
        // Skip if the parent line is a mapping where the slug is a KEY (pedagogie: ...)
        const lineLeft = line.slice(0, lit.start);
        if (/[{,]\s*$/.test(lineLeft.trimEnd()) || /^\s*$/.test(lineLeft)) {
          // It's a value, OK to check
        }
        // Skip occurrences in a regex literal
        if (/\/[gimsuy]*$/.test(line.trim()) && line.includes('/' + bad)) continue;
        hits.push({ file: rel, line: i + 1, bad, good, hint, content: lit.value.slice(0, 100) });
        total++;
      }
    }
  }
}

if (total === 0) {
  console.log('✓ check-french-accents : tous les textes français portent leurs accents');
  process.exit(0);
}

console.log(`✗ ${total} occurrence${total > 1 ? 's' : ''} de mot français sans accent dans des strings utilisateur :\n`);
for (const h of hits) {
  console.log(`  ${h.file}:${h.line}  «${h.bad}» -> «${h.good}»  (${h.hint})`);
  console.log(`    "${h.content}"`);
}

process.exit(1);
