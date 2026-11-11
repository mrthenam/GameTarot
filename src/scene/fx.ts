// Particle bursts, ambient motes, magic circle and light rays.
import * as THREE from 'three';
import { dotTexture, magicCircleTexture, raysTexture } from './textures';

const PARTICLE_VS = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  uniform float uScale;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uScale / -mv.z;
    vAlpha = aAlpha;
    vColor = aColor;
  }
`;
const PARTICLE_FS = /* glsl */ `
  uniform sampler2D uMap;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 t = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
  }
`;

export interface EmitOpts {
  color: THREE.Color | string;
  count: number;
  speed?: [number, number];
  life?: [number, number];
  size?: [number, number];
  gravity?: number;
  drag?: number;
  spread?: number; // spawn radius
  dir?: THREE.Vector3; // bias direction
  dirStrength?: number;
  intensity?: number; // color multiplier (HDR for bloom)
  swirl?: number;
}

export class Particles {
  readonly points: THREE.Points;
  private max: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private baseSize: Float32Array;
  private gravity: Float32Array;
  private drag: Float32Array;
  private swirl: Float32Array;
  private center: Float32Array;
  private cursor = 0;
  readonly uniforms: { uScale: { value: number }; uMap: { value: THREE.Texture } };

  constructor(max = 3000) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.baseSize = new Float32Array(max);
    this.gravity = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.swirl = new Float32Array(max);
    this.center = new Float32Array(max * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = { uScale: { value: 400 }, uMap: { value: dotTexture() } };
    const mat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VS,
      fragmentShader: PARTICLE_FS,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  emit(at: THREE.Vector3, o: EmitOpts) {
    const color = o.color instanceof THREE.Color ? o.color : new THREE.Color(o.color);
    const inten = o.intensity ?? 2;
    const [s0, s1] = o.speed ?? [0.3, 1.2];
    const [l0, l1] = o.life ?? [0.6, 1.4];
    const [z0, z1] = o.size ?? [0.02, 0.05];
    const spread = o.spread ?? 0.02;
    const v = new THREE.Vector3();
    for (let n = 0; n < o.count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      v.randomDirection();
      if (o.dir) v.lerp(o.dir, o.dirStrength ?? 0.5).normalize();
      const sp = s0 + Math.random() * (s1 - s0);
      const r = Math.random() * spread;
      this.pos[i * 3] = at.x + v.x * r;
      this.pos[i * 3 + 1] = at.y + v.y * r;
      this.pos[i * 3 + 2] = at.z + v.z * r;
      this.center[i * 3] = at.x;
      this.center[i * 3 + 1] = at.y;
      this.center[i * 3 + 2] = at.z;
      this.vel[i * 3] = v.x * sp;
      this.vel[i * 3 + 1] = v.y * sp;
      this.vel[i * 3 + 2] = v.z * sp;
      const tint = 0.75 + Math.random() * 0.5;
      this.col[i * 3] = color.r * inten * tint;
      this.col[i * 3 + 1] = color.g * inten * tint;
      this.col[i * 3 + 2] = color.b * inten * tint;
      this.life[i] = this.maxLife[i] = l0 + Math.random() * (l1 - l0);
      this.baseSize[i] = z0 + Math.random() * (z1 - z0);
      this.gravity[i] = o.gravity ?? 0;
      this.drag[i] = o.drag ?? 1.5;
      this.swirl[i] = o.swirl ?? 0;
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        if (this.alpha[i] !== 0) {
          this.alpha[i] = 0;
          this.size[i] = 0;
        }
        continue;
      }
      this.life[i] -= dt;
      const d = Math.exp(-this.drag[i] * dt);
      const i3 = i * 3;
      if (this.swirl[i] !== 0) {
        const dx = this.pos[i3] - this.center[i3];
        const dy = this.pos[i3 + 1] - this.center[i3 + 1];
        this.vel[i3] += -dy * this.swirl[i] * dt;
        this.vel[i3 + 1] += dx * this.swirl[i] * dt;
      }
      this.vel[i3] *= d;
      this.vel[i3 + 1] = this.vel[i3 + 1] * d - this.gravity[i] * dt;
      this.vel[i3 + 2] *= d;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.min(1, t * 2.5) * Math.min(1, (1 - t) * 8);
      this.size[i] = this.baseSize[i] * (0.4 + 0.6 * t);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aColor.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
  }
}

/** Slow drifting magical dust filling the room (GPU-animated). */
export function createMotes(count = 260): { points: THREE.Points; uniforms: { uTime: { value: number }; uScale: { value: number } } } {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const col = new Float32Array(count * 3);
  const palette = [new THREE.Color('#ffd27a'), new THREE.Color('#c39bff'), new THREE.Color('#8fd8ff')];
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 5;
    pos[i * 3 + 1] = Math.random() * 3.2;
    pos[i * 3 + 2] = -2.5 + Math.random() * 4.5;
    seed[i] = Math.random() * 100;
    const c = palette[i % 3];
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const uniforms = { uTime: { value: 0 }, uScale: { value: 400 }, uMap: { value: dotTexture() } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSeed;
      attribute vec3 aColor;
      uniform float uTime;
      uniform float uScale;
      varying float vA;
      varying vec3 vC;
      void main() {
        vec3 p = position;
        float t = uTime * 0.12 + aSeed;
        p.x += sin(t * 1.3 + aSeed) * 0.25;
        p.y = mod(p.y + uTime * 0.05 * (0.5 + fract(aSeed)) , 3.2);
        p.z += cos(t * 0.9) * 0.2;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 0.5 + 0.5 * sin(uTime * (1.0 + fract(aSeed * 7.0) * 2.0) + aSeed * 3.0);
        gl_PointSize = (0.012 + 0.02 * fract(aSeed * 3.1)) * uScale / -mv.z;
        vA = tw * smoothstep(0.0, 0.4, p.y) * (1.0 - smoothstep(2.6, 3.2, p.y));
        vC = aColor;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      varying float vA;
      varying vec3 vC;
      void main() {
        vec4 t = texture2D(uMap, gl_PointCoord);
        gl_FragColor = vec4(vC * 1.6, t.a * vA * 0.8);
      }
    `,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, uniforms };
}

function additivePlane(tex: THREE.Texture, size: number): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({
      map: tex,
      color: 0x000000,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  m.renderOrder = -2;
  m.visible = false;
  return m;
}

export function createMagicCircle(size = 1.4) {
  return additivePlane(magicCircleTexture(), size);
}

export function createRays(size = 1.8) {
  return additivePlane(raysTexture(), size);
}
