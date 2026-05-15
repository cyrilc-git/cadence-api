#!/usr/bin/env node
/**
 * Cadence QA — Playwright local runner.
 *
 * Usage :
 *   npm i -D playwright    (only first run)
 *   npx playwright install chromium
 *   node scripts/qa.mjs                  # tests prod (cadence-api-ruddy.vercel.app)
 *   BASE_URL=http://localhost:3000 node scripts/qa.mjs
 *
 * Output :
 *   qa-screens/<page>.png     — full-page screenshots
 *   qa-report.json            — structured report (errors, mojibake hits, console)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'https://cadence-api-ruddy.vercel.app';
const OUT_DIR = path.resolve('qa-screens');
fs.mkdirSync(OUT_DIR, { recursive: true });

const PAGES = [
  { name: 'dashboard',         path: '/' },
  { name: 'radar',             path: '/suggestions' },
  { name: 'calendrier',        path: '/calendar' },
  { name: 'bibliotheque',      path: '/posts' },
  { name: 'nouveau-post',      path: '/posts/new' },
  { name: 'ligne-editoriale',  path: '/brand-dna' },
  { name: 'inspirations',      path: '/inspirations' },
  { name: 'sources',           path: '/sources' },
  { name: 'sources-notion',    path: '/sources/notion' },
  { name: 'sources-linkedin',  path: '/sources/linkedin' },
  { name: 'design-visuel',     path: '/design-visuel' },
  { name: 'analytics',         path: '/analytics' },
  { name: 'parametres',        path: '/settings' }
];

// Patterns de mojibake (V7.8 audit)
const MOJIBAKE_RE = /[Ã][\x80-\xff]|[Â][\x80-\xa6\xa8-\xff]|â€[\x80-\xff]?|ð[\x80-\xff]{1,3}|�/;

const REPORT = { base: BASE, started: new Date().toISOString(), pages: [] };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const page = await context.newPage();

  for (const p of PAGES) {
    const url = BASE + p.path;
    const consoleErrors = [];
    const networkErrors = [];

    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300)); });
    page.on('pageerror', err => consoleErrors.push('[pageerror] ' + (err.message || String(err))));
    page.on('response', resp => { if (resp.status() >= 400 && resp.url().startsWith(BASE)) networkErrors.push(`${resp.status()} ${resp.url()}`); });

    process.stdout.write(`→ ${p.name.padEnd(20)} ${url} … `);
    let title = '', mojibake = [], status = 'ok';
    try {
      const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });
      title = await page.title();
      const html = await page.content();
      // Strip script/style content from mojibake check (avoid false positives in inlined bundles)
      const visible = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
      let m;
      const found = new Set();
      const re = new RegExp(MOJIBAKE_RE.source, 'g');
      while ((m = re.exec(visible)) !== null) {
        found.add(m[0]);
        if (found.size > 20) break;
      }
      mojibake = Array.from(found);
      if (resp && resp.status() >= 400) status = `http_${resp.status()}`;
      // Screenshot
      await page.screenshot({ path: path.join(OUT_DIR, `${p.name}.png`), fullPage: true });
      process.stdout.write(`\x1b[32mOK\x1b[0m`);
      if (mojibake.length) process.stdout.write(` \x1b[33mmojibake=${mojibake.length}\x1b[0m`);
      if (consoleErrors.length) process.stdout.write(` \x1b[31mconsole-errors=${consoleErrors.length}\x1b[0m`);
      console.log();
    } catch (e) {
      status = 'error';
      console.log(`\x1b[31mFAIL\x1b[0m ${e.message}`);
    }
    REPORT.pages.push({
      name: p.name, url, status, title,
      consoleErrors, networkErrors, mojibake
    });
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
    page.removeAllListeners('response');
  }

  await browser.close();
  REPORT.finished = new Date().toISOString();

  // Summary
  const errs = REPORT.pages.filter(p => p.status !== 'ok' || p.consoleErrors.length || p.mojibake.length);
  console.log('\n' + '='.repeat(60));
  console.log(`QA done : ${REPORT.pages.length} pages, ${errs.length} with issues.`);
  if (errs.length) {
    for (const e of errs) {
      console.log(`  ${e.name.padEnd(20)} status=${e.status} mojibake=${e.mojibake.length} console=${e.consoleErrors.length}`);
    }
  }
  fs.writeFileSync('qa-report.json', JSON.stringify(REPORT, null, 2));
  console.log(`Screenshots : ${OUT_DIR}/`);
  console.log(`Report : qa-report.json`);
  process.exit(errs.length ? 1 : 0);
})();
