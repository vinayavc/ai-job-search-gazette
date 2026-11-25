import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'node:fs';
const out = process.argv[2] || './stills';
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()); });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto('http://localhost:8765/test.html?r=' + Date.now(), { waitUntil: 'load' });
await page.waitForFunction('window.__done || window.__error', { timeout: 300000 });
const err = await page.evaluate('window.__error || null');
if (err) { console.log('ERROR', err); process.exit(1); }
const imgs = await page.evaluate(() => [...document.querySelectorAll('.still img')].map((i) => i.src));
imgs.forEach((src, i) => writeFileSync(`${out}/still${i + 1}.jpg`, Buffer.from(src.split(',')[1], 'base64')));
console.log('saved', imgs.length, await page.evaluate(() => navigator.userAgent.includes('Headless')), await page.evaluate(() => { const c = document.createElement('canvas').getContext('webgl2'); const d = c.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'n/a'; }));
await browser.close();
