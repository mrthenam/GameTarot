// Game flow: entrance → shuffle → pick → three seals → flip → gift → result → again.
import * as THREE from 'three';
import { clock, ease, lerp, pick } from '../core/time';
import { RARITY, type GameConfig } from './config';
import type { DrawResult, GameState } from './state';
import { Stage, INTRO_CAM } from '../scene/stage';
import { Deck } from '../scene/deck';
import { CARD_H, CARD_W, type CardMesh } from '../scene/cards';
import { createMagicCircle, createRays } from '../scene/fx';
import { iconUrl, fmtCountdown, type UI } from '../ui/ui';
import type { AudioEngine } from '../audio/audio';
import { dotTexture } from '../scene/textures';

type Phase = 'intro' | 'entering' | 'busy' | 'idle' | 'seals' | 'result';

const TIER_COLORS = ['#8fd8ff', '#b98cff', '#ff6fb5', '#ffcf5a'].map((c) => new THREE.Color(c));
const SEAL_NEUTRAL = new THREE.Color('#e9e2ff');

const LINES = {
  welcome: ['Chào mừng lữ khách đến với căn phòng của ta... Hãy chọn một lá bài, định mệnh sẽ lên tiếng.'],
  idle: ['Lá bài nào đang gọi tên bạn?', 'Đừng ngần ngại... hãy nghe theo trực giác.', 'Ta cảm nhận được điều đặc biệt hôm nay...', 'Các vì sao đang chờ bạn lựa chọn.'],
  pick: ['Lá bài này đã chọn bạn...', 'Một lựa chọn thú vị...', 'Ồ... trực giác của bạn thật nhạy bén.'],
  seals: ['Hãy phá bỏ ba tầng phong ấn!'],
  upgrade: ['', 'Ồ...? Năng lượng đang thay đổi!', 'Không thể nào... ánh sáng này!', 'CÁC VÌ SAO ĐANG RUNG CHUYỂN!'],
  reveal: [
    ['Vũ trụ gửi lời nhắn đến bạn.', 'Hãy lắng nghe thông điệp này.'],
    ['Một điềm lành hiếm có!', 'Định mệnh đang mỉm cười với bạn.'],
    ['Thật phi thường! Định mệnh ưu ái bạn!'],
    ['Huyền thoại! Ta chưa từng thấy lá bài nào sáng đến thế!'],
  ],
  shuffle: ['Để ta xáo lại các vì sao...', 'Bộ bài đang thì thầm...'],
  noTurns: ['Năng lượng của bạn đã cạn... hãy quay lại khi trăng lên nhé.'],
  pity: ['Năng lượng vũ trụ đã đầy... lá này chắc chắn không tầm thường!'],
};

/** Colour (tier) shown after each of the three seals breaks. */
function sealPlan(T: number): number[] {
  const r = Math.random() < 0.5;
  return [[0, 0, 0], r ? [0, 0, 1] : [0, 1, 1], r ? [0, 1, 2] : [1, 1, 2], r ? [0, 1, 3] : [1, 2, 3]][T];
}

export class Game {
  phase: Phase = 'intro';
  private stage: Stage;
  private deck: Deck;
  private ui: UI;
  private audio: AudioEngine;
  private state: GameState;
  private cfg: GameConfig;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private magic = createMagicCircle(1.5);
  private rays = createRays(2.0);
  private gift: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private giftGlow: THREE.Sprite;
  private tapResolve: (() => void) | null = null;
  private idleTimer = 0;
  private heartbeatRate = 0;
  private heartbeatT = 0;
  private trail: CardMesh | null = null;
  private iconTextures = new Map<string, THREE.Texture>();
  private tmp = new THREE.Vector3();

  constructor(stage: Stage, deck: Deck, ui: UI, audio: AudioEngine, state: GameState, cfg: GameConfig) {
    this.stage = stage;
    this.deck = deck;
    this.ui = ui;
    this.audio = audio;
    this.state = state;
    this.cfg = cfg;
    stage.fxRoot.add(this.magic, this.rays);
    this.gift = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, depthTest: false }),
    );
    this.gift.renderOrder = 20;
    this.giftGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, color: 0x000000 }));
    this.giftGlow.renderOrder = 19;
    this.gift.visible = this.giftGlow.visible = false;
    stage.scene.add(this.giftGlow, this.gift);
    clock.onFrame((dt, t) => this.frame(dt, t));
  }

  // ------------------------------------------------------------ input
  bindInput(canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') this.hoverAt(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointerup', (e) => this.tapAt(e.clientX, e.clientY, e.pointerType));
    window.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && this.phase === 'seals') this.tap();
    });
  }

  private cardAt(x: number, y: number): CardMesh | null {
    this.pointer.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.stage.camera);
    const hits = this.raycaster.intersectObjects(this.deck.hitTargets(), false);
    return hits.length ? (hits[0].object.userData.card as CardMesh) : null;
  }

  private hoverAt(x: number, y: number) {
    if (this.phase !== 'idle') return;
    const c = this.cardAt(x, y);
    this.deck.setHovered(c);
    document.body.style.cursor = c ? 'pointer' : '';
  }

  private tapAt(x: number, y: number, type: string) {
    if (this.phase === 'seals') {
      this.tap();
      return;
    }
    if (this.phase !== 'idle') return;
    const c = this.cardAt(x, y);
    if (!c) return;
    if (type !== 'mouse' && this.deck.hovered !== c) {
      this.deck.setHovered(c); // first tap on touch lifts the card
      return;
    }
    void this.pickCard(c);
  }

  /** Break the next seal (also called by the capture script). */
  tap() {
    const r = this.tapResolve;
    this.tapResolve = null;
    r?.();
  }

  private waitTap(): Promise<void> {
    return new Promise((r) => (this.tapResolve = r));
  }

  // ------------------------------------------------------------ per frame
  private frame(dt: number, t: number) {
    // Witch speech bubble follows her head on screen.
    const head = this.stage.witch.headWorld(this.tmp).project(this.stage.camera);
    this.ui.placeBubble((head.x * 0.5 + 0.5) * window.innerWidth, (-head.y * 0.5 + 0.5) * window.innerHeight);

    if (this.magic.visible) this.magic.rotation.z += dt * 0.25;
    if (this.rays.visible) this.rays.rotation.z -= dt * 0.15;

    if (this.heartbeatRate > 0) {
      this.heartbeatT -= dt;
      if (this.heartbeatT <= 0) {
        this.audio.heartbeat(Math.min(1, 0.5 + this.heartbeatRate * 0.25));
        this.heartbeatT = 1.05 / this.heartbeatRate;
      }
    }
    if (this.trail) {
      this.trail.group.getWorldPosition(this.tmp);
      this.stage.particles.emit(this.tmp, { color: '#d8c2ff', count: 3, speed: [0.05, 0.25], size: [0.012, 0.03], spread: 0.12, life: [0.4, 0.9] });
    }
    if (this.gift.visible) {
      this.gift.quaternion.copy(this.stage.camera.quaternion);
      this.gift.rotateZ(Math.sin(t * 1.6) * 0.06);
    }

    if (this.phase === 'idle') {
      this.idleTimer += dt;
      if (this.idleTimer > 14 && this.state.turns > 0) {
        this.idleTimer = 0;
        void this.ui.say(pick(LINES.idle), 2.6);
      }
      if (this.state.turns <= 0) {
        this.ui.hint(`Hết lượt hôm nay · lượt mới sau <b>${fmtCountdown(this.state.msUntilReset())}</b>`);
        if (this.state.refreshDay()) this.enterIdle();
      }
    }
  }

  // ------------------------------------------------------------ flow
  async enter() {
    if (this.phase !== 'intro') return;
    this.phase = 'entering';
    this.audio.init();
    this.audio.startMusic();
    this.audio.door();
    void this.ui.hideIntro();
    const s = this.stage;
    const lookFrom = s.lookTarget.clone();
    // doors swing open, light floods out, camera glides through the doorway
    void clock.tween(1.8, (k) => s.setDoorOpen(k), ease.inOutCubic, 0.15);
    await clock.tween(3.2, (k) => {
      s.camBase.lerpVectors(INTRO_CAM, s.playCam(), k);
      s.lookTarget.lerpVectors(lookFrom, s.playTarget(), ease.inOutSine(Math.min(1, k * 1.2)));
    }, ease.inOutCubic, 0.5);
    s.door.visible = false;
    this.ui.showHud();
    this.ui.setTurns(this.state.turns);
    this.stage.witch.castTarget = 1;
    void this.ui.say(LINES.welcome[0], 3.4);
    await clock.wait(0.5);
    const hands = this.stage.witch.handsWorld();
    this.stage.particles.emit(hands, { color: '#c9a8ff', count: 120, speed: [0.3, 1.2], size: [0.015, 0.04], spread: 0.1, life: [0.6, 1.4] });
    await this.deck.shuffle(hands);
    this.stage.witch.castTarget = 0;
    this.enterIdle();
  }

  private enterIdle() {
    this.phase = 'idle';
    this.idleTimer = 0;
    this.ui.refreshCounters();
    this.ui.setTurns(this.state.turns);
    if (this.state.turns > 0) {
      this.deck.interactive = true;
      this.deck.dimOthers(null, 0);
      this.ui.hint(this.state.pityReady ? '✦ Năng lượng đầy — lá tiếp theo chắc chắn <b>Hiếm</b> trở lên ✦' : 'Hãy chọn một lá bài');
    } else {
      this.deck.interactive = false;
      this.deck.dimOthers(null, 0.6);
      void this.ui.say(LINES.noTurns[0], 4);
    }
  }

  /** Reveal-card placement: left of the result panel (landscape) or above it (portrait). */
  private revealPose() {
    const portrait = this.stage.aspect < 1;
    const dist = 1.2;
    const vh = this.stage.viewHeight(dist);
    const vw = vh * this.stage.aspect;
    let h = portrait ? vh * 0.33 : vh * 0.6;
    h = Math.min(h, (vw * (portrait ? 0.6 : 0.42)) * (CARD_H / CARD_W));
    const pos = this.stage.viewPoint(portrait ? 0 : -0.36, portrait ? 0.38 : 0.03, dist);
    return { pos, scale: h / CARD_H, quat: this.stage.camera.quaternion.clone() };
  }

  async pickCard(card: CardMesh) {
    if (this.phase !== 'idle') return;
    if (this.state.turns <= 0) {
      void this.ui.say(LINES.noTurns[0], 3);
      return;
    }
    const result = this.state.draw();
    if (!result) return;
    this.phase = 'busy';
    document.body.style.cursor = '';
    this.deck.interactive = false;
    this.deck.setHovered(null);
    this.ui.hint(null);
    // Don't spoil a bonus turn before the reveal.
    this.ui.setTurns(this.state.turns - result.prize.extraTurns);
    await this.reveal(card, result);
  }

  private async reveal(card: CardMesh, r: DrawResult) {
    const s = this.stage;
    const T = RARITY[r.prize.rarity].tier;
    const plan = sealPlan(T);
    const facePromise = card.setFace(r.card.id);

    // 1 ─ the card leaves the fan and floats up to the player
    card.controlled = true;
    card.hoverTarget = 0;
    this.deck.dimOthers(card, 1);
    this.audio.pick();
    this.audio.duck(0.6);
    s.witch.castTarget = 1;
    void this.ui.say(r.pityTriggered ? LINES.pity[0] : pick(LINES.pick), 2.4);
    void clock.tween(1.2, (k) => (s.roomDim = k * 0.6), ease.inOutSine);
    const pose = this.revealPose();
    const p0 = card.group.position.clone();
    const q0 = card.group.quaternion.clone();
    const s0 = card.group.scale.x;
    this.trail = card;
    card.glowColor.copy(SEAL_NEUTRAL);
    await clock.tween(1.15, (k) => {
      card.group.position.lerpVectors(p0, pose.pos, k);
      card.group.position.y += Math.sin(k * Math.PI) * 0.18;
      card.group.quaternion.slerpQuaternions(q0, pose.quat, k);
      card.group.rotateZ(k * Math.PI * 2);
      card.group.scale.setScalar(lerp(s0, pose.scale, k));
      card.glowBase = 0.3 + k * 0.4;
    }, ease.inOutCubic);
    this.trail = null;
    card.group.quaternion.copy(pose.quat);

    // magic circle behind the card
    this.magic.visible = true;
    this.magic.position.copy(pose.pos).addScaledVector(this.forward(), 0.35);
    this.magic.quaternion.copy(pose.quat);
    this.magic.scale.setScalar(pose.scale * 0.44);
    const magicColor = SEAL_NEUTRAL.clone();
    let magicLevel = 0.35;
    const setMagic = () => this.magic.material.color.copy(magicColor).multiplyScalar(magicLevel);
    void clock.tween(0.8, (k) => { magicLevel = 0.35 * k; setMagic(); }, ease.outCubic);

    // 2 ─ the three seals appear
    card.seals.forEach((m, i) => {
      m.visible = true;
      m.scale.setScalar(0.01);
      card.sealMats[i].opacity = 1;
    });
    const sealCol = SEAL_NEUTRAL.clone();
    let sealInt = 0.85;
    const paintSeals = () => card.sealMats.forEach((m) => m.color.copy(sealCol).multiplyScalar(sealInt));
    paintSeals();
    const spin = clock.onFrame((dt) => {
      card.seals.forEach((m, i) => (m.rotation.z += dt * (i === 1 ? -0.6 : 0.9) * (1 + this.heartbeatRate * 0.4)));
    });
    this.audio.sealBreak(0, 0);
    await clock.tween(0.55, (k) => card.seals.forEach((m, i) => m.scale.setScalar(Math.max(0.01, ease.outBack(Math.min(1, k * 1.3 - i * 0.15))))), ease.linear);
    this.phase = 'seals';
    this.heartbeatRate = 1;
    this.heartbeatT = 0;
    void this.ui.say(LINES.seals[0], 2.4);

    // 3 ─ player breaks them one by one
    let shown = -1;
    for (let k = 0; k < 3; k++) {
      this.ui.hint(`Chạm để phá phong ấn · <b>${3 - k}</b>`, true);
      await this.waitTap();
      this.ui.hint(null);
      const L = plan[k];
      const upgrade = L > shown && k > 0 && L > plan[k - 1];
      // last seal on a big upgrade: the colour wavers before locking in
      if (k === 2 && upgrade && T >= 2) {
        this.phase = 'busy';
        this.audio.riser(0.9);
        await clock.tween(0.9, (q, raw) => {
          const f = Math.floor(raw * 14) % 2 === 0;
          sealCol.copy(TIER_COLORS[f ? plan[1] : L]);
          paintSeals();
          card.inner.position.set((Math.random() - 0.5) * 0.01 * raw, (Math.random() - 0.5) * 0.01 * raw, 0);
          void q;
        }, ease.linear);
        card.inner.position.set(0, 0, 0);
      }
      shown = L;
      this.breakSeal(card, k, L, upgrade);
      sealCol.copy(TIER_COLORS[L]);
      sealInt = 1.1 + k * 0.35;
      paintSeals();
      magicColor.copy(TIER_COLORS[L]);
      magicLevel = 0.45 + k * 0.25;
      setMagic();
      card.glowColor.copy(TIER_COLORS[L]);
      card.glowBase = 0.8 + k * 0.5 + (upgrade ? 0.4 : 0);
      this.heartbeatRate = 1.3 + k * 0.5;
      if (upgrade) void this.ui.say(LINES.upgrade[L], 1.8);
      if (k < 2) {
        this.phase = 'busy';
        await clock.wait(0.35);
        this.phase = 'seals';
      }
    }
    this.phase = 'busy';
    spin();
    await facePromise;

    // 4 ─ the card trembles as the power builds…
    this.audio.riser(1.25);
    this.audio.duck(1, 0.4);
    void clock.tween(1.25, (k) => (s.roomDim = 0.6 + k * 0.3), ease.inQuad);
    await clock.tween(1.25, (k) => {
      const a = k * k;
      card.inner.position.set((Math.random() - 0.5) * 0.012 * a, (Math.random() - 0.5) * 0.012 * a, 0);
      card.inner.rotation.z = (Math.random() - 0.5) * 0.05 * a;
      card.glowBase = 2 + a * 3;
      magicLevel = 0.95 + a * 0.8;
      setMagic();
      this.heartbeatRate = 2.5 + a * 2.5;
      if (Math.random() < 0.7) {
        const ang = Math.random() * Math.PI * 2;
        const from = this.tmp.set(Math.cos(ang) * 0.5, Math.sin(ang) * 0.5, 0).applyQuaternion(pose.quat).add(pose.pos);
        const dir = pose.pos.clone().sub(from).normalize();
        s.particles.emit(from, { color: TIER_COLORS[T], count: 2, speed: [0.8, 1.2], size: [0.012, 0.03], dir, dirStrength: 0.95, life: [0.4, 0.5], drag: 0.5 });
      }
    }, ease.linear);
    card.inner.position.set(0, 0, 0);
    card.inner.rotation.z = 0;
    this.heartbeatRate = 0;

    // 5 ─ FLIP
    this.audio.flip(T);
    s.shake = 1 + T * 0.3;
    card.seals.forEach((m) => (m.visible = false));
    const flashCol = TIER_COLORS[T].clone().lerp(new THREE.Color(1, 1, 1), 0.55);
    (s.grade.uniforms.uFlashColor.value as THREE.Color).copy(flashCol);
    void clock.tween(0.6, (k) => ((s.grade.uniforms.uFlash as { value: number }).value = (1 - k) * (0.3 + T * 0.06)), ease.outCubic, 0.12);
    s.particles.emit(pose.pos, { color: TIER_COLORS[T], count: 220 + T * 120, speed: [0.6, 2.6 + T * 0.4], size: [0.015, 0.05], spread: 0.08, life: [0.8, 1.8 + T * 0.3], drag: 1.6, gravity: 0.15 });
    s.particles.emit(pose.pos, { color: '#ffffff', count: 60, speed: [0.3, 1.2], size: [0.01, 0.025], spread: 0.1, life: [0.5, 1.0] });
    this.rays.visible = true;
    this.rays.position.copy(pose.pos).addScaledVector(this.forward(), 0.3);
    this.rays.quaternion.copy(pose.quat);
    const raysColor = TIER_COLORS[T].clone();
    void clock.tween(0.9, (k) => {
      this.rays.scale.setScalar(pose.scale * (0.45 + k * (0.45 + T * 0.12)));
      this.rays.material.color.copy(raysColor).multiplyScalar(lerp(2.0, 0.16 + T * 0.06, k));
    }, ease.outCubic);
    void clock.tween(0.9, (k) => { magicLevel = lerp(1.4, 0.16, k); setMagic(); }, ease.outCubic);
    await clock.tween(0.6, (k) => {
      card.inner.rotation.y = k * Math.PI;
      card.group.scale.setScalar(pose.scale * (1 + Math.sin(k * Math.PI) * 0.12));
      card.glowBase = lerp(5, 0.45 + T * 0.2, k);
    }, ease.inOutCubic);
    void this.ui.say(pick(LINES.reveal[T]), 3);
    this.audio.duck(0.35, 1.5);
    void clock.tween(1.2, (k) => (s.roomDim = lerp(0.9, 0.62, k)), ease.inOutSine);
    s.witch.castTarget = 0.4;

    // 6 ─ the gift rises from behind the card
    await clock.wait(0.45);
    await this.showGift(card, r, pose.scale);

    // 7 ─ reading + gift panel
    this.phase = 'result';
    const turnsAfter = this.state.turns;
    if (r.prize.extraTurns > 0) {
      void clock.wait(1.2).then(() => {
        this.ui.setTurns(turnsAfter, true);
        this.audio.upgrade(0);
      });
    }
    this.ui.refreshCounters();
    this.ui.hush();
    await this.ui.showResult(r, turnsAfter);
    await this.clearReveal(card);
    this.enterIdleAfterShuffle();
  }

  private forward() {
    return this.stage.camera.getWorldDirection(new THREE.Vector3());
  }

  private breakSeal(card: CardMesh, k: number, L: number, upgrade: boolean) {
    const s = this.stage;
    const seal = card.seals[k];
    const mat = card.sealMats[k];
    const startScale = seal.scale.x;
    this.audio.sealBreak(k, L);
    if (upgrade) this.audio.upgrade(L);
    void clock.tween(0.45, (q) => {
      seal.scale.setScalar(startScale * (1 + q * 0.9));
      mat.opacity = 1 - q;
    }, ease.outCubic).then(() => (seal.visible = false));
    s.shake = 0.5 + k * 0.3 + (upgrade ? 0.5 : 0);
    const at = card.group.getWorldPosition(new THREE.Vector3());
    s.particles.emit(at, { color: TIER_COLORS[L], count: 70 + k * 30 + (upgrade ? 90 : 0), speed: [0.4, 1.6 + k * 0.4], size: [0.012, 0.04], spread: 0.15, life: [0.5, 1.2] });
    (s.grade.uniforms.uFlashColor.value as THREE.Color).copy(TIER_COLORS[L]);
    const peak = upgrade ? 0.16 : 0.05;
    void clock.tween(0.35, (q) => ((s.grade.uniforms.uFlash as { value: number }).value = (1 - q) * peak), ease.outCubic);
    void clock.tween(0.3, (q, raw) => {
      card.inner.position.set((Math.random() - 0.5) * 0.02 * (1 - raw), (Math.random() - 0.5) * 0.02 * (1 - raw), 0);
      void q;
    }, ease.linear).then(() => card.inner.position.set(0, 0, 0));
  }

  private iconTexture(name: string): THREE.Texture {
    let t = this.iconTextures.get(name);
    if (!t) {
      t = new THREE.TextureLoader().load(iconUrl(name));
      t.colorSpace = THREE.SRGBColorSpace;
      this.iconTextures.set(name, t);
    }
    return t;
  }

  private async showGift(card: CardMesh, r: DrawResult, scale: number) {
    const T = RARITY[r.prize.rarity].tier;
    const g = this.gift;
    g.material.map = this.iconTexture(r.prize.icon);
    g.material.needsUpdate = true;
    g.material.opacity = 1;
    const local0 = new THREE.Vector3(0, 0.02, -0.02);
    const local1 = new THREE.Vector3(CARD_W * 0.36, CARD_H * 0.38, 0.06);
    const size = CARD_W * 0.48 * scale;
    g.visible = this.giftGlow.visible = true;
    this.audio.gift();
    const wp = new THREE.Vector3();
    await clock.tween(0.9, (k) => {
      wp.lerpVectors(local0, local1, k);
      wp.y += Math.sin(k * Math.PI) * CARD_H * 0.25;
      card.group.localToWorld(wp);
      g.position.copy(wp);
      g.scale.setScalar(size * (0.3 + 0.7 * k));
      this.giftGlow.position.copy(wp);
      this.giftGlow.scale.setScalar(size * 1.9 * k);
      this.giftGlow.material.color.copy(TIER_COLORS[T]).multiplyScalar(1.2 * k);
    }, ease.outBack);
    this.stage.particles.emit(g.position, { color: TIER_COLORS[T], count: 80, speed: [0.3, 1.1], size: [0.01, 0.03], spread: 0.05, life: [0.5, 1.1] });
  }

  private async clearReveal(card: CardMesh) {
    const s = this.stage;
    void this.ui.hideResult();
    this.ui.hush();
    const p0 = card.group.position.clone();
    const sc0 = card.group.scale.x;
    const gp = this.gift.position.clone();
    const gs = this.gift.scale.x;
    const rs = this.rays.scale.x;
    const raysCol = this.rays.material.color.clone();
    const glowCol = this.giftGlow.material.color.clone();
    this.audio.whoosh();
    await clock.tween(0.7, (k) => {
      card.group.position.copy(p0).addScaledVector(this.forward(), -k * 0.8);
      card.group.position.y += k * 0.3;
      card.group.scale.setScalar(sc0 * Math.max(0.01, 1 - k));
      card.group.rotateZ(0.12);
      this.gift.position.lerpVectors(gp, p0, k);
      this.gift.scale.setScalar(gs * Math.max(0.01, 1 - k));
      this.giftGlow.material.color.copy(glowCol).multiplyScalar(1 - k);
      this.rays.scale.setScalar(rs * (1 - k * 0.5));
      this.rays.material.color.copy(raysCol).multiplyScalar(1 - k);
      this.magic.material.color.multiplyScalar(0.9);
      s.roomDim = lerp(0.62, 0, k);
    }, ease.inCubic);
    this.stage.particles.emit(card.group.getWorldPosition(new THREE.Vector3()), { color: '#d8c2ff', count: 60, speed: [0.2, 0.8], size: [0.01, 0.03], spread: 0.1, life: [0.5, 1] });
    this.gift.visible = this.giftGlow.visible = this.rays.visible = this.magic.visible = false;
    card.group.visible = false;
    card.inner.rotation.set(0, 0, 0);
    card.glowBase = 0;
    card.clearFace();
    this.audio.duck(0);
    s.witch.castTarget = 0;
    s.roomDim = 0;
  }

  private async enterIdleAfterShuffle() {
    this.phase = 'busy';
    if (this.state.turns > 0) {
      void this.ui.say(pick(LINES.shuffle), 2);
      this.stage.witch.castTarget = 1;
      await this.deck.shuffle(this.stage.witch.handsWorld());
      this.stage.witch.castTarget = 0;
    } else {
      // keep the fan, but out of reach
      await this.deck.shuffle(this.stage.witch.handsWorld());
    }
    this.enterIdle();
  }

  /** For capture/automation: pick fan card i. */
  pickIndex(i: number) {
    const c = this.deck.cards[i];
    if (c) {
      this.deck.setHovered(c);
      void this.pickCard(c);
    }
  }

  get debugCfg() {
    return this.cfg;
  }
}
