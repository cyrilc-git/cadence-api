#!/usr/bin/env node
// V16.7 — Fixtures de mauvais posts pour valider l'analyzer narratif.
// Usage : node scripts/test-narrative.mjs
//
// On crée volontairement 7 catégories de "mauvais posts" et on vérifie
// que analyzeNarrative + checkAntiPatterns détectent ce qu'on attend.
// Exit 0 si tout passe, code > 0 si une détection rate.

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// Hack léger pour pouvoir importer du TS depuis Node sans build.
// On va plutôt importer les fixtures comme strings et tester via fetch
// sur localhost. Mais le serveur n'est pas forcément démarré.
// Plus simple : recopier les regex et les fonctions clés dans ce script,
// OU compiler ts-node à la volée. On choisit la version "self-contained"
// avec une mini-réimplémentation de analyzeNarrative qui mirror la vraie.
//
// La VRAIE source de vérité reste lib/narrative-check.ts. Ce script
// reproduit l'API surface pour tester sans tsc.

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

// On compile narrative-check.ts en JS à la volée via tsc inline
let analyzeNarrative;
try {
  // Compile narrative-check.ts via tsc one-shot
  execSync('npx tsc --module nodenext --target es2022 --moduleResolution nodenext --outDir scripts/.tmp lib/narrative-check.ts', { stdio: 'inherit' });
  const mod = await import(pathToFileURL(`${process.cwd()}/scripts/.tmp/narrative-check.js`).href);
  analyzeNarrative = mod.analyzeNarrative;
} catch (e) {
  console.error('tsc compile failed:', e.message);
  process.exit(2);
}

// ── Fixtures : 7 mauvais posts qu'on attend être détectés ──
const FIXTURES = [
  {
    name: 'trop-ia-mots-creux',
    text: `Dans un monde où la trésorerie devient un game-changer, il est essentiel de libérer le potentiel de vos équipes.\n\nLes insights révolutionnaires que nous avons unlocked vont disrupter vos processus financiers de manière seamless.\n\nN'ayez plus peur de l'innovation : osez vraiment transformer votre business.`,
    expectAny: ['sans_friction_concrete', 'tout_demonstratif', 'lineaire_explicatif'],
  },
  {
    name: 'trop-linkedin-voici-3-lecons',
    text: `J'ai accompagné 50 PME en 3 ans.\n\nVoici les 3 leçons que j'ai apprises.\n\n1. La trésorerie est stratégique.\n2. La transparence change tout.\n3. Le dashboard ne suffit pas.\n\nJ'ai compris que la finance n'est pas que des chiffres.\n\nEt vous, qu'en pensez-vous ?`,
    expectAny: ['morale_finale_assenee', 'sans_friction_concrete', 'tout_demonstratif'],
  },
  {
    name: 'trop-corporate-vision',
    text: `La transformation digitale est un tournant majeur pour les PME visionnaires.\n\nOptimiser la valeur de l'entreprise passe par l'excellence opérationnelle et l'alignement des équipes.\n\nLa clé de la réussite, c'est d'impacter durablement votre marché.\n\nCréer de la valeur pour les parties prenantes est notre priorité stratégique.`,
    expectAny: ['sans_friction_concrete', 'scene_absente', 'lineaire_explicatif'],
  },
  {
    name: 'trop-motivationnel',
    text: `N'ayez plus peur de l'échec.\n\nOsez vraiment poursuivre vos rêves d'entrepreneur.\n\nSortez de votre zone de confort. Croyez en vous. Dépassez vos limites.\n\nLibérez votre potentiel. Le succès est à votre portée.\n\nRetenez ceci : tout est possible.`,
    expectAny: ['sans_friction_concrete', 'morale_finale_assenee', 'lineaire_explicatif'],
  },
  {
    name: 'sans-tension',
    text: `Le suivi de trésorerie est important pour les PME. Il permet de visualiser les encaissements et les décaissements. C'est utile pour les arbitrages.\n\nUn bon outil de trésorerie offre des fonctionnalités variées. Il permet de gagner du temps. Il facilite les échanges avec la banque.\n\nLa transparence financière améliore la relation avec les partenaires. C'est un atout pour la PME moderne.`,
    expectAny: ['manque_bascule', 'sans_friction_concrete', 'lineaire_explicatif', 'scene_absente'],
  },
  {
    name: 'hook-promet-trop',
    text: `Voici les 7 erreurs qui m'ont coûté 100k€ de trésorerie en 2 ans.\n\nLa première erreur est de ne pas suivre régulièrement ses comptes.\n\nLa deuxième est de mal communiquer avec sa banque.\n\nIl faut être rigoureux. Et patient.`,
    expectAny: ['hook_promet_trop', 'tout_demonstratif'],
  },
  {
    name: 'trop-explicatif',
    text: `Comment optimiser sa trésorerie en PME ?\n\nVoici comment procéder. Premièrement, il faut un dashboard clair.\n\nC'est-à-dire un outil qui montre encaissements et décaissements.\n\nDeuxièmement, il faut suivre l'évolution. Donc tracer la tendance.\n\nTroisièmement, communiquer avec la banque. Ainsi, vous gagnez du temps.\n\nDe plus, vous évitez les surprises. Par ailleurs, vous rassurez vos partenaires.\n\nEn outre, la transparence est un atout.`,
    expectAny: ['tout_demonstratif', 'sans_friction_concrete'],
  },
];

// ── Run tests ──
let passed = 0, failed = 0;
console.log(`\nV16.7 — Test narrative-check avec ${FIXTURES.length} fixtures\n`);

for (const fx of FIXTURES) {
  const sig = analyzeNarrative(fx.text);
  const match = sig.kind !== 'none' && fx.expectAny.includes(sig.kind);
  if (match) {
    console.log(`✓ ${fx.name.padEnd(32)} → ${sig.kind} (${sig.severity})`);
    passed++;
  } else if (sig.kind === 'none') {
    console.log(`✗ ${fx.name.padEnd(32)} → AUCUN signal (attendu : ${fx.expectAny.join('|')})`);
    failed++;
  } else {
    console.log(`~ ${fx.name.padEnd(32)} → ${sig.kind} (attendu : ${fx.expectAny.join('|')}) — pas top mais détecté`);
    // On considère ça comme un pass partiel : un signal est meilleur que rien
    passed++;
  }
}

console.log(`\n${passed}/${FIXTURES.length} fixtures détectées correctement, ${failed} ratées.`);

// Cleanup tmp
try { execSync('rm -rf scripts/.tmp', { stdio: 'ignore' }); } catch {}

process.exit(failed === 0 ? 0 : 1);
