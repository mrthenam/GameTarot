// The fortune-teller: a painted billboard that breathes, sways and glows when casting.
import * as THREE from 'three';
import witchUrl from '../assets/img/witch.webp?url';
import { dotTexture } from './textures';

export const WITCH_H = 1.62;
const WITCH_ASPECT = 1020 / 1300;

// Feature positions in the cropped witch image (u from left, v from top).
const EYES: [number, number][] = [[0.448, 0.228], [0.586, 0.228]];
const HANDS: [number, number] = [0.496, 0.56];

export class Witch {
  readonly group = new THREE.Group();
  readonly mat: THREE.ShaderMaterial;
  private eyeMats: THREE.SpriteMaterial[] = [];
  private handMat: THREE.SpriteMaterial;
  private hand: THREE.Sprite;
  cast = 0; // smoothed casting amount
  castTarget = 0;
  dim = 0;
  readonly width = WITCH_H * WITCH_ASPECT;

  constructor() {
    const tex = new THREE.TextureLoader().load(witchUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const geo = new THREE.PlaneGeometry(this.width, WITCH_H, 8, 16);
    geo.translate(0, WITCH_H / 2, 0); // origin at the bottom edge
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uMap: { value: tex },
        uTime: { value: 0 },
        uTint: { value: new THREE.Color(1, 1, 1) },
        uCast: { value: 0 },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          float h = uv.y;
          p.y *= 1.0 + 0.007 * sin(uTime * 1.35) * h;           // breathing
          p.x += sin(uTime * 0.55) * 0.012 * h * h;              // sway
          p.x *= 1.0 + 0.004 * sin(uTime * 1.35 + 0.6) * (1.0 - h);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform vec3 uTint;
        uniform float uCast;
        varying vec2 vUv;
        void main() {
          vec4 c = texture2D(uMap, vUv);
          if (c.a < 0.03) discard;
          vec3 col = c.rgb * uTint;
          // violet magic light from the hands while casting
          float d = distance(vUv, vec2(${HANDS[0].toFixed(3)}, ${(1 - HANDS[1]).toFixed(3)}));
          col += vec3(0.55, 0.35, 1.0) * uCast * 0.55 * (1.0 - smoothstep(0.0, 0.38, d)) * c.a;
          gl_FragColor = vec4(col, c.a);
          #include <colorspace_fragment>
        }
      `,
    });
    const mesh = new THREE.Mesh(geo, this.mat);
    mesh.renderOrder = -5;
    this.group.add(mesh);

    const dot = dotTexture();
    for (const [u, v] of EYES) {
      const m = new THREE.SpriteMaterial({ map: dot, color: 0x000000, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
      const s = new THREE.Sprite(m);
      s.scale.setScalar(0.06);
      s.position.set((u - 0.5) * this.width, (1 - v) * WITCH_H, 0.01);
      this.group.add(s);
      this.eyeMats.push(m);
    }
    this.handMat = new THREE.SpriteMaterial({ map: dot, color: 0x000000, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    this.hand = new THREE.Sprite(this.handMat);
    this.hand.scale.setScalar(0.5);
    this.hand.position.set((HANDS[0] - 0.5) * this.width, (1 - HANDS[1]) * WITCH_H, 0.05);
    this.group.add(this.hand);
  }

  /** World position of a point on the image (u from left, v from top). */
  pointAt(u: number, v: number, target = new THREE.Vector3()) {
    target.set((u - 0.5) * this.width, (1 - v) * WITCH_H, 0.05);
    return this.group.localToWorld(target);
  }

  handsWorld(target = new THREE.Vector3()) {
    return this.pointAt(HANDS[0], HANDS[1], target);
  }

  headWorld(target = new THREE.Vector3()) {
    return this.pointAt(0.52, 0.2, target);
  }

  update(dt: number, time: number, flicker: number) {
    this.cast += (this.castTarget - this.cast) * (1 - Math.exp(-dt * 4));
    const u = this.mat.uniforms;
    u.uTime.value = time;
    u.uCast.value = this.cast;
    const b = (0.93 + flicker * 0.05) * (1 - this.dim * 0.55);
    (u.uTint.value as THREE.Color).setRGB(b * 1.02, b * 0.97, b * 1.0);
    const eye = this.cast * (0.7 + 0.3 * Math.sin(time * 6));
    for (const m of this.eyeMats) m.color.setRGB(1.6 * eye, 0.9 * eye, 0.3 * eye);
    const h = this.cast * (0.8 + 0.2 * Math.sin(time * 3.1));
    this.handMat.color.setRGB(0.9 * h, 0.55 * h, 1.6 * h);
    this.hand.scale.setScalar(0.42 + 0.06 * Math.sin(time * 2.3));
  }
}
