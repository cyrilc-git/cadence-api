// Genere un PNG carre haute-resolution du logo Cadence (icone officielle
// app/icon.svg) pour l'upload du logo d'app LinkedIn. Sortie : Downloads.
import fs from 'node:fs';
import { chromium } from 'playwright';

const svg = fs.readFileSync('app/icon.svg', 'utf8');
const html = `<!doctype html><html><head><style>
  html,body{margin:0;padding:0;background:transparent}
  #l{width:400px;height:400px}
  #l svg{width:400px;height:400px;display:block}
</style></head><body><div id="l">${svg}</div></body></html>`;

const out = 'C:/Users/cyril/Downloads/cadence-logo.png';
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 400 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  const el = await page.$('#l');
  await el.screenshot({ path: out, omitBackground: true });
  console.log('Logo écrit :', out, '(800x800 px, fond transparent)');
} finally {
  await browser.close();
}
