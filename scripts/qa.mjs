#!/usr/bin/env node
/**
 * Cadence QA — Playwright local runner (V8.1 enrichi).
 *
 * Usage :
 *   npm i playwright    (only first run)
 *   npx playwright install chromium
 *   node scripts/qa.mjs                   # tests prod
 *   BASE_URL=http://localhost:3000 node scripts/qa.mjs
 *   VIEWPORT=mobile node scripts/qa.mjs   # iPhone 13 viewport
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'https://cadence-api-ruddy.vercel.app';
const VIEWPORT_NAME = process.env.VIEWPORT || 'desktop';
const VIEWPORT = VIEWPORT_NAME === 'mobile'
  ? { width: 390, height: 844 }     // iPhone 13
  : { width: 1440, height: 900 };
const OUT_DIR = path.resolve(`qa-screens-${VIEWPORT_NAME}`);
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

// Patterns de mojibake
const MOJIBAKE_RE = /[Ã][\x80-\xff]|[Â][\x80-\xa6\xa8-\xff]|â€[\x80-\xff]?|ð[\x80-\xff]{1,3}|�/;

const REPORT = {
  base: BASE,
  viewport: VIEWPORT_NAME,
  viewportSize: VIEWPORT,
  started: new Date().toISOString(),
  pages: []
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT, locale: 'fr-FR' });
  const page = await context.newPage();

  for (const p of PAGES) {
    const url = BASE + p.path;
    const consoleErrors = [];
    const networkErrors = [];

    const onConsole = msg => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300)); };
    const onPageError = err => consoleErrors.push('[pageerror] ' + (err.message || String(err)));
    const onResponse = resp => { if (resp.status() >= 400 && resp.url().startsWith(BASE)) networkErrors.push(`${resp.status()} ${resp.url()}`); };

    page.on('console', onConsole);
    page.on('pageerror', onPageError);
    page.on('response', onResponse);

    process.stdout.write(`→ ${p.name.padEnd(20)} ${url} … `);
    let title = '', mojibake = [], status = 'ok';
    let overflow = false, brokenSkeletons = 0, bareTextNodes = 0;

    try {
      const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      title = await page.title();

      const html = await page.content();
      const visible = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
      const found = new Set();
      const re = new RegExp(MOJIBAKE_RE.source, 'g');
      let m;
      while ((m = re.exec(visible)) !== null) {
        found.add(m[0]);
        if (found.size > 20) break;
      }
      mojibake = Array.from(found);

      // V8.1 — overflow detection
      overflow = await page.evaluate(() => {
        const main = document.querySelector('main');
        if (!main) return false;
        return main.scrollWidth > main.clientWidth + 4;
      });

      // V8.1 — broken skeleton detection : skeletons still visible after networkidle
      brokenSkeletons = await page.evaluate(() => document.querySelectorAll('.skeleton').length);

      // V8.1 — naked text nodes (text directly inside <body> root, often = render error)
      bareTextNodes = await page.evaluate(() => {
        const body = document.body;
        if (!body) return 0;
        let count = 0;
        for (const node of body.childNodes) {
          if (node.nodeType === 3 && node.textContent && node.textContent.trim().length > 0) count++;
        }
        return count;
      });

      if (resp && resp.status() >= 400) status = `http_${resp.status()}`;

      await page.screenshot({ path: path.join(OUT_DIR, `${p.name}.png`), fullPage: true });
      const flags = [];
      if (mojibake.length) flags.push(`mojibake=${mojibake.length}`);
      if (consoleErrors.length) flags.push(`console=${consoleErrors.length}`);
      if (networkErrors.length) flags.push(`http=${networkErrors.length}`);
      if (overflow) flags.push('overflow');
      if (brokenSkeletons > 0) flags.push(`skeletons=${brokenSkeletons}`);
      if (bareTextNodes > 0) flags.push(`bareText=${bareTextNodes}`);
      if (flags.length === 0) console.log('\x1b[32mOK\x1b[0m');
      else console.log('\x1b[33m' + flags.join(' ') + '\x1b[0m');
    } catch (e) {
      status = 'error';
      console.log(`\x1b[31mFAIL\x1b[0m ${e.message}`);
    }

    REPORT.pages.push({
      name: p.name, url, status, title,
      consoleErrors, networkErrors, mojibake,
      overflow, brokenSkeletons, bareTextNodes
    });

    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('response', onResponse);
  }

  await browser.close();
  REPORT.finished = new Date().toISOString();

  const errs = REPORT.pages.filter(p =>
    p.status !== 'ok' || p.consoleErrors.length || p.mojibake.length || p.overflow || p.brokenSkeletons > 0
  );
  console.log('\n' + '='.repeat(60));
  console.log(`QA ${VIEWPORT_NAME} : ${REPORT.pages.length} pages, ${errs.length} avec issues.`);
  if (errs.length) {
    for (const e of errs) {
      const flags = [];
      if (e.status !== 'ok') flags.push(`status=${e.status}`);
      if (e.mojibake.length) flags.push(`mojibake=${e.mojibake.length}`);
      if (e.consoleErrors.length) flags.push(`console=${e.consoleErrors.length}`);
      if (e.overflow) flags.push('overflow');
      if (e.brokenSkeletons > 0) flags.push(`skeletons=${e.brokenSkeletons}`);
      console.log(`  ${e.name.padEnd(20)} ${flags.join(' ')}`);
    }
  }
  fs.writeFileSync(`qa-report-${VIEWPORT_NAME}.json`, JSON.stringify(REPORT, null, 2));
  console.log(`\nScreenshots : ${OUT_DIR}/`);
  console.log(`Report      : qa-report-${VIEWPORT_NAME}.json`);
  process.exit(errs.length ? 1 : 0);
})();
