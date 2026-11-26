// Render the explainer to an MP4 with headless Chrome, using the player page's own exporter (WebCodecs; no ffmpeg).
// Needs the dev server running (bun run dev), then:
//   bun diorama-wip/render.mjs [out.mp4] [samples=16] [url=http://localhost:5174/explainer.html]
import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';

const out = process.argv[2] || 'sausage-gazette-explainer.mp4';
const samples = Number(process.argv[3] || 16);
const url = process.argv[4] || 'http://localhost:5174/explainer.html';
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  protocolTimeout: 0,
});
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction('window.__explainer && window.__explainer.ready', { timeout: 120000 });
  const t0 = Date.now();
  console.log(`rendering at ${samples} samples per frame...`);
  const b64 = await page.evaluate((s) => window.__explainer.exportMp4(s), samples);
  writeFileSync(out, Buffer.from(b64, 'base64'));
  console.log(`saved ${out} (${(b64.length * 0.75 / 1e6).toFixed(1)} MB) in ${Math.round((Date.now() - t0) / 1000)} s`);
} finally {
  await browser.close();
}
