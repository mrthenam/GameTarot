// Dev-only page (witchlab.html): the witch alone, close up, for tuning the puppet rig.
// window.__w is the Witch; window.__ov maps uniform names to values forced after update().
// ?zoom=face|body  ?still (freeze time)
import * as THREE from 'three';
import { Witch, WITCH_H } from './scene/witch';

declare global {
  interface Window {
    __w?: Witch;
    __ov?: Record<string, number[]>;
    __t?: number;
  }
}

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#2a2238');
const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
const w = new Witch();
scene.add(w.group);
window.__w = w;
window.__ov = {};

const zoom = params.get('zoom') ?? 'face';
const frame = () => {
  const a = innerWidth / innerHeight;
  renderer.setSize(innerWidth, innerHeight);
  cam.aspect = a;
  // face: eyes..chin fills the view; body: whole painting
  const [cy, h] = zoom === 'body' ? [WITCH_H / 2, WITCH_H * 1.05] : [WITCH_H * 0.7, WITCH_H * 0.36];
  const dist = h / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  cam.position.set(0, cy, dist);
  cam.lookAt(0, cy, 0);
  cam.updateProjectionMatrix();
};
addEventListener('resize', frame);
frame();

let t = 0;
let last = performance.now();
const still = params.has('still');
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!still) t += dt;
  if (window.__t !== undefined) t = window.__t;
  w.update(still ? 0.016 : dt, t, 0, cam);
  const u = w.mat.uniforms as Record<string, { value: unknown }>;
  for (const [k, v] of Object.entries(window.__ov ?? {})) {
    const val = u[k]?.value as { set?: (...n: number[]) => void } | undefined;
    if (val && typeof val.set === 'function') val.set(...v);
    else if (u[k]) u[k].value = v[0];
  }
  renderer.render(scene, cam);
});
