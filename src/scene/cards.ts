// A tarot card mesh: back + front faces, gold edge, halo, and the three-layer seal.
import * as THREE from 'three';
import { TAROT } from '../data/tarot';
import { cardGlowTexture, sealRingTexture } from './textures';
import backUrl from '../assets/cards/back.webp?url';

export const CARD_W = 0.3;
export const CARD_H = 0.447;

const frontModules = import.meta.glob('../assets/cards/[0-9][0-9].webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export function cardImageUrl(id: number): string {
  const key = `../assets/cards/${String(id).padStart(2, '0')}.webp`;
  return frontModules[key];
}
export const cardBackUrl = backUrl;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}

interface Shared {
  faceGeo: THREE.ShapeGeometry;
  edgeGeo: THREE.ExtrudeGeometry;
  backTex: THREE.Texture;
  edgeMat: THREE.MeshStandardMaterial;
  glowTex: THREE.Texture;
  sealTex: THREE.Texture[];
  hitGeo: THREE.PlaneGeometry;
  hitMat: THREE.MeshBasicMaterial;
}
let shared: Shared | null = null;

function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export async function initCardAssets(): Promise<void> {
  const shape = roundedRect(CARD_W, CARD_H, 0.016);
  const faceGeo = new THREE.ShapeGeometry(shape, 6);
  const pos = faceGeo.attributes.position;
  const uv = faceGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + CARD_W / 2) / CARD_W, (pos.getY(i) + CARD_H / 2) / CARD_H);
  }
  uv.needsUpdate = true;
  const edgeGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.0026, bevelEnabled: false, curveSegments: 6 });
  edgeGeo.translate(0, 0, -0.0013);
  const backTex = new THREE.TextureLoader().load(backUrl);
  backTex.colorSpace = THREE.SRGBColorSpace;
  backTex.anisotropy = 8;
  shared = {
    faceGeo,
    edgeGeo,
    backTex,
    edgeMat: new THREE.MeshStandardMaterial({ color: 0xc9a14a, metalness: 0.8, roughness: 0.35, emissive: 0x3a2a10 }),
    glowTex: cardGlowTexture(),
    sealTex: [0, 1, 2].map((i) => sealRingTexture(i)),
    hitGeo: new THREE.PlaneGeometry(CARD_W * 1.04, CARD_H * 1.04),
    hitMat: new THREE.MeshBasicMaterial({ visible: false }),
  };
}

// ---------------------------------------------------------------- front faces
const frontCache = new Map<number, Promise<THREE.Texture>>();

/** Card art + Vietnamese numeral/name drawn into the card's empty bands. */
export function frontTexture(id: number): Promise<THREE.Texture> {
  let p = frontCache.get(id);
  if (!p) {
    p = (async () => {
      const img = await loadImage(cardImageUrl(id));
      const c = document.createElement('canvas');
      c.width = 720;
      c.height = 1073;
      const g = c.getContext('2d')!;
      g.drawImage(img, 0, 0, 720, 1073);
      drawCardText(g, id);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      return t;
    })();
    frontCache.set(id, p);
  }
  return p;
}

function goldFill(g: CanvasRenderingContext2D, y0: number, y1: number) {
  const grd = g.createLinearGradient(0, y0, 0, y1);
  grd.addColorStop(0, '#fff3c8');
  grd.addColorStop(0.5, '#e9c26a');
  grd.addColorStop(1, '#b8873a');
  return grd;
}

function fitFont(g: CanvasRenderingContext2D, text: string, weight: string, size: number, family: string, maxW: number) {
  let s = size;
  for (;;) {
    g.font = `${weight} ${s}px ${family}`;
    if (g.measureText(text).width <= maxW || s <= 18) return s;
    s -= 2;
  }
}

function drawCardText(g: CanvasRenderingContext2D, id: number) {
  const card = TAROT[id];
  const serif = '"Cormorant Garamond", Georgia, serif';
  // Repaint the two bands so nothing from the art leaks under the text.
  const band = (y0: number, y1: number) => {
    const grd = g.createLinearGradient(0, y0, 0, y1);
    grd.addColorStop(0, '#1d1d45');
    grd.addColorStop(0.5, '#23234f');
    grd.addColorStop(1, '#1b1a40');
    g.fillStyle = grd;
    g.fillRect(66, y0, 588, y1 - y0);
  };
  band(71, 155);
  band(893, 1003);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.6)';
  g.shadowBlur = 6;
  // Numeral
  g.font = `700 50px ${serif}`;
  g.fillStyle = goldFill(g, 90, 136);
  g.fillText(card.numeral, 360, 115);
  g.font = `400 26px ${serif}`;
  g.fillText('✦', 360 - 30 - g.measureText(card.numeral).width * 1.1, 114);
  g.fillText('✦', 360 + 30 + g.measureText(card.numeral).width * 1.1, 114);
  // Name (Vietnamese) + English subtitle
  const name = card.nameVi.toUpperCase();
  (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '2px';
  fitFont(g, name, '700', 44, serif, 540);
  g.fillStyle = goldFill(g, 912, 962);
  g.fillText(name, 360, 939);
  (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '4px';
  g.font = `italic 500 24px ${serif}`;
  g.fillStyle = 'rgba(232,206,150,0.85)';
  g.fillText(card.nameEn, 360, 978);
  (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
}

const faceUrlCache = new Map<number, Promise<string>>();
/** The composed face (art + Vietnamese title) as an image URL, for the HTML collection. */
export function cardFaceUrl(id: number): Promise<string> {
  let p = faceUrlCache.get(id);
  if (!p) {
    p = frontTexture(id).then(
      (t) =>
        new Promise<string>((res) =>
          (t.image as HTMLCanvasElement).toBlob((b) => res(b ? URL.createObjectURL(b) : cardImageUrl(id)), 'image/webp', 0.86),
        ),
    );
    faceUrlCache.set(id, p);
  }
  return p;
}

// ---------------------------------------------------------------- card mesh
export class CardMesh {
  readonly group = new THREE.Group(); // positioned by deck / reveal
  readonly inner = new THREE.Group(); // local flip + shake
  readonly backMat: THREE.MeshBasicMaterial;
  readonly frontMat: THREE.MeshBasicMaterial;
  readonly glowMat: THREE.MeshBasicMaterial;
  readonly glow: THREE.Mesh;
  readonly hit: THREE.Mesh;
  readonly seals: THREE.Mesh[] = [];
  readonly sealMats: THREE.MeshBasicMaterial[] = [];
  readonly front: THREE.Mesh;
  index: number;
  controlled = false;
  hover = 0; // smoothed 0..1
  hoverTarget = 0;
  dim = 0; // smoothed 0..1 darkening
  dimTarget = 0;
  glowColor = new THREE.Color('#9b7bff');
  glowBase = 0;

  constructor(index: number) {
    const s = shared!;
    this.index = index;
    this.backMat = new THREE.MeshBasicMaterial({ map: s.backTex, color: 0xffffff });
    this.frontMat = new THREE.MeshBasicMaterial({ color: 0xebebeb });
    const back = new THREE.Mesh(s.faceGeo, this.backMat);
    back.position.z = 0.0014;
    this.front = new THREE.Mesh(s.faceGeo, this.frontMat);
    this.front.rotation.y = Math.PI;
    this.front.position.z = -0.0014;
    const hidden = new THREE.MeshBasicMaterial({ visible: false });
    const edge = new THREE.Mesh(s.edgeGeo, [hidden, s.edgeMat]);
    this.inner.add(back, this.front, edge);

    this.glowMat = new THREE.MeshBasicMaterial({
      map: s.glowTex,
      color: 0x000000,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W * 1.6, CARD_H * 1.6), this.glowMat);
    this.glow.position.z = -0.03;
    this.glow.renderOrder = -1;

    for (let i = 0; i < 3; i++) {
      const m = new THREE.MeshBasicMaterial({
        map: s.sealTex[i],
        color: 0x000000,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const seal = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.27), m);
      seal.position.z = 0.003 + i * 0.0008;
      seal.visible = false;
      this.inner.add(seal);
      this.seals.push(seal);
      this.sealMats.push(m);
    }

    this.hit = new THREE.Mesh(s.hitGeo, s.hitMat);
    this.hit.userData.card = this;
    this.group.add(this.glow, this.inner, this.hit);
  }

  async setFace(id: number) {
    const t = await frontTexture(id);
    this.frontMat.map = t;
    this.frontMat.needsUpdate = true;
  }

  clearFace() {
    this.frontMat.map = null;
    this.frontMat.needsUpdate = true;
  }

  /** Called each frame by the owner. */
  updateLook(dt: number, time: number) {
    const k = 1 - Math.exp(-dt * 10);
    this.hover += (this.hoverTarget - this.hover) * k;
    this.dim += (this.dimTarget - this.dim) * (1 - Math.exp(-dt * 6));
    const b = 1 - this.dim * 0.72;
    this.backMat.color.setScalar(b);
    const pulse = 0.85 + 0.15 * Math.sin(time * 3 + this.index);
    const g = (this.glowBase + this.hover * 1.4) * pulse * (1 - this.dim);
    this.glowMat.color.copy(this.glowColor).multiplyScalar(g);
  }
}
