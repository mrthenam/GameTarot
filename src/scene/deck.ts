// The floating fan of face-down cards: layout, hover, shuffle/deal animation.
import * as THREE from 'three';
import { CardMesh } from './cards';
import { clock, ease, lerp } from '../core/time';
import type { Stage } from './stage';
import type { AudioEngine } from '../audio/audio';

export const FAN_COUNT: number = 11;
const PIVOT = new THREE.Vector3(0, 0.5, 0.2);
const RADIUS = 0.74;
const SPREAD = THREE.MathUtils.degToRad(38);
const TILT_X = -0.08;

export class Deck {
  readonly cards: CardMesh[] = [];
  readonly root = new THREE.Group();
  private stage: Stage;
  private audio: AudioEngine;
  interactive = false;
  hovered: CardMesh | null = null;

  constructor(stage: Stage, audio: AudioEngine) {
    this.stage = stage;
    this.audio = audio;
    for (let i = 0; i < FAN_COUNT; i++) {
      const c = new CardMesh(i);
      c.group.visible = false;
      this.cards.push(c);
      this.root.add(c.group);
    }
    stage.scene.add(this.root);
  }

  /** Resting transform of fan slot i. */
  home(i: number, pos = new THREE.Vector3(), rot = new THREE.Euler()) {
    const t = FAN_COUNT === 1 ? 0.5 : i / (FAN_COUNT - 1);
    const a = lerp(-SPREAD, SPREAD, t);
    pos.set(PIVOT.x + Math.sin(a) * RADIUS, PIVOT.y + Math.cos(a) * RADIUS, PIVOT.z + i * 0.006);
    rot.set(TILT_X, 0, -a);
    return { pos, rot, angle: a };
  }

  hitTargets(): THREE.Object3D[] {
    return this.cards.filter((c) => c.group.visible && !c.controlled).map((c) => c.hit);
  }

  setHovered(card: CardMesh | null) {
    if (card === this.hovered) return;
    if (card && this.interactive) this.audio.hover(card.index);
    this.hovered = card;
    for (const c of this.cards) c.hoverTarget = c === card && this.interactive ? 1 : 0;
  }

  update(dt: number, time: number) {
    const p = new THREE.Vector3();
    const r = new THREE.Euler();
    for (const c of this.cards) {
      c.updateLook(dt, time);
      if (c.controlled || !c.group.visible) continue;
      const { angle } = this.home(c.index, p, r);
      const h = c.hover;
      p.x += Math.sin(angle) * 0.085 * h;
      p.y += Math.cos(angle) * 0.085 * h + Math.sin(time * 1.3 + c.index * 0.7) * 0.008;
      p.z += 0.07 * h;
      c.group.position.copy(p);
      c.group.rotation.set(r.x, r.y + Math.sin(time * 0.9 + c.index) * 0.04, r.z * (1 - h * 0.35));
      c.group.scale.setScalar(1 + 0.1 * h);
    }
  }

  /**
   * Gather → swirl → deal. `from` (e.g. the witch's hands) makes cards spawn out of it.
   */
  async shuffle(from?: THREE.Vector3) {
    this.interactive = false;
    this.setHovered(null);
    const center = new THREE.Vector3(0, 1.18, 0.25);
    const start = this.cards.map((c) => ({
      pos: c.group.visible ? c.group.position.clone() : (from ?? center).clone(),
      rot: c.group.rotation.clone(),
      scale: c.group.visible ? c.group.scale.x : 0.02,
    }));
    for (const c of this.cards) {
      c.controlled = true;
      c.group.visible = true;
      c.dimTarget = 0;
      c.glowBase = 0.25;
      c.inner.rotation.set(0, 0, 0);
      c.inner.position.set(0, 0, 0);
      for (const s of c.seals) s.visible = false;
    }
    this.audio.shuffle();
    // 1. gather
    await clock.tween(0.45, (k) => {
      this.cards.forEach((c, i) => {
        const s = start[i];
        c.group.position.lerpVectors(s.pos, center, k);
        c.group.position.z += i * 0.004 * k;
        c.group.rotation.set(lerp(s.rot.x, 0, k), lerp(s.rot.y, 0, k), lerp(s.rot.z, 0, k));
        c.group.scale.setScalar(lerp(s.scale, 1, k));
      });
    }, ease.inOutCubic);
    // 2. swirl around the center
    const phases = this.cards.map((_, i) => (i / FAN_COUNT) * Math.PI * 2);
    await clock.tween(1.05, (k, raw) => {
      const rad = Math.sin(raw * Math.PI) * 0.5;
      const spin = raw * Math.PI * 2.4;
      this.cards.forEach((c, i) => {
        const a = phases[i] + spin;
        c.group.position.set(center.x + Math.cos(a) * rad, center.y + Math.sin(a) * rad * 0.55, center.z + Math.sin(a) * 0.18 * Math.sin(raw * Math.PI));
        c.group.rotation.set(0, Math.sin(a) * 0.5 * Math.sin(raw * Math.PI), Math.cos(a) * 0.4 * Math.sin(raw * Math.PI));
        c.glowBase = 0.25 + Math.sin(raw * Math.PI) * 0.6;
      });
      if (Math.random() < 0.3) this.stage.particles.emit(center, { color: '#c9a8ff', count: 2, speed: [0.1, 0.4], size: [0.015, 0.03], spread: 0.4, life: [0.5, 1] });
      void k;
    }, ease.inOutSine);
    // 3. deal out to the fan, staggered
    const deals = this.cards.map((c, i) =>
      clock.wait(i * 0.055).then(() => {
        const sp = c.group.position.clone();
        const sr = c.group.rotation.clone();
        const { pos, rot } = this.home(i);
        this.audio.deal(i);
        return clock.tween(0.5, (k) => {
          c.group.position.lerpVectors(sp, pos, k);
          c.group.rotation.set(lerp(sr.x, rot.x, k), lerp(sr.y, rot.y, k), lerp(sr.z, rot.z, k));
        }, ease.outBack).then(() => {
          c.controlled = false;
          c.glowBase = 0.12;
        });
      }),
    );
    await Promise.all(deals);
    this.interactive = true;
  }

  dimOthers(except: CardMesh | null, amount: number) {
    for (const c of this.cards) if (c !== except) c.dimTarget = amount;
  }
}
