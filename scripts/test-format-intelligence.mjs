#!/usr/bin/env node
// V49 — Test de l'intelligence de format. Compile lib/format-intelligence.ts
// à la volée et vérifie que chaque fixture détecte le bon format.

import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

let detectEditorialFormat;
try {
  execSync('npx tsc --module nodenext --target es2022 --moduleResolution nodenext --outDir scripts/.tmp lib/format-intelligence.ts', { stdio: 'inherit' });
  const mod = await import(pathToFileURL(`${process.cwd()}/scripts/.tmp/format-intelligence.js`).href);
  detectEditorialFormat = mod.detectEditorialFormat;
} catch (e) {
  console.error('tsc compile failed:', e.message);
  process.exit(2);
}

const FIXTURES = [
  {
    name: 'N indispensables (Fygr)',
    text: `Les 6 outils indispensables pour un DAF en 2026.\n\n1. Un logiciel de trésorerie en temps réel.\n2. Un outil de reporting automatisé.\n3. Une solution de relance client.\n4. Un connecteur bancaire fiable.\n5. Un tableau de bord de pilotage.\n6. Un outil de prévision de cash.`,
    expect: 'numbered_list',
  },
  {
    name: 'checklist',
    text: `Avant de clôturer votre mois, vérifiez ceci.\n\n- Toutes les factures sont rapprochées.\n- Les provisions sont passées.\n- Les FAE et FNP sont à jour.\n- Le compte banque est réconcilié.\n- Le reporting est prêt.`,
    expect: 'checklist',
  },
  {
    name: 'avant / après',
    text: `Avant Heelio, ce dirigeant pilotait sa trésorerie sur un tableur envoyé une fois par mois. Il découvrait les trous trois semaines trop tard.\n\nAprès, il voit son cash en temps réel chaque matin. Il a anticipé deux tensions et négocié à froid avec sa banque.`,
    expect: 'before_after',
  },
  {
    name: 'comparaison',
    text: `Faut-il choisir un expert-comptable ou un DAF externalisé pour piloter sa trésorerie ? Beaucoup de dirigeants hésitent. L'expert-comptable regarde le passé, le DAF externalisé pilote l'avenir. Plutôt que de les opposer, voyons ce que chacun apporte concrètement à une PME en croissance.`,
    expect: 'comparison',
  },
  {
    name: 'timeline',
    text: `En 2021, on facturait à 60 jours sans suivi. En 2022, on a mis en place des relances. En 2023, le DSO est tombé à 38 jours. En 2024, on a automatisé tout le cycle.`,
    expect: 'timeline',
  },
  {
    name: 'framework',
    text: `Ma méthode pour piloter la trésorerie d'une PME en 3 temps.\n\nÉtape 1 : visualiser le cash réel.\nÉtape 2 : anticiper les tensions à 13 semaines.\nÉtape 3 : arbitrer chaque vendredi.`,
    expect: 'framework',
  },
];

let failed = 0;
console.log('\nV49 — Test format-intelligence\n');
for (const f of FIXTURES) {
  const r = detectEditorialFormat(f.text);
  const got = r?.format || 'none';
  if (got === f.expect) {
    console.log(`OK   ${f.name.padEnd(26)} → ${got} (${r.confidence})`);
  } else {
    failed++;
    console.log(`FAIL ${f.name.padEnd(26)} → ${got} (attendu ${f.expect})`);
  }
}
console.log(`\n${FIXTURES.length} fixtures, ${failed} échec${failed > 1 ? 's' : ''}.`);
try { execSync('rm -rf scripts/.tmp', { stdio: 'ignore' }); } catch {}
process.exit(failed > 0 ? 1 : 0);
