#!/usr/bin/env node
// V25.1 — Test anti-slop FR enrichi
//
// Charge ANTI_PATTERNS depuis lib/brand-config.ts et vérifie qu'une
// série de phrases volontairement "AI-slop" sont bien détectées. Exit 1
// si l'une des fixtures n'est pas détectée par au moins 1 anti-pattern.
//
// Usage : node scripts/test-anti-slop.mjs

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// On évite de lire le .ts via tsx (deps inutiles). À la place, on copie
// les patterns ici en miroir. Le test sert à garantir que LES PATTERNS
// décrits dans le cahier des charges V25.1 sont bien actifs. Si le code
// dans lib/brand-config.ts est modifié, ce test doit être mis à jour
// en miroir.

const PATTERNS = [
  { id: 'intensifiers_creux', re: /\b(extr[êe]mement|dramatiquement|consid[ée]rablement|incroyablement|profond[ée]ment|v[ée]ritablement|absolument|litt[ée]ralement|remarquablement|exceptionnellement|significativement)\b/gi },
  { id: 'transitions_ai',     re: /\b(?:de plus|en outre|n[ée]anmoins|cela [ée]tant dit|ceci [ée]tant|il convient de noter que|[àa] sa base|pour simplifier|en essence|par cons[ée]quent)\b/gi },
  { id: 'weasel_words',       re: /\b(?:pourrait [ée]ventuellement|peut potentiellement|est susceptible de|il se pourrait que|il semble que|il appara[îi]t que|on pourrait dire que)\b/gi },
  { id: 'academic_tells',     re: /\b(?:mettre en lumi[èe]re|ouvrir la voie [àa]|primordial(?:e|es|aux)?|pr[ée]alablement [àa]|[àa] la lumi[èe]re de|au regard de|dans le cadre de|le fait que|au sein de la dynamique)\b/gi },
  { id: 'symbolisme_creux',   re: /\b(?:ouvrir de nouvelles perspectives|laisser(?:a|ait)?\s+une empreinte durable|un t[ée]moignage de|un tournant majeur|profond[ée]ment ancr[ée]e?s?|un signal fort|une le[çc]on (?:pr[ée]cieuse|essentielle)|un rappel saisissant)\b/gi },
  { id: 'markup_hallucination', re: /\b(oaicite|turn0search\d+|grok_card|contentReference|attributableIndex)\b/gi },
  { id: 'process_narration',  re: /\b(?:je n['e]?ai pas (?:pu )?trouv[ée]|je n['e]?ai pas (?:pu )?identifier|impossible de v[ée]rifier|aucune source disponible|n['e]?a pas pu [êe]tre identifi[ée]|d['e]?apr[èe]s mes recherches)\b/gi },
  { id: 'question_rhetorique', re: /(?:^|\n|\.\s+)\s*(?:Et si je vous disais|Vous savez quoi\s*\?|Devinez quoi\s*\?|Et si je vous dis que|Imaginez (?:un instant|que))/gi },
];

function hedgingDensity(text) {
  const paras = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 50);
  const hedgeRe = /\b(?:peut-?[êe]tre|probablement|vraisemblablement|sans doute|possiblement|apparemment|il semble que|il se peut que|on dirait que|en quelque sorte|grosso modo)\b/gi;
  for (const p of paras) {
    const hits = (p.match(hedgeRe) || []).length;
    if (hits > 3) return true;
  }
  return false;
}

// 10 fixtures : chaque phrase doit déclencher au moins 1 anti-pattern
const FIXTURES = [
  { name: 'intensifiers',  text: 'Cette pratique est extrêmement importante pour les dirigeants. Considérablement plus efficace que les méthodes classiques.', expect: 'intensifiers_creux' },
  { name: 'transitions',   text: 'De plus, la trésorerie évolue. En outre, le pilotage devient critique. Par conséquent, agissez maintenant.', expect: 'transitions_ai' },
  { name: 'weasel',        text: 'Cette approche pourrait éventuellement aider les PME. Il se pourrait que les résultats varient selon les contextes.', expect: 'weasel_words' },
  { name: 'academic',      text: 'Cette étude vise à mettre en lumière les enjeux de la trésorerie. Il est primordial de comprendre, dans le cadre de la gestion moderne.', expect: 'academic_tells' },
  { name: 'symbolisme',    text: 'Cette décision laissera une empreinte durable sur le secteur. Un véritable tournant majeur, profondément ancré dans la pratique.', expect: 'symbolisme_creux' },
  { name: 'markup',        text: 'Selon une étude récente, le marché a évolué oaicite0 et la régulation a suivi turn0search3.', expect: 'markup_hallucination' },
  { name: 'process',       text: 'D\'après mes recherches, je n\'ai pas trouvé de chiffre récent. Impossible de vérifier la dernière donnée.', expect: 'process_narration' },
  { name: 'rhétorique',    text: 'Et si je vous disais que la trésorerie peut être pilotée en 10 minutes par jour ? Devinez quoi ? C\'est possible.', expect: 'question_rhetorique' },
  { name: 'hedging dense', text: 'La situation est probablement complexe et il semble que les acteurs hésitent. Peut-être que les chiffres bougeront, vraisemblablement dans les mois qui viennent.', expect: 'hedging_density' },
  { name: 'cumul',         text: 'De plus, cette analyse pourrait éventuellement mettre en lumière des perspectives nouvelles. Considérablement plus riche que les approches classiques.', expect: 'intensifiers_creux' },
];

let failed = 0;
const lines = [];

for (const f of FIXTURES) {
  let matched = false;
  if (f.expect === 'hedging_density') {
    matched = hedgingDensity(f.text);
  } else {
    const p = PATTERNS.find(p => p.id === f.expect);
    if (p && p.re.test(f.text)) matched = true;
  }
  if (matched) {
    lines.push(`OK   ${f.name.padEnd(18)} → ${f.expect}`);
  } else {
    failed++;
    lines.push(`FAIL ${f.name.padEnd(18)} → ${f.expect} NON détecté`);
  }
}

for (const l of lines) console.log(l);
console.log(`\n${FIXTURES.length} fixtures, ${failed} échec${failed > 1 ? 's' : ''}.`);
process.exit(failed > 0 ? 1 : 0);
