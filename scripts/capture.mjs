// Deterministic capture of the running dev server (npm run dev must be up).
//   node scripts/capture.mjs shots  [--w 1280 --h 720] [--rarity legendary]
//   node scripts/capture.mjs video  [--w 1280 --h 720] [--rarity legendary]
// Frames land in screenshots/<mode>/; video mode also encodes screenshots/proof.mp4.
import { chromium } from 'playwright-core';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const args = process.argv.slice(2);
const mode = args[0] || 'shots';
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const W = Number(opt('w', 1280));
const H = Number(opt('h', 720));
const rarity = opt('rarity', 'legendary');
const url = opt('url', 'http://localhost:5173/');
const outDir = path.resolve('screenshots', opt('out', mode));

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find((p) => existsSync(p));

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

await page.goto(`${url}?capture=1&turns=9&reset=1`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
await page.waitForTimeout(800); // textures decode
const gl = await page.evaluate(() => window.__gl);
console.log('renderer:', gl);
if (/swiftshader|llvmpipe|lavapipe/i.test(gl)) console.warn('WARNING: software renderer');
await page.evaluate((r) => { window.__game.state.forceRarity = r; }, rarity);

let frame = 0;
const step = (n = 1) => page.evaluate((k) => window.__step(k), n);
const shot = async (name) => {
  const f = path.join(outDir, name ?? `frame_${String(frame).padStart(4, '0')}.png`);
  await page.screenshot({ path: f });
  frame++;
  return f;
};
/** Advance `sec` seconds; in video mode grab every frame, otherwise just step. */
const run = async (sec, every = mode === 'video' || mode === 'witch') => {
  const n = Math.round(sec * 30);
  for (let i = 0; i < n; i++) {
    await step(1);
    if (every) await shot();
  }
};
const phase = () => page.evaluate(() => window.__game.phase);
const waitPhase = async (p, maxSec = 20) => {
  for (let i = 0; i < maxSec * 30; i++) {
    if ((await phase()) === p) return;
    await step(1);
    if (mode === 'video' || mode === 'witch') await shot();
  }
  throw new Error(`timeout waiting for phase ${p}, at ${await phase()}`);
};

if (mode === 'shots') {
  await step(2);
  await shot('01_intro.png');
  await page.click('[data-el=enter]');
  await run(1.6);
  await shot('02_doors.png');
  await waitPhase('idle');
  await run(0.4);
  await shot('03_idle.png');
  await page.evaluate(() => window.__game.hoverIndex(6));
  await run(0.5);
  await shot('04_hover.png');
  await page.evaluate(() => window.__game.pickIndex(6));
  await run(1.1);
  await shot('05_approach.png');
  await waitPhase('seals');
  await run(0.3);
  await shot('06_seals.png');
  for (let k = 0; k < 3; k++) {
    await page.evaluate(() => window.__game.tap());
    await run(0.2);
    await shot(`07_seal${k + 1}.png`);
    if (k < 2) await waitPhase('seals');
  }
  await run(1.0);
  await shot('08_tremble.png');
  await run(0.6);
  await shot('09_flip.png');
  await waitPhase('result');
  await run(2.5);
  await shot('10_result.png');
  await page.evaluate(() => document.querySelector('[data-next]').click());
  await run(1.0);
  await shot('11_reshuffle.png');
  await waitPhase('idle');
  await run(0.3);
  await shot('12_idle2.png');
} else if (mode === 'witch') {
  // ~20 s of the witch acting: welcome, shuffle, idle life, eyes on the cards, a poke, a reveal
  await run(0.4);
  await page.click('[data-el=enter]');
  await waitPhase('idle');
  await run(2.6);
  await page.evaluate(() => window.__game.hoverIndex(2));
  await run(0.9);
  await page.evaluate(() => window.__game.hoverIndex(8));
  await run(0.9);
  await page.evaluate(() => window.__game.hoverIndex(null));
  await run(0.3);
  await page.evaluate(() => window.__game.pokeWitch());
  await run(2.0);
  await page.evaluate(() => window.__game.pickIndex(5));
  await waitPhase('seals');
  await run(0.5);
  for (let k = 0; k < 3; k++) {
    await page.evaluate(() => window.__game.tap());
    if (k < 2) {
      await waitPhase('seals');
      await run(0.45);
    }
  }
  await waitPhase('result');
  await run(1.5);
} else {
  // ~18 s proof video: intro → enter → deal → pick → seals → flip → gift → result
  await run(0.6);
  await page.click('[data-el=enter]');
  await waitPhase('idle');
  await page.evaluate(() => window.__game.hoverIndex(3));
  await run(0.4);
  await page.evaluate(() => window.__game.hoverIndex(6));
  await run(0.5);
  await page.evaluate(() => window.__game.pickIndex(6));
  await waitPhase('seals');
  await run(0.5);
  for (let k = 0; k < 3; k++) {
    await page.evaluate(() => window.__game.tap());
    if (k < 2) {
      await waitPhase('seals');
      await run(0.45);
    }
  }
  await waitPhase('result');
  await run(2.8);
}

console.log(`frames: ${frame} → ${outDir}`);
if (errors.length) console.log('console errors/warnings:\n' + errors.slice(0, 20).join('\n'));
await browser.close();

if (mode === 'witch') {
  // full frame with a close-up of the witch inset at the bottom right
  const mp4 = path.resolve('screenshots', 'witch.mp4');
  const cx = Math.round(W * 0.39), cy = Math.round(H * 0.05), cw = Math.round(W * 0.22);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(outDir, 'frame_%04d.png'),
    '-filter_complex', `[0:v]split[a][b];[b]crop=${cw}:${cw}:${cx}:${cy},scale=400:400,pad=406:406:3:3:color=0xE9C26A[z];[a]scale=1280:720[m];[m][z]overlay=W-w-16:H-h-16`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', mp4], { stdio: 'inherit' });
  console.log('video:', mp4);
}
if (mode === 'video') {
  const mp4 = path.resolve('screenshots', 'proof.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(outDir, 'frame_%04d.png'),
    '-vf', 'scale=1280:-2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', mp4], { stdio: 'inherit' });
  console.log('video:', mp4);
}
