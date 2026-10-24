import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = path.join(dir, 'appliance-detail-375.html');
const fileUrl = `file:///${html.replace(/\\/g, '/')}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 820 } });
await page.goto(fileUrl, { waitUntil: 'load' });
await page.locator('#appliance-detail-shot').screenshot({
  path: path.join(dir, 'appliance-detail-portal-375.png'),
});
await browser.close();
console.log('Wrote appliance-detail-portal-375.png');
