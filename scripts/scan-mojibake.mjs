#!/usr/bin/env node
// Scan all .ts .tsx .md .json for UTF-8 corruption (mojibake).
// Exits 1 if any pattern is found.

import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const EXTS = new Set(['.ts', '.tsx', '.md', '.json']);
const SKIP = new Set(['node_modules', '.next', '.git', '_github-workflows-to-install']);
// Common double-encoded UTF-8 mojibake patterns
const PATTERNS = [
  /Ã[©¨ ©®´œüœ§ª]/,
  /â€[™œ"]/,
  /Â /
];

let found = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else if (EXTS.has(extname(name))) {
      const content = readFileSync(full, 'utf8');
      for (const p of PATTERNS) {
        if (p.test(content)) {
          const lines = content.split('\n');
          lines.forEach((line, i) => { if (p.test(line)) found.push(`${full}:${i+1} → ${line.trim().slice(0, 100)}`); });
          break;
        }
      }
    }
  }
}

walk('.');

if (found.length) {
  console.error(`❌ Mojibake detected (${found.length} occurrences):`);
  for (const f of found.slice(0, 50)) console.error('  ' + f);
  if (found.length > 50) console.error(`  ... and ${found.length - 50} more`);
  process.exit(1);
}
console.log('✓ No mojibake found');
