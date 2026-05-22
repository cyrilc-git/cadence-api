#!/usr/bin/env node
// V11.5 — QA full local : typecheck + mojibake + voice scan + smoke prod.
// Usage : node scripts/qa-full.mjs
// Exit 0 si tout OK, code > 0 sinon.

import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

function run(cmd, args, label) {
  return new Promise(resolve => {
    const ps = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
    let out = '', err = '';
    ps.stdout.on('data', d => { out += d; });
    ps.stderr.on('data', d => { err += d; });
    ps.on('close', code => resolve({ label, code, out, err }));
  });
}

function walk(dir, exts = ['.tsx', '.ts']) {
  const acc = [];
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e === '.git') continue;
    const full = path.join(dir, e);
    const st = statSync(full);
    if (st.isDirectory()) acc.push(...walk(full, exts));
    else if (exts.some(x => full.endsWith(x))) acc.push(full);
  }
  return acc;
}

// Voice scan : détecte em-dash / en-dash dans des strings, JSX text, JSX attribute.
// Ignore : commentaires // et /* */. Approximation simple : par ligne, supprime
// la partie après //, supprime les blocs /* ... */ inline, puis cherche — ou –.
function scanVoice(file) {
  const txt = readFileSync(file, 'utf8');
  const lines = txt.split(/\r?\n/);
  const issues = [];
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i];
    // Drop // comment tail
    l = l.replace(/\/\/.*$/, '');
    // Drop /* ... */ inline
    l = l.replace(/\/\*[\s\S]*?\*\//g, '');
    if (/[—–]/.test(l)) issues.push({ line: i + 1, content: lines[i].trim().slice(0, 100) });
  }
  return issues;
}

async function main() {
  const root = process.cwd();
  console.log('QA full pour', root);
  let failed = 0;

  // 1. tsc
  const tsc = await run('npx', ['tsc', '--noEmit'], 'tsc');
  if (tsc.code === 0) console.log('OK    typecheck');
  else { console.log('FAIL  typecheck\n' + tsc.out.slice(-1200)); failed++; }

  // 2. mojibake
  const moj = await run('node', ['scripts/scan-mojibake.mjs'], 'mojibake');
  if (moj.code === 0) console.log('OK    mojibake');
  else { console.log('FAIL  mojibake\n' + moj.out); failed++; }

  // 3. voice scan : em-dash dans .tsx
  const files = walk(path.join(root, 'app')).concat(walk(path.join(root, 'components')));
  let voiceIssues = 0;
  const samples = [];
  for (const f of files) {
    const list = scanVoice(f);
    if (list.length) {
      voiceIssues += list.length;
      for (const x of list.slice(0, 1)) samples.push(`${path.relative(root, f)}:${x.line} : ${x.content}`);
    }
  }
  if (voiceIssues === 0) console.log('OK    voice (aucun em/en-dash visible)');
  else {
    console.log(`WARN  voice : ${voiceIssues} occurrence${voiceIssues > 1 ? 's' : ''} d'em/en-dash`);
    for (const s of samples.slice(0, 10)) console.log('      ' + s);
  }

  // 4. smoke prod
  const sm = await run('node', ['scripts/smoke-content.mjs'], 'smoke');
  if (sm.code === 0) console.log('OK    smoke prod');
  else { console.log('FAIL  smoke prod\n' + sm.out); failed++; }

  console.log(failed === 0 ? '\nAll clear.' : `\n${failed} étape(s) en échec.`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
