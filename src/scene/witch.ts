// The fortune-teller: one painting rigged like a 2D puppet.
// The vertex shader bends head, hands and hair around their pivots; the fragment shader
// re-samples the painting around the eyes, brows and mouth so she can blink, glance,
// talk and change expression. All rig maths works in image pixels (x right, y down).
import * as THREE from 'three';
import witchUrl from '../assets/img/witch.webp?url';
import { dotTexture } from './textures';

export const WITCH_H = 1.62;
const IW = 1020;
const IH = 1300;
const WITCH_ASPECT = IW / IH;

// Landmarks in the painting (pixels).
const EYE_PX: [number, number][] = [[440, 305], [583, 306]];
const HANDS_PX: [number, number] = [506, 728];
const HEAD_PX: [number, number] = [530, 250];
const HEAD_PIVOT: [number, number] = [512, 600];
const HAND_PIVOT: [number, number][] = [[440, 1080], [584, 1080]];
const HAND_C: [number, number][] = [[405, 800], [618, 800]];
const HAND_R: [number, number] = [130, 255];

// ------------------------------------------------------------------ expression model
interface Face {
  browUp: number; // both brows up
  browSad: number; // inner ends up
  furrow: number; // brows down and together
  arch: number; // her right brow (image right) up: intrigued
  lid: number; // upper lids down, 0 open .. 1 closed
  wide: number; // eyes opened wide
  squint: number; // lower lids up (smiling eyes)
  smile: number; // -1 sad .. 1 big smile
  jaw: number; // mouth open
  round: number; // "O" mouth
}
const FACE_KEYS = ['browUp', 'browSad', 'furrow', 'arch', 'lid', 'wide', 'squint', 'smile', 'jaw', 'round'] as const;
const F = (o: Partial<Face>): Face => ({ browUp: 0, browSad: 0, furrow: 0, arch: 0, lid: 0, wide: 0, squint: 0, smile: 0, jaw: 0, round: 0, ...o });

export type Mood = 'calm' | 'warm' | 'curious' | 'focus' | 'tense' | 'surprised' | 'delighted' | 'awed' | 'sad' | 'sly';
const MOODS: Record<Mood, Face> = {
  calm: F({ smile: 0.15 }),
  warm: F({ smile: 0.5, squint: 0.3, browUp: 0.1 }),
  curious: F({ arch: 0.9, browUp: 0.25, smile: 0.25 }),
  focus: F({ furrow: 0.6, lid: 0.5 }),
  tense: F({ furrow: 0.3, wide: 0.35, browUp: 0.2, smile: -0.15, jaw: 0.06 }),
  surprised: F({ browUp: 1, wide: 1, jaw: 0.55, round: 0.7 }),
  delighted: F({ browUp: 0.4, smile: 1, squint: 0.6, jaw: 0.35 }),
  awed: F({ browUp: 1, wide: 0.85, jaw: 0.7, round: 0.45, smile: 0.1 }),
  sad: F({ browSad: 1, lid: 0.35, smile: -0.75 }),
  sly: F({ arch: 0.7, smile: 0.7, lid: 0.25, squint: 0.35 }),
};

// ------------------------------------------------------------------ gestures
interface Off {
  roll: number; yaw: number; pitch: number; lean: number; rise: number;
  lift: number; spread: number; jaw: number; smile: number; browUp: number;
  arch: number; lid: number; squint: number; wink: number; wide: number;
}
const OFF_KEYS = ['roll', 'yaw', 'pitch', 'lean', 'rise', 'lift', 'spread', 'jaw', 'smile', 'browUp', 'arch', 'lid', 'squint', 'wink', 'wide'] as const;
const zeroOff = (): Off => ({ roll: 0, yaw: 0, pitch: 0, lean: 0, rise: 0, lift: 0, spread: 0, jaw: 0, smile: 0, browUp: 0, arch: 0, lid: 0, squint: 0, wink: 0, wide: 0 });

const sat = (x: number) => Math.min(1, Math.max(0, x));
const sstep = (a: number, b: number, x: number) => {
  const t = sat((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const hump = (k: number) => Math.sin(Math.PI * sat(k));
/** Quick attack, slow release. */
const strike = (k: number) => (k < 0.18 ? 1 - (1 - k / 0.18) ** 3 : 0.5 + 0.5 * Math.cos((Math.PI * (k - 0.18)) / 0.82));
/** Ease in, hold, ease out. */
const hold = (k: number, a = 0.22, b = 0.3) => sstep(0, a, k) * (1 - sstep(1 - b, 1, k));

export type GestureName = 'nod' | 'bow' | 'shake' | 'tilt' | 'flinch' | 'recoil' | 'laugh' | 'thrust' | 'present' | 'sigh' | 'wink' | 'giggle' | 'leanIn';
const GESTURES: Record<GestureName, [number, (k: number) => Partial<Off>]> = {
  nod: [0.75, (k) => ({ pitch: 0.9 * hump(k), smile: 0.15 * hump(k) })],
  bow: [1.7, (k) => ({ pitch: 1.4 * hold(k, 0.3, 0.35), lean: 0.45 * hold(k, 0.3, 0.35), lid: 0.35 * hold(k, 0.3, 0.35), smile: 0.2 * hold(k) })],
  shake: [1.5, (k) => ({ yaw: 0.6 * Math.sin(k * Math.PI * 5) * (1 - k), pitch: 0.35 * hump(k), lid: 0.2 * hump(k) })],
  tilt: [2.4, (k) => ({ roll: 0.075 * hold(k), arch: 0.7 * hold(k), yaw: -0.15 * hold(k) })],
  flinch: [0.55, (k) => ({ lean: -0.45 * strike(k), rise: 5 * strike(k), lid: 0.9 * hump(Math.min(1, k * 3.2)), wide: 0.3 * strike(k) })],
  recoil: [1.2, (k) => ({ lean: -1 * strike(k), rise: 10 * strike(k), roll: -0.035 * strike(k), lift: 0.55 * strike(k), wide: 0.4 * strike(k), browUp: 0.4 * strike(k) })],
  laugh: [1.5, (k) => {
    const b = Math.abs(Math.sin(k * Math.PI * 5)) * (1 - k);
    return { rise: 5 * b, pitch: -0.15 * hold(k), roll: 0.04 * hump(k), smile: 0.7 * hold(k), squint: 0.7 * hold(k), jaw: 0.25 * hold(k) + 0.25 * b };
  }],
  thrust: [0.5, (k) => ({ lift: 0.7 * strike(k), spread: 0.5 * strike(k), lean: 0.35 * strike(k) })],
  present: [2.6, (k) => ({ lift: 0.75 * hold(k, 0.25, 0.35), spread: 1 * hold(k, 0.25, 0.35), smile: 0.25 * hold(k) })],
  sigh: [2.0, (k) => ({ rise: 7 * hump(k * 1.6) - 3 * hump((k - 0.55) * 2.2), lid: 0.4 * hold(k), pitch: 0.3 * hold(k, 0.4, 0.3) })],
  wink: [0.65, (k) => ({ wink: hump(Math.min(1, k * 1.6)), smile: 0.45 * hump(k), roll: 0.03 * hump(k), squint: 0.3 * hump(k) })],
  giggle: [1.2, (k) => {
    const b = Math.abs(Math.sin(k * Math.PI * 4)) * (1 - k);
    return { rise: 3 * b, smile: 0.6 * hold(k), squint: 0.6 * hold(k), roll: -0.04 * hump(k), wink: hump(Math.min(1, k * 1.5)), jaw: 0.15 * b };
  }],
  leanIn: [1.6, (k) => ({ lean: 0.6 * hold(k, 0.3, 0.3), pitch: 0.3 * hold(k) })],
};

/** Critically damped spring: smooth, overshoot-free follow. */
class Spring {
  x: number;
  v = 0;
  constructor(x = 0) {
    this.x = x;
  }
  step(target: number, dt: number, hz: number) {
    const w = 2 * Math.PI * hz;
    const y = this.x - target;
    const e = Math.exp(-w * dt);
    const ny = (y + (this.v + w * y) * dt) * e;
    this.v = (this.v - w * (this.v + w * y) * dt) * e;
    this.x = target + ny;
    return this.x;
  }
}

export type LookTarget = THREE.Vector3 | THREE.Object3D | 'player' | 'down' | 'ball';

// ------------------------------------------------------------------ shaders
const VERT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uHead;   // roll (rad), yaw, pitch
  uniform vec4 uBody;   // breath 0..1, rise px, sway px, hair swing px
  uniform vec4 uHandL;  // angle, dx, dy, flutter
  uniform vec4 uHandR;
  varying vec2 vUv;
  const vec2 IMG = vec2(${IW}.0, ${IH}.0);

  vec2 rot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }

  float handW(vec2 p, vec2 c) {
    return 1.0 - smoothstep(0.72, 1.12, length((p - c) / vec2(${HAND_R[0]}.0, ${HAND_R[1]}.0)));
  }

  vec2 flutter(vec2 p, vec2 tip, float amt, float i) {
    float w = 1.0 - smoothstep(8.0, 40.0, length(p - tip));
    return w * amt * 3.2 * vec2(sin(uTime * 7.3 + i * 1.7), cos(uTime * 6.1 + i * 2.3));
  }

  void main() {
    vUv = uv;
    vec2 p = vec2(uv.x * IMG.x, (1.0 - uv.y) * IMG.y);
    vec2 d = vec2(0.0);

    // hands: each pivots at its wrist and lifts/spreads as one soft region
    float wL = handW(p, vec2(${HAND_C[0][0]}.0, ${HAND_C[0][1]}.0));
    float wR = handW(p, vec2(${HAND_C[1][0]}.0, ${HAND_C[1][1]}.0));
    vec2 pvL = vec2(${HAND_PIVOT[0][0]}.0, ${HAND_PIVOT[0][1]}.0);
    vec2 pvR = vec2(${HAND_PIVOT[1][0]}.0, ${HAND_PIVOT[1][1]}.0);
    d += (rot(p - pvL, uHandL.x) + pvL + uHandL.yz - p) * wL;
    d += (rot(p - pvR, uHandR.x) + pvR + uHandR.yz - p) * wR;
    d += flutter(p, vec2(320.0, 600.0), uHandL.w, 0.0);
    d += flutter(p, vec2(370.0, 625.0), uHandL.w, 1.0);
    d += flutter(p, vec2(398.0, 688.0), uHandL.w, 2.0);
    d += flutter(p, vec2(458.0, 708.0), uHandL.w, 3.0);
    d += flutter(p, vec2(708.0, 600.0), uHandR.w, 4.0);
    d += flutter(p, vec2(664.0, 632.0), uHandR.w, 5.0);
    d += flutter(p, vec2(645.0, 692.0), uHandR.w, 6.0);
    d += flutter(p, vec2(560.0, 708.0), uHandR.w, 7.0);

    // head: roll about the neck, yaw/pitch as parallax of the face inside the hood
    float wHead = (1.0 - smoothstep(470.0, 660.0, p.y)) * (1.0 - smoothstep(260.0, 440.0, abs(p.x - 512.0)));
    vec2 hp = vec2(${HEAD_PIVOT[0]}.0, ${HEAD_PIVOT[1]}.0);
    d += (rot(p - hp, uHead.x) + hp - p) * wHead;
    float wFace = exp(-pow((p.x - 512.0) / 150.0, 2.0) - pow((p.y - 370.0) / 185.0, 2.0));
    d.x += uHead.y * (15.0 * wFace + 5.0 * wHead);
    d.y += uHead.z * (11.0 * wFace + 5.0 * wHead);

    // hair strands at the sides swing a little behind the head
    float side = abs(p.x - 512.0);
    float wHair = smoothstep(330.0, 560.0, p.y) * (1.0 - smoothstep(1000.0, 1150.0, p.y))
                * smoothstep(85.0, 160.0, side) * (1.0 - smoothstep(235.0, 300.0, side))
                * (1.0 - clamp(wL + wR, 0.0, 1.0));
    float hk = clamp((p.y - 330.0) / 650.0, 0.0, 1.0);
    d.x += wHair * hk * (uBody.w + 2.2 * sin(uTime * 1.15 + p.y * 0.011));

    // breathing lifts the upper body and widens the chest; the whole figure sways
    float wUp = 1.0 - smoothstep(650.0, 1250.0, p.y);
    d.y -= (uBody.x * 6.0 + uBody.y) * wUp;
    d.x += uBody.x * 3.5 * (p.x - 512.0) / 400.0 * smoothstep(520.0, 760.0, p.y) * (1.0 - smoothstep(900.0, 1250.0, p.y));
    float t = 1.0 - p.y / IMG.y;
    d.x += uBody.z * t * t;

    vec3 pos = position;
    pos.x += d.x * (${(WITCH_H * WITCH_ASPECT).toFixed(5)} / IMG.x);
    pos.y -= d.y * (${WITCH_H.toFixed(5)} / IMG.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uTint;
  uniform float uCast;
  uniform vec4 uBrow;   // up, sad, furrow, arch
  uniform vec4 uLid;    // lidL, lidR, wide, squint
  uniform vec4 uMouth;  // smile, jaw, round, -
  uniform vec2 uGaze;   // iris shift, px
  varying vec2 vUv;
  const vec2 IMG = vec2(${IW}.0, ${IH}.0);

  // Brows: returns a source offset (sampling lower makes a feature rise).
  vec2 brows(vec2 p) {
    vec2 off = vec2(0.0);
    float wy = smoothstep(198.0, 262.0, p.y) * (1.0 - smoothstep(272.0, 292.0, p.y));
    for (int i = 0; i < 2; i++) {
      float sgn = i == 0 ? -1.0 : 1.0;
      float cx = i == 0 ? 438.0 : 588.0;
      float inner = i == 0 ? 492.0 : 534.0;
      float wx = 1.0 - smoothstep(0.9, 1.35, abs(p.x - cx) / 64.0);
      float w = wx * wy;
      float ik = clamp(1.0 - abs(p.x - inner) / 85.0, 0.0, 1.0);
      float up = uBrow.x * 10.0 + uBrow.y * 10.0 * ik - uBrow.z * 5.0 + (i == 1 ? uBrow.w * 9.0 : 0.0);
      off.y += up * w;
      off.x += sgn * uBrow.z * 5.0 * ik * w;
    }
    return off;
  }

  // One eye. Corners, lid heights and the iris are in painting pixels.
  vec2 toUv(vec2 px) { return vec2(px.x / IMG.x, 1.0 - px.y / IMG.y); }

  // One eye, in painting pixels: corners, the thick eyeliner band (top + thickness),
  // the lower lid and the iris. Closing slides the eyeliner band down over the eye and
  // fills the lid above it with the lid-skin colour; lidA > 0 means "use lidCol".
  vec2 eye(vec2 p, vec2 cIn, vec2 cOut, float hu, float lb, float hl, vec2 iris, float ir, float lid,
           inout vec3 lidCol, inout float lidA) {
    vec2 mid = 0.5 * (cIn + cOut);
    float hw = 0.5 * length(cOut - cIn);
    vec2 dir = (cOut - cIn) / (2.0 * hw);
    vec2 nrm = vec2(-dir.y, dir.x);
    if (nrm.y < 0.0) nrm = -nrm;
    // wide: magnify the eye a little
    vec2 e = vec2(dot(p - mid, dir) / hw, dot(p - mid, nrm) / 24.0);
    float f = 1.0 - smoothstep(0.55, 1.7, length(e));
    vec2 q = mid + (p - mid) / (1.0 + uLid.z * 0.18 * f);
    float s = dot(q - mid, dir) / hw;
    if (abs(s) >= 1.0) return q;
    float n = dot(q - mid, nrm);
    float arc = pow(1.0 - s * s, 0.7);   // almond: pointed corners
    float top = -hu * arc;               // top of the eyeliner band
    float band = lb * arc + 1.5;         // its thickness
    float nl = hl * arc;                 // lower lid line
    float U = mix(top + band, max(top + band, nl + 2.5 * arc), lid);  // band bottom while closing
    if (lid > 0.001 && n >= top && n <= U) {
      if (n >= U - band) return q + nrm * (top + band - (U - n) - n);
      vec2 r = q + nrm * (top - 2.0 - n);
      vec3 c0 = texture2D(uMap, toUv(r - dir * 8.0)).rgb + texture2D(uMap, toUv(r - dir * 4.0)).rgb + texture2D(uMap, toUv(r)).rgb
              + texture2D(uMap, toUv(r + dir * 4.0)).rgb + texture2D(uMap, toUv(r + dir * 8.0)).rgb;
      float k = (n - top) / max(U - band - top, 0.001);
      lidCol = c0 / 5.0 * (1.0 - 0.25 * k * k);
      lidA = 1.0;
      return q;
    }
    // lower lid rises (smiling eyes, and a touch while closing)
    float sq = uLid.w * 4.5 + lid * 1.5;
    float wsq = smoothstep(nl - 9.0, nl - 1.0, n) * (1.0 - smoothstep(nl + 12.0, nl + 28.0, n)) * arc;
    q += nrm * sq * wsq;
    // iris follows the gaze, only between the lids
    float open = smoothstep(U - 1.0, U + 2.0, n) * (1.0 - smoothstep(nl - 3.0, nl - 0.5, n));
    float m = (1.0 - smoothstep(ir, ir + 10.0, length(q - iris))) * open;
    return q - uGaze * m;
  }

  // Mouth: corners move for smile/sad/O, the jaw drops to open it.
  vec2 mouth(vec2 p, out float cav, out float teeth) {
    cav = 0.0;
    teeth = 0.0;
    vec2 q = p;
    float sm = uMouth.x, rnd = uMouth.z;
    for (int i = 0; i < 2; i++) {
      vec2 c = i == 0 ? vec2(455.0, 435.0) : vec2(573.0, 433.0);
      float o = i == 0 ? -1.0 : 1.0;
      vec2 mv = vec2(o * (2.5 * max(sm, 0.0) + 1.5 * min(sm, 0.0) - 9.0 * rnd), -6.0 * sm);
      q -= mv * (1.0 - smoothstep(4.0, 34.0, length(p - c)));
    }
    // cheeks rise with a smile
    for (int i = 0; i < 2; i++) {
      vec2 c = i == 0 ? vec2(440.0, 380.0) : vec2(585.0, 380.0);
      q.y += 3.0 * max(sm, 0.0) * (1.0 - smoothstep(10.0, 48.0, length(p - c)));
    }
    float hw = 59.0 * (1.0 - 0.3 * rnd);
    float s = (q.x - 514.0) / hw;
    float base = mix(435.0, 433.0, clamp((q.x - 455.0) / 118.0, 0.0, 1.0));
    float Lm = base + 8.0 * max(0.0, 1.0 - s * s);
    float shape = pow(max(0.0, 1.0 - (s / 1.12) * (s / 1.12)), 0.75);
    float o = uMouth.y * 17.0 * (1.0 + 0.4 * rnd) * shape;
    if (o > 0.05 && q.y > Lm) {
      if (q.y < Lm + o) {
        cav = smoothstep(Lm, Lm + 1.2, q.y) * (1.0 - smoothstep(Lm + o - 1.2, Lm + o, q.y));
        teeth = (1.0 - smoothstep(Lm + 1.0, Lm + 2.6, q.y)) * (1.0 - smoothstep(0.15, 0.5, abs(s))) * smoothstep(5.0, 9.0, o) * (1.0 - rnd);
      } else {
        q.y -= o * (1.0 - smoothstep(Lm + o + 6.0, 615.0, q.y));
      }
    }
    return q;
  }

  void main() {
    vec2 p = vec2(vUv.x * IMG.x, (1.0 - vUv.y) * IMG.y);
    vec2 q = p;
    float cav = 0.0, teeth = 0.0, lidA = 0.0;
    vec3 lidCol = vec3(0.0);
    if (p.y > 180.0 && p.y < 640.0 && abs(p.x - 512.0) < 230.0) {
      q += brows(p);
      q = eye(q, vec2(480.0, 314.0), vec2(404.0, 301.0), 16.5, 7.5, 11.5, vec2(438.0, 306.0), 17.0, uLid.x, lidCol, lidA);
      q = eye(q, vec2(543.0, 316.0), vec2(629.0, 301.0), 17.5, 6.5, 9.5, vec2(583.0, 306.0), 17.0, uLid.y, lidCol, lidA);
      q = mouth(q, cav, teeth);
    }
    vec4 c = texture2D(uMap, toUv(q));
    if (c.a < 0.03) discard;
    vec3 col = lidA > 0.0 ? lidCol : c.rgb;
    if (cav > 0.0) {
      // colours are linear here (the painting is decoded from sRGB)
      vec3 inside = vec3(0.045, 0.012, 0.014);
      inside = mix(inside, vec3(0.5, 0.45, 0.42), teeth);
      col = mix(col, inside, cav);
    }
    col *= uTint;
    // violet magic light from the hands while casting
    float d = distance(p, vec2(${HANDS_PX[0]}.0, ${HANDS_PX[1]}.0)) / ${IW}.0;
    col += vec3(0.55, 0.35, 1.0) * uCast * 0.55 * (1.0 - smoothstep(0.0, 0.38, d)) * c.a;
    gl_FragColor = vec4(col, c.a);
    #include <colorspace_fragment>
  }
`;

// ------------------------------------------------------------------ the witch
export class Witch {
  readonly group = new THREE.Group();
  /** Inner group: leans and rises without touching the stage's placement. */
  readonly rig = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly mat: THREE.ShaderMaterial;
  private eyeMats: THREE.SpriteMaterial[] = [];
  private eyeSprites: THREE.Sprite[] = [];
  private handMat: THREE.SpriteMaterial;
  private hand: THREE.Sprite;
  cast = 0; // smoothed casting amount
  castTarget = 0;
  dim = 0;
  /** 0..1 suspense from the game (heartbeat): faster breath, trembling hands, leaning in. */
  tension = 0;
  /** True while the player is choosing: she fidgets, glances around and smiles on her own. */
  idle = false;
  readonly width = WITCH_H * WITCH_ASPECT;
  /** World points she glances at: [deck, crystal ball]. */
  readonly glance = { deck: new THREE.Vector3(0, 1.15, 0.2), ball: new THREE.Vector3(0.66, 1.0, 0.3) };

  private time = 0;
  private mood: Mood = 'calm';
  private baseMood: Mood = 'calm';
  private moodUntil = 0;
  private face = Object.fromEntries(FACE_KEYS.map((k) => [k, new Spring()])) as Record<keyof Face, Spring>;
  private sp = {
    roll: new Spring(), yaw: new Spring(), pitch: new Spring(), lean: new Spring(), rise: new Spring(),
    lift: new Spring(), spread: new Spring(), gx: new Spring(), gy: new Spring(), wink: new Spring(), hair: new Spring(),
  };
  private gestures: { fn: (k: number) => Partial<Off>; t: number; dur: number }[] = [];
  private look: LookTarget = 'player';
  private glanceAt: LookTarget | null = null;
  private glanceUntil = 0;
  private blinkT = 9;
  private nextBlink = 1.5;
  private talkUntil = 0;
  private syl = 0;
  private sylAmp = 0.6;
  private breathPhase = 0;
  private sacc = new THREE.Vector2();
  private nextSacc = 1;
  private idleNext = 4;
  private lastGaze = new THREE.Vector2();
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();
  private camPos = new THREE.Vector3(0, 1.5, 3);

  constructor() {
    const tex = new THREE.TextureLoader().load(witchUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const geo = new THREE.PlaneGeometry(this.width, WITCH_H, 68, 88);
    geo.translate(0, WITCH_H / 2, 0); // origin at the bottom edge
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uMap: { value: tex },
        uTime: { value: 0 },
        uTint: { value: new THREE.Color(1, 1, 1) },
        uCast: { value: 0 },
        uHead: { value: new THREE.Vector3() },
        uBody: { value: new THREE.Vector4() },
        uHandL: { value: new THREE.Vector4() },
        uHandR: { value: new THREE.Vector4() },
        uBrow: { value: new THREE.Vector4() },
        uLid: { value: new THREE.Vector4() },
        uMouth: { value: new THREE.Vector4() },
        uGaze: { value: new THREE.Vector2() },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.renderOrder = -5;
    this.group.add(this.rig);
    this.rig.add(this.mesh);

    const dot = dotTexture();
    for (let i = 0; i < 2; i++) {
      const m = new THREE.SpriteMaterial({ map: dot, color: 0x000000, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
      const s = new THREE.Sprite(m);
      s.scale.setScalar(0.06);
      this.rig.add(s);
      this.eyeMats.push(m);
      this.eyeSprites.push(s);
    }
    this.handMat = new THREE.SpriteMaterial({ map: dot, color: 0x000000, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    this.hand = new THREE.Sprite(this.handMat);
    this.hand.scale.setScalar(0.5);
    this.rig.add(this.hand);
  }

  // ---------------------------------------------------------------- controls
  /** Settle into a mood; with `sec`, return to the previous one afterwards. */
  setMood(m: Mood, sec = 0) {
    if (sec > 0) {
      this.mood = m;
      this.moodUntil = this.time + sec;
    } else {
      this.baseMood = m;
      if (this.moodUntil <= this.time) this.mood = m;
    }
  }

  gesture(name: GestureName, scale = 1) {
    const [dur, fn] = GESTURES[name];
    const f = scale === 1 ? fn : (k: number) => {
      const o = fn(k);
      for (const key of Object.keys(o) as (keyof Off)[]) o[key] = (o[key] ?? 0) * scale;
      return o;
    };
    this.gestures.push({ fn: f, t: 0, dur });
  }

  lookAt(t: LookTarget) {
    this.look = t;
    this.glanceAt = null;
  }

  /** Look somewhere briefly, then back. */
  glanceTo(t: LookTarget, sec: number) {
    this.glanceAt = t;
    this.glanceUntil = this.time + sec;
  }

  /** Move the mouth for `sec` seconds (the bubble's typing time). */
  talk(sec: number) {
    this.talkUntil = this.time + sec;
    if (Math.random() < 0.5) this.gesture('nod', 0.35);
  }

  blink() {
    if (this.blinkT > 0.3) this.blinkT = 0;
  }

  // ---------------------------------------------------------------- landmarks
  private deformPx(x: number, y: number): [number, number] {
    const u = this.mat.uniforms;
    const head = u.uHead.value as THREE.Vector3;
    const body = u.uBody.value as THREE.Vector4;
    let dx = 0;
    let dy = 0;
    const hands = [u.uHandL.value as THREE.Vector4, u.uHandR.value as THREE.Vector4];
    for (let i = 0; i < 2; i++) {
      const [cx, cy] = HAND_C[i];
      const w = 1 - sstep(0.72, 1.12, Math.hypot((x - cx) / HAND_R[0], (y - cy) / HAND_R[1]));
      if (w <= 0) continue;
      const [px, py] = HAND_PIVOT[i];
      const a = hands[i].x;
      const vx = x - px, vy = y - py;
      dx += (Math.cos(a) * vx - Math.sin(a) * vy + px + hands[i].y - x) * w;
      dy += (Math.sin(a) * vx + Math.cos(a) * vy + py + hands[i].z - y) * w;
    }
    const wHead = (1 - sstep(470, 660, y)) * (1 - sstep(260, 440, Math.abs(x - 512)));
    const [hx, hy] = HEAD_PIVOT;
    const vx = x - hx, vy = y - hy;
    dx += (Math.cos(head.x) * vx - Math.sin(head.x) * vy + hx - x) * wHead;
    dy += (Math.sin(head.x) * vx + Math.cos(head.x) * vy + hy - y) * wHead;
    const wFace = Math.exp(-(((x - 512) / 150) ** 2) - ((y - 370) / 185) ** 2);
    dx += head.y * (15 * wFace + 5 * wHead);
    dy += head.z * (11 * wFace + 5 * wHead);
    const wUp = 1 - sstep(650, 1250, y);
    dy -= (body.x * 6 + body.y) * wUp;
    const t = 1 - y / IH;
    dx += body.z * t * t;
    return [x + dx, y + dy];
  }

  /** Local (rig) position of a painting pixel after deformation. */
  private localPx(x: number, y: number, target: THREE.Vector3, z = 0.05) {
    const [qx, qy] = this.deformPx(x, y);
    return target.set((qx / IW - 0.5) * this.width, (1 - qy / IH) * WITCH_H, z);
  }

  /** World position of a point on the image (u from left, v from top). */
  pointAt(u: number, v: number, target = new THREE.Vector3()) {
    this.localPx(u * IW, v * IH, target);
    return this.rig.localToWorld(target);
  }

  handsWorld(target = new THREE.Vector3()) {
    return this.pointAt(HANDS_PX[0] / IW, HANDS_PX[1] / IH, target);
  }

  headWorld(target = new THREE.Vector3()) {
    return this.pointAt(HEAD_PX[0] / IW, HEAD_PX[1] / IH, target);
  }

  /** True if a ray hits her head or shoulders (for tapping her). */
  hit(raycaster: THREE.Raycaster) {
    const h = raycaster.intersectObject(this.mesh, false)[0];
    if (!h?.uv) return false;
    const x = h.uv.x * IW, y = (1 - h.uv.y) * IH;
    return Math.hypot((x - 512) / 230, (y - 360) / 330) < 1;
  }

  // ---------------------------------------------------------------- per frame
  private resolveLook(t: LookTarget, out: THREE.Vector3) {
    if (t === 'player') return out.copy(this.camPos);
    if (t === 'down') return out.copy(this.glance.deck);
    if (t === 'ball') return out.copy(this.glance.ball);
    if (t instanceof THREE.Object3D) return t.getWorldPosition(out);
    return out.copy(t);
  }

  update(dt: number, time: number, flicker: number, camera?: THREE.Camera) {
    this.time = time;
    if (camera) camera.getWorldPosition(this.camPos);
    this.cast += (this.castTarget - this.cast) * (1 - Math.exp(-dt * 4));
    if (this.moodUntil > 0 && time >= this.moodUntil) {
      this.moodUntil = 0;
      this.mood = this.baseMood;
    }

    // gestures add up
    const off = zeroOff();
    this.gestures = this.gestures.filter((g) => {
      g.t += dt;
      const o = g.fn(Math.min(1, g.t / g.dur));
      for (const k of OFF_KEYS) off[k] += o[k] ?? 0;
      return g.t < g.dur;
    });

    // idle life: little glances, smiles, head tilts, finger play
    if (this.idle) {
      this.idleNext -= dt;
      if (this.idleNext <= 0) {
        this.idleNext = 3.5 + Math.random() * 4;
        const r = Math.random();
        if (this.baseMood === 'sad') {
          // out of turns: no winks, just quiet sighs and downcast glances
          if (r < 0.5) this.glanceTo('down', 2);
          else this.gesture('sigh', 0.8);
        } else if (r < 0.22) this.glanceTo('down', 1.4 + Math.random());
        else if (r < 0.36) this.glanceTo('ball', 1.2);
        else if (r < 0.52) this.gesture('tilt');
        else if (r < 0.64) this.gesture('nod', 0.5);
        else if (r < 0.76) {
          this.castBoost = 1.6;
        } else if (r < 0.86) this.gesture('sigh', 0.7);
        else if (r < 0.93) this.setMood('sly', 1.6);
        else this.gesture('wink');
      }
    }
    this.castBoost = Math.max(0, this.castBoost - dt);
    const castAmt = Math.max(this.cast, this.castBoost > 0 ? 0.35 * Math.min(1, this.castBoost * 2) : 0);

    // where to look: head turns part of the way, eyes do the rest
    const look = this.glanceAt && time < this.glanceUntil ? this.glanceAt : this.look;
    const head = this.localPx(HEAD_PX[0], 330, this.tmpV2, 0);
    const tgt = this.rig.worldToLocal(this.resolveLook(look, this.tmpV)).sub(head);
    const yaw = Math.atan2(tgt.x, Math.max(0.05, tgt.z));
    const pitch = Math.atan2(-tgt.y, Math.hypot(tgt.x, tgt.z));
    if (look === 'player' && this.idle) {
      this.nextSacc -= dt;
      if (this.nextSacc <= 0) {
        this.nextSacc = 0.6 + Math.random() * 2.2;
        this.sacc.set((Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 1.2);
      }
    } else this.sacc.set(0, 0);
    const gxT = THREE.MathUtils.clamp(yaw / 0.42, -1, 1) * 7 + this.sacc.x;
    const gyT = THREE.MathUtils.clamp((pitch - 0.05) / 0.45, -1, 1) * 3.2 + this.sacc.y;
    // a big jump of the eyes often comes with a blink
    if (Math.hypot(gxT - this.lastGaze.x, gyT - this.lastGaze.y) > 5 && Math.random() < 0.5) this.blink();
    this.lastGaze.set(gxT, gyT);
    const gx = this.sp.gx.step(gxT, dt, 9);
    const gy = this.sp.gy.step(gyT, dt, 9);

    // blinking
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blink();
      this.nextBlink = Math.random() < 0.15 ? 0.25 : 2 + Math.random() * 4;
    }
    this.blinkT += dt;
    const bt = this.blinkT;
    const blinkLid = bt < 0.07 ? bt / 0.07 : bt < 0.11 ? 1 : bt < 0.24 ? 1 - (bt - 0.11) / 0.13 : 0;

    // talking
    let talkJaw = 0;
    if (time < this.talkUntil) {
      this.syl += dt * (5.2 + Math.sin(time * 1.7) * 1.2);
      if (this.syl >= 1) {
        this.syl -= 1;
        this.sylAmp = Math.random() < 0.15 ? 0.15 : 0.45 + Math.random() * 0.55;
      }
      talkJaw = this.sylAmp * 0.42 * Math.sin(Math.PI * this.syl);
      off.pitch += 0.06 * Math.sin(Math.PI * 2 * this.syl * 0.5);
    }

    // breathing: calm and slow, quick and shallow under tension
    const ten = this.tension;
    this.breathPhase += dt * Math.PI * 2 * (0.22 + ten * 0.32);
    const breath = (0.5 - 0.5 * Math.cos(this.breathPhase)) * (1 - ten * 0.35);

    // face channels
    const mf = MOODS[this.mood];
    const fs = this.face;
    const hz = 5;
    const lookDownLid = Math.max(0, gy / 3.2) * 0.25;
    const fBrowUp = fs.browUp.step(mf.browUp + off.browUp + (time < this.talkUntil ? 0.12 : 0), dt, hz);
    const fBrowSad = fs.browSad.step(mf.browSad, dt, hz);
    const fFurrow = fs.furrow.step(mf.furrow + ten * 0.2, dt, hz);
    const fArch = fs.arch.step(mf.arch + off.arch, dt, hz);
    const fLid = fs.lid.step(Math.min(0.85, mf.lid + off.lid + lookDownLid), dt, 6);
    const fWide = fs.wide.step(mf.wide + off.wide + ten * 0.35, dt, 6);
    const fSquint = fs.squint.step(mf.squint + off.squint, dt, hz);
    const fSmile = fs.smile.step(THREE.MathUtils.clamp(mf.smile + off.smile, -1, 1.2), dt, 4);
    const fJaw = fs.jaw.step(mf.jaw + off.jaw, dt, 6) + talkJaw;
    const fRound = fs.round.step(mf.round, dt, 5);
    const wink = this.sp.wink.step(off.wink, dt, 10);
    const lidL = Math.min(1, fLid + blinkLid * (1 - fLid));
    const lidR = Math.min(1, Math.max(lidL, wink));

    // head and body
    const idleRoll = 0.018 * Math.sin(time * 0.37) + 0.01 * Math.sin(time * 0.91 + 1.3);
    const roll = this.sp.roll.step(idleRoll + off.roll - THREE.MathUtils.clamp(yaw, -0.6, 0.6) * 0.04, dt, 2.2);
    const hYaw = this.sp.yaw.step(THREE.MathUtils.clamp(yaw * 1.3, -0.7, 0.7) + off.yaw, dt, 2.4);
    const hPitch = this.sp.pitch.step(THREE.MathUtils.clamp((pitch - 0.05) * 1.6, -0.4, 0.8) + off.pitch, dt, 2.6);
    const lean = this.sp.lean.step(off.lean + ten * 0.45, dt, 2.5);
    const rise = this.sp.rise.step(off.rise, dt, 4);
    const hair = this.sp.hair.step(-roll * 120 - hYaw * 4, dt, 1.2);

    // hands: casting lifts and opens them and the fingers play; tension makes them tremble
    const lift = this.sp.lift.step(off.lift + castAmt * 0.55 + ten * 0.25, dt, 3);
    const spread = this.sp.spread.step(off.spread + castAmt * 0.35, dt, 3);
    const swirl = castAmt * 6;
    const trem = ten * ten * 2.2;
    const jx = (Math.random() - 0.5) * trem, jy = (Math.random() - 0.5) * trem;
    const ang = spread * 0.09;
    const u = this.mat.uniforms;
    u.uTime.value = time;
    u.uCast.value = this.cast;
    (u.uHandL.value as THREE.Vector4).set(-ang, Math.sin(time * 2.3) * swirl + jx, -lift * 26 + Math.cos(time * 2.3) * swirl * 0.6 + jy, castAmt + ten * 0.4);
    (u.uHandR.value as THREE.Vector4).set(ang, -Math.sin(time * 2.3 + 0.8) * swirl - jx, -lift * 26 + Math.cos(time * 2.3 + 0.8) * swirl * 0.6 - jy, castAmt + ten * 0.4);
    (u.uHead.value as THREE.Vector3).set(roll, hYaw, hPitch);
    (u.uBody.value as THREE.Vector4).set(breath, rise, Math.sin(time * 0.55) * 9, hair);
    (u.uBrow.value as THREE.Vector4).set(fBrowUp, fBrowSad, fFurrow, fArch);
    (u.uLid.value as THREE.Vector4).set(lidL, lidR, fWide, fSquint);
    (u.uMouth.value as THREE.Vector4).set(fSmile, Math.max(0, fJaw), fRound, 0);
    (u.uGaze.value as THREE.Vector2).set(gx, gy);

    // leaning toward the player: a touch bigger and lower
    this.rig.position.set(0, -lean * 0.025, lean * 0.07);
    this.rig.scale.setScalar(1 + lean * 0.02);

    const b = (0.93 + flicker * 0.05) * (1 - this.dim * 0.55);
    (u.uTint.value as THREE.Color).setRGB(b * 1.02, b * 0.97, b * 1.0);
    const eye = this.cast * (0.7 + 0.3 * Math.sin(time * 6)) * (1 - Math.max(lidL, lidR) * 0.8);
    for (let i = 0; i < 2; i++) {
      this.eyeMats[i].color.setRGB(1.6 * eye, 0.9 * eye, 0.3 * eye);
      this.localPx(EYE_PX[i][0], EYE_PX[i][1], this.eyeSprites[i].position, 0.01);
    }
    const h = this.cast * (0.8 + 0.2 * Math.sin(time * 3.1));
    this.handMat.color.setRGB(0.9 * h, 0.55 * h, 1.6 * h);
    this.hand.scale.setScalar(0.42 + 0.06 * Math.sin(time * 2.3));
    this.localPx(HANDS_PX[0], HANDS_PX[1], this.hand.position, 0.05);
  }

  private castBoost = 0;
}
