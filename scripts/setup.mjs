#!/usr/bin/env node
// Cadence — bootstrap local cross-platform (Node)
// Usage : npm run setup

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const log = (msg, color = '') => {
  const c = { green: '\x1b[32m', cyan: '\x1b[36m', yellow: '\x1b[33m', red: '\x1b[31m', reset: '\x1b[0m' };
  console.log((c[color] || '') + msg + c.reset);
};
const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
const has = (cmd) => {
  try { execSync(process.platform === 'win32' ? `where ${cmd}` : `command -v ${cmd}`, { stdio: 'ignore' }); return true; }
  catch { return false; }
};

log('→ Cadence setup local', 'cyan');

log('→ Install dependencies', 'cyan');
run(existsSync('package-lock.json') ? 'npm ci --silent' : 'npm install --silent');

if (!existsSync('.env.local')) {
  log('→ Récupération des env vars depuis Vercel', 'cyan');
  if (!has('vercel')) {
    log('  ⚠  Vercel CLI absent. Installation globale :', 'yellow');
    run('npm install -g vercel');
  }
  log('  → vercel login (suis le lien dans le navigateur)', 'cyan');
  run('vercel login');
  log('  → vercel link (choisis le projet cadence-api dans cyrilc-gits-projects)', 'cyan');
  run('vercel link');
  log('  → vercel env pull .env.local', 'cyan');
  run('vercel env pull .env.local');
  log('  ✓ .env.local créé depuis Vercel', 'green');
} else {
  log('  ✓ .env.local existe déjà', 'green');
}

log('→ Typecheck', 'cyan');
run('npx tsc --noEmit');

log('→ Vérif fichiers critiques', 'cyan');
const critical = ['CLAUDE.md', 'app/page.tsx', 'app/posts/new/client.tsx', 'components/CadenceEditor.tsx', 'lib/weekly-intelligent.ts'];
for (const f of critical) log(existsSync(f) ? `  ✓ ${f}` : `  ✗ ${f} MANQUANT`, existsSync(f) ? 'green' : 'red');

log('\n✓ Setup terminé.\n', 'green');
log('Prochaines étapes :', 'cyan');
console.log('  1. npm run dev → http://localhost:3000');
console.log('  2. Si LinkedIn OAuth doit marcher en local, change LINKEDIN_REDIRECT_URI dans .env.local');
console.log('     en http://localhost:3000/api/auth/callback ET ajoute cette URL dans la console LinkedIn Developer');
console.log('  3. Lis CLAUDE.md pour les conventions du projet');
