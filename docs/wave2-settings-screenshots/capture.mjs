import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = path.join(dir, 'preview.html');
const fileUrl = `file:///${html.replace(/\\/g, '/')}`;

const shots = [
  { id: 'badge-shot', out: 'recall-nav-badge-375.png', height: 120 },
  { id: 'parts-shot', out: 'parts-links-panel-375.png', height: 520 },
  { id: 'lifespan-shot', out: 'appliance-lifespans-panel-375.png', height: 480 },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 900 } });
await page.goto(fileUrl, { waitUntil: 'load' });

for (const { id, out, height } of shots) {
  const el = page.locator(`#${id}`);
  await el.screenshot({ path: path.join(dir, out) });
}

await browser.close();
console.log('Wrote', shots.map((s) => s.out).join(', '));
