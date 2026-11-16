// Procedural canvas textures: glows, seal rings, magic circle, rays, velvet cloth, stone wall.
import * as THREE from 'three';

function canvas(w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function tex(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function rand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Soft radial dot (white), for sprites/particles. */
export function dotTexture(): THREE.Texture {
  const [c, g] = canvas(128);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.65)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return tex(c, false);
}

/** Blurred rounded-rect halo used behind cards. Texture covers 1.6x card size. */
export function cardGlowTexture(): THREE.Texture {
  const W = 256, H = 360;
  const [c, g] = canvas(W, H);
  const cw = W / 1.6, ch = H / 1.6;
  g.filter = 'blur(18px)';
  g.fillStyle = 'white';
  const x = (W - cw) / 2, y = (H - ch) / 2;
  g.beginPath();
  g.roundRect(x, y, cw, ch, 14);
  g.fill();
  g.filter = 'blur(6px)';
  g.globalAlpha = 0.8;
  g.beginPath();
  g.roundRect(x + 2, y + 2, cw - 4, ch - 4, 12);
  g.fill();
  return tex(c, false);
}

function runeGlyph(g: CanvasRenderingContext2D, r: () => number, size: number) {
  // A little angular "rune": 2–4 strokes inside a box of `size`.
  const n = 2 + Math.floor(r() * 3);
  g.beginPath();
  const pts = () => [(r() - 0.5) * size, (r() - 0.5) * size] as const;
  g.moveTo(0, -size / 2);
  g.lineTo(0, size / 2);
  for (let i = 0; i < n; i++) {
    const [a, b] = pts();
    const [c2, d] = pts();
    g.moveTo(a, b);
    g.lineTo(c2, d);
  }
  g.stroke();
}

/**
 * One ring of the three-layer seal on the card back.
 * layer 0 = outer runic ring, 1 = middle star ring, 2 = inner core sigil.
 */
export function sealRingTexture(layer: number): THREE.Texture {
  const S = 512;
  const [c, g] = canvas(S);
  const r = rand(17 + layer * 31);
  g.translate(S / 2, S / 2);
  g.strokeStyle = 'white';
  g.fillStyle = 'white';
  g.shadowColor = 'white';
  g.shadowBlur = 10;
  if (layer === 0) {
    const R = 236;
    g.lineWidth = 6;
    g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 3;
    g.beginPath(); g.arc(0, 0, R - 44, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 3.5;
    const N = 16;
    for (let i = 0; i < N; i++) {
      g.save();
      g.rotate((i / N) * Math.PI * 2);
      g.translate(0, -(R - 22));
      runeGlyph(g, r, 22);
      g.restore();
    }
  } else if (layer === 1) {
    const R = 178;
    g.lineWidth = 4;
    g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke();
    // hexagram
    g.lineWidth = 3.5;
    for (let k = 0; k < 2; k++) {
      g.beginPath();
      for (let i = 0; i <= 3; i++) {
        const a = (i / 3) * Math.PI * 2 + k * Math.PI / 3 - Math.PI / 2;
        const x = Math.cos(a) * (R - 6), y = Math.sin(a) * (R - 6);
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6 - Math.PI / 2;
      g.beginPath(); g.arc(Math.cos(a) * (R - 6), Math.sin(a) * (R - 6), 9, 0, Math.PI * 2); g.fill();
    }
  } else {
    const R = 104;
    g.lineWidth = 4;
    g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 3;
    g.beginPath(); g.arc(0, 0, R - 18, 0, Math.PI * 2); g.stroke();
    // crescent + eye
    g.beginPath();
    g.arc(0, 0, 54, 0.35 * Math.PI, 1.65 * Math.PI, false);
    g.arc(18, 0, 46, 1.55 * Math.PI, 0.45 * Math.PI, true);
    g.closePath();
    g.fill();
    g.beginPath(); g.arc(8, 0, 13, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 8; i++) {
      g.save();
      g.rotate((i / 8) * Math.PI * 2);
      g.beginPath(); g.moveTo(0, -R + 2); g.lineTo(5, -R - 14); g.lineTo(-5, -R - 14); g.closePath(); g.fill();
      g.restore();
    }
  }
  return tex(c, false);
}

/** Large magic circle drawn behind the drawn card. */
export function magicCircleTexture(): THREE.Texture {
  const S = 1024;
  const [c, g] = canvas(S);
  const r = rand(99);
  g.translate(S / 2, S / 2);
  g.strokeStyle = 'white';
  g.fillStyle = 'white';
  g.shadowColor = 'white';
  g.shadowBlur = 8;
  const ring = (R: number, w: number) => { g.lineWidth = w; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke(); };
  ring(500, 5); ring(470, 2); ring(390, 3); ring(250, 2.5); ring(232, 1.5);
  g.lineWidth = 3;
  for (let i = 0; i < 36; i++) {
    g.save(); g.rotate((i / 36) * Math.PI * 2); g.translate(0, -432); runeGlyph(g, r, 34); g.restore();
  }
  // two overlapping squares + star
  g.lineWidth = 2.5;
  for (let k = 0; k < 2; k++) {
    g.save(); g.rotate(k * Math.PI / 4);
    g.strokeRect(-275, -275, 550, 550);
    g.restore();
  }
  g.beginPath();
  for (let i = 0; i <= 5; i++) {
    const a = (i * 2 / 5) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * 232, y = Math.sin(a) * 232;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.beginPath(); g.arc(Math.cos(a) * 390, Math.sin(a) * 390, 7, 0, Math.PI * 2); g.fill();
  }
  return tex(c, false);
}

/** Radial light rays (white), soft falloff. */
export function raysTexture(): THREE.Texture {
  const S = 512;
  const [c, g] = canvas(S);
  g.translate(S / 2, S / 2);
  const N = 22;
  const r = rand(5);
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + r() * 0.1;
    const w = 0.04 + r() * 0.07;
    const len = 200 + r() * 56;
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, len);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, len, a - w, a + w);
    g.closePath();
    g.fill();
  }
  const core = g.createRadialGradient(0, 0, 0, 0, 0, 120);
  core.addColorStop(0, 'rgba(255,255,255,0.8)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = core;
  g.fillRect(-256, -256, 512, 512);
  return tex(c, false);
}

/** Candle flame (vertical teardrop). */
export function flameTexture(): THREE.Texture {
  const [c, g] = canvas(64, 128);
  const grd = g.createRadialGradient(32, 84, 2, 32, 74, 50);
  grd.addColorStop(0, 'rgba(255,255,240,1)');
  grd.addColorStop(0.3, 'rgba(255,214,120,0.95)');
  grd.addColorStop(0.65, 'rgba(255,140,40,0.45)');
  grd.addColorStop(1, 'rgba(255,90,20,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(32, 6);
  g.bezierCurveTo(52, 50, 54, 92, 32, 118);
  g.bezierCurveTo(10, 92, 12, 50, 32, 6);
  g.fill();
  return tex(c);
}

/** Velvet tablecloth top: deep purple with an embroidered gold zodiac circle. */
export function tableTopTexture(): THREE.Texture {
  const S = 1024;
  const [c, g] = canvas(S);
  const r = rand(3);
  const bg = g.createRadialGradient(S / 2, S / 2, 40, S / 2, S / 2, S / 2);
  bg.addColorStop(0, '#3a1d5c');
  bg.addColorStop(0.7, '#251041');
  bg.addColorStop(1, '#170a2b');
  g.fillStyle = bg;
  g.fillRect(0, 0, S, S);
  // velvet noise
  const img = g.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 14;
    img.data[i] += n; img.data[i + 1] += n * 0.7; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  g.translate(S / 2, S / 2);
  g.strokeStyle = 'rgba(226,186,104,0.85)';
  g.fillStyle = 'rgba(226,186,104,0.85)';
  const ring = (R: number, w: number) => { g.lineWidth = w; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke(); };
  ring(480, 6); ring(462, 2); ring(360, 3); ring(344, 1.5);
  // moon phases around
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = Math.cos(a) * 411, y = Math.sin(a) * 411;
    g.save(); g.translate(x, y);
    g.beginPath(); g.arc(0, 0, 20, 0, Math.PI * 2); g.lineWidth = 2; g.stroke();
    const phase = (i / 12) * 2 - 1;
    g.beginPath(); g.arc(0, 0, 20, -Math.PI / 2, Math.PI / 2); g.ellipse(0, 0, Math.abs(phase) * 20, 20, 0, Math.PI / 2, -Math.PI / 2, phase > 0); g.fill();
    g.restore();
  }
  for (let i = 0; i < 90; i++) {
    const a = r() * Math.PI * 2, d = r() * 330;
    g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, r() * 2.2 + 0.6, 0, Math.PI * 2); g.fill();
  }
  // central star
  g.lineWidth = 2.5;
  g.beginPath();
  for (let i = 0; i <= 8; i++) {
    const a = (i * 3 / 8) * Math.PI * 2;
    const x = Math.cos(a) * 300, y = Math.sin(a) * 300;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
  ring(120, 2);
  return tex(c);
}

/** Tablecloth side: velvet folds with a gold embroidered hem at the bottom (v=0). */
export function clothSideTexture(): THREE.Texture {
  const W = 1024, H = 512;
  const [c, g] = canvas(W, H);
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#2a1347');
  grd.addColorStop(1, '#1a0a2e');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  // vertical folds
  for (let x = 0; x < W; x++) {
    const f = Math.sin(x / W * Math.PI * 2 * 18) * 0.5 + Math.sin(x / W * Math.PI * 2 * 7 + 1) * 0.5;
    g.fillStyle = f > 0 ? `rgba(160,110,220,${f * 0.10})` : `rgba(0,0,0,${-f * 0.35})`;
    g.fillRect(x, 0, 1, H);
  }
  // gold hem
  g.fillStyle = 'rgba(214,170,90,0.9)';
  g.fillRect(0, H - 46, W, 6);
  g.fillRect(0, H - 18, W, 4);
  for (let x = 12; x < W; x += 32) {
    g.beginPath(); g.moveTo(x, H - 38); g.lineTo(x + 8, H - 30); g.lineTo(x, H - 22); g.lineTo(x - 8, H - 30); g.closePath(); g.fill();
  }
  const t = tex(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** Dark stone wall for the entrance. */
export function stoneTexture(): THREE.Texture {
  const S = 512;
  const [c, g] = canvas(S);
  const r = rand(11);
  g.fillStyle = '#1a1124';
  g.fillRect(0, 0, S, S);
  const rowH = 64;
  for (let row = 0; row < S / rowH; row++) {
    const off = (row % 2) * 64;
    for (let x = -off; x < S; x += 128) {
      const l = 22 + r() * 14;
      g.fillStyle = `rgb(${l + 8},${l},${l + 16})`;
      g.fillRect(x + 3, row * rowH + 3, 122, rowH - 6);
    }
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Dark wooden floorboards for the room. */
export function floorTexture(): THREE.Texture {
  const W = 512, H = 512;
  const [c, g] = canvas(W, H);
  const r = rand(23);
  g.fillStyle = '#140d1c';
  g.fillRect(0, 0, W, H);
  const plankH = 64;
  for (let row = 0; row < H / plankH; row++) {
    let x = -r() * 200;
    while (x < W) {
      const len = 180 + r() * 220;
      const l = 30 + r() * 16;
      const grad = g.createLinearGradient(0, row * plankH, 0, (row + 1) * plankH);
      grad.addColorStop(0, `rgb(${l + 14},${l + 4},${l + 18})`);
      grad.addColorStop(1, `rgb(${l},${l - 6},${l + 6})`);
      g.fillStyle = grad;
      g.fillRect(x + 2, row * plankH + 2, len - 4, plankH - 4);
      // grain
      g.globalAlpha = 0.18;
      for (let k = 0; k < 6; k++) {
        g.strokeStyle = r() < 0.5 ? '#000' : '#5a4468';
        g.beginPath();
        const y = row * plankH + 6 + r() * (plankH - 12);
        g.moveTo(x + 4, y);
        g.bezierCurveTo(x + len * 0.3, y + (r() - 0.5) * 6, x + len * 0.7, y + (r() - 0.5) * 6, x + len - 4, y);
        g.stroke();
      }
      g.globalAlpha = 1;
      x += len;
    }
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Alpha ramp along V (canvas top = far end): stops = [canvasY, gray] pairs; alphaMap reads green. */
export function fadeAlphaTexture(stops: [number, string][] = [[0, '#000'], [0.45, '#000'], [0.75, '#fff'], [1, '#fff']]): THREE.Texture {
  const [c, g] = canvas(4, 256);
  const grad = g.createLinearGradient(0, 0, 0, 256);
  for (const [t, col] of stops) grad.addColorStop(t, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  return tex(c, false);
}

/** Soft dark disc for contact shadows. */
export function shadowTexture(): THREE.Texture {
  const S = 256;
  const [c, g] = canvas(S);
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.85)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.6)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  return tex(c, false);
}

/** Wispy cloud blob for low-lying mist. */
export function mistTexture(seed = 5): THREE.Texture {
  const W = 512, H = 256;
  const [c, g] = canvas(W, H);
  const r = rand(seed);
  for (let i = 0; i < 70; i++) {
    const x = W * (0.15 + r() * 0.7);
    const y = H * (0.35 + r() * 0.35);
    const rad = 30 + r() * 70;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    const a = 0.05 + r() * 0.07;
    grad.addColorStop(0, `rgba(255,255,255,${a})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // fade the borders so sprites never show an edge
  g.globalCompositeOperation = 'destination-in';
  const fx = g.createLinearGradient(0, 0, W, 0);
  fx.addColorStop(0, 'rgba(0,0,0,0)');
  fx.addColorStop(0.2, 'rgba(0,0,0,1)');
  fx.addColorStop(0.8, 'rgba(0,0,0,1)');
  fx.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fx;
  g.fillRect(0, 0, W, H);
  const fy = g.createLinearGradient(0, 0, 0, H);
  fy.addColorStop(0, 'rgba(0,0,0,0)');
  fy.addColorStop(0.35, 'rgba(0,0,0,1)');
  fy.addColorStop(0.75, 'rgba(0,0,0,1)');
  fy.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fy;
  g.fillRect(0, 0, W, H);
  return tex(c);
}

/** Vertical sliver of light: bright core, soft sides, fading at both ends. */
export function seamTexture(): THREE.Texture {
  const W = 32, H = 256;
  const [c, g] = canvas(W, H);
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const fy = Math.min(1, y / 30, (H - 1 - y) / 30);
    for (let x = 0; x < W; x++) {
      const dx = Math.abs(x - (W - 1) / 2) / (W / 2);
      const a = Math.pow(Math.max(0, 1 - dx), 2.2) * fy;
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  return tex(c);
}
