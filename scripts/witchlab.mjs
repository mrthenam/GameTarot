// Shoot the witch rig in fixed poses (dev server must be up): node scripts/witchlab.mjs [face|body]
// Writes screenshots/witchlab/<zoom>_<name>.png and a contact sheet <zoom>_sheet.png.
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const zoom = process.argv[2] || 'face';
const only = process.argv[3];
const outDir = path.resolve('screenshots', 'witchlab');
mkdirSync(outDir, { recursive: true });
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));

const Z = { uLid: [0, 0, 0, 0], uMouth: [0, 0, 0, 0], uBrow: [0, 0, 0, 0], uGaze: [0, 0], uHead: [0, 0, 0], uBody: [0, 0, 0, 0], uHandL: [0, 0, 0, 0], uHandR: [0, 0, 0, 0], uCast: [0] };
const FACE = {
  neutral: {},
  blink: { uLid: [1, 1, 0, 0] },
  halfLid: { uLid: [0.5, 0.5, 0, 0] },
  wide: { uLid: [0, 0, 1, 0], uBrow: [1, 0, 0, 0] },
  smile: { uLid: [0, 0, 0, 0.6], uMouth: [1, 0, 0, 0] },
  delighted: { uLid: [0, 0, 0, 0.6], uMouth: [1, 0.35, 0, 0], uBrow: [0.4, 0, 0, 0] },
  sad: { uBrow: [0, 1, 0, 0], uMouth: [-0.8, 0, 0, 0], uLid: [0.35, 0.35, 0, 0] },
  talk: { uMouth: [0.2, 0.45, 0, 0] },
  surprised: { uMouth: [0, 0.6, 0.7, 0], uBrow: [1, 0, 0, 0], uLid: [0, 0, 1, 0] },
  focus: { uBrow: [0, 0, 0.7, 0], uLid: [0.5, 0.5, 0, 0] },
  arch: { uBrow: [0.2, 0, 0, 1], uMouth: [0.3, 0, 0, 0] },
  wink: { uLid: [0, 1, 0, 0.3], uMouth: [0.5, 0, 0, 0] },
  lookL: { uGaze: [-7, 0] },
  lookR: { uGaze: [7, 0] },
  lookDown: { uGaze: [0, 3.2], uLid: [0.22, 0.22, 0, 0] },
  headTurn: { uHead: [0.06, 0.7, 0], uGaze: [6, 0] },
  nod: { uHead: [0, 0, 0.9] },
};
const BODY = {
  neutral: {},
  breathIn: { uBody: [1, 0, 0, 0] },
  handsUp: { uHandL: [-0.04, 0, -26, 0], uHandR: [0.04, 0, -26, 0] },
  handsSpread: { uHandL: [-0.09, 0, -20, 0], uHandR: [0.09, 0, -20, 0] },
  roll: { uHead: [0.08, 0, 0], uBody: [0, 0, 0, -9] },
  lean: { uHead: [0, -0.4, 0.8] },
};
const poses = zoom === 'body' ? BODY : FACE;

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const size = zoom === 'body' ? { width: 560, height: 700 } : { width: 640, height: 640 };
const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:5173/witchlab.html?zoom=${zoom}&still`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const files = [];
for (const [name, ov] of Object.entries(poses)) {
  if (only && name !== only) continue;
  await page.evaluate((o) => { window.__ov = o; window.__t = 0; }, { ...Z, ...ov });
  await page.waitForTimeout(150);
  const f = path.join(outDir, `${zoom}_${name}.png`);
  await page.screenshot({ path: f });
  files.push([name, f]);
}
console.log(JSON.stringify({ files: files.map((x) => x[1]), errors }));
await browser.close();
