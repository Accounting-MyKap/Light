// Renders public/icon.svg into the PNG icons the web app manifest needs.
// Usage: PW_CHROMIUM_PATH=/path/to/chromium npm run icons
import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../public/', import.meta.url);
const svg = await readFile(new URL('icon.svg', root), 'utf8');
await mkdir(new URL('icons/', root), { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const page = await browser.newPage();

const outputs = [
  { name: 'icon-192.png', size: 192, scale: 1, background: 'transparent' },
  { name: 'icon-512.png', size: 512, scale: 1, background: 'transparent' },
  // Maskable icons need their content inside the central 80 % safe zone.
  { name: 'icon-maskable-512.png', size: 512, scale: 0.8, background: '#0E0F1A' },
];

for (const { name, size, scale, background } of outputs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${background}">
    <div style="width:${size * scale}px;height:${size * scale}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
  </body></html>`);
  await page.screenshot({ path: fileURLToPath(new URL(`icons/${name}`, root)), omitBackground: background === 'transparent' });
  console.log(`wrote public/icons/${name}`);
}

await browser.close();
