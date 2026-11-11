// Renderer, camera, post-processing and the static room: backdrop, table, candles,
// crystal ball, the witch and the entrance doors.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import roomUrl from '../assets/img/room.webp?url';
import doorUrl from '../assets/img/door.webp?url';
import { Witch } from './witch';
import { clothSideTexture, flameTexture, stoneTexture, tableTopTexture } from './textures';
import { Particles, createMotes } from './fx';

export const PLAY_CAM = new THREE.Vector3(0, 1.42, 3.0);
export const PLAY_TARGET = new THREE.Vector3(0, 1.2, 0);
const DOOR_Z = 3.7;
export const INTRO_CAM = new THREE.Vector3(0, 1.45, 8.2);

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.35 },
    uDark: { value: 0 },
    uTime: { value: 0 },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(1, 1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uDark;
    uniform float uTime;
    uniform float uFlash;
    uniform vec3 uFlashColor;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      float r = length(d * vec2(1.15, 1.0));
      float vig = 1.0 - smoothstep(0.2, 0.85, r);
      c.rgb *= mix(1.0, vig, uVignette + uDark * 0.55);
      c.rgb += (hash(vUv * 900.0 + uTime) - 0.5) * 0.012;
      c.rgb = mix(c.rgb, uFlashColor * 2.5, uFlash);
      gl_FragColor = vec4(max(c.rgb, 0.0), 1.0);
    }
  `,
};

interface Candle {
  flame: THREE.Sprite;
  light: THREE.PointLight;
  base: number;
  seed: number;
  s: number;
}

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;
  readonly grade: ShaderPass;
  readonly witch = new Witch();
  readonly particles = new Particles(3500);
  readonly fxRoot = new THREE.Group();
  private motes = createMotes();
  private backdrop: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private tableMats: THREE.MeshPhysicalMaterial[] = [];
  private candles: Candle[] = [];
  private ball: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private ambient: THREE.HemisphereLight;
  readonly door = new THREE.Group();
  readonly doorLeaves: THREE.Group[] = [];
  readonly camTarget = PLAY_TARGET.clone();
  readonly camBase = INTRO_CAM.clone();
  readonly lookTarget = new THREE.Vector3(0, 1.5, DOOR_Z);
  shake = 0;
  roomDim = 0; // 0..1 darken the room around the reveal
  flicker = 0;
  private parallax = new THREE.Vector2();
  private parallaxTarget = new THREE.Vector2();
  aspect = 1;

  constructor(canvas: HTMLCanvasElement, capture: boolean) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: capture });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.05, 60);
    this.camera.position.copy(INTRO_CAM);

    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.75, 0.55, 0.86);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());

    this.scene.background = new THREE.Color('#07040d');
    this.ambient = new THREE.HemisphereLight(0x9a86ff, 0x1a0c22, 0.9);
    this.scene.add(this.ambient);
    const key = new THREE.DirectionalLight(0xc8b4ff, 0.9);
    key.position.set(-1, 3, 2);
    this.scene.add(key);

    // Backdrop painting
    const bt = new THREE.TextureLoader().load(roomUrl);
    bt.colorSpace = THREE.SRGBColorSpace;
    this.backdrop = new THREE.Mesh(new THREE.PlaneGeometry(1, 1143 / 2048), new THREE.MeshBasicMaterial({ map: bt }));
    this.backdrop.position.set(0, 1.3, -3.4);
    this.backdrop.renderOrder = -10;
    this.scene.add(this.backdrop);

    this.buildTable();
    this.buildCandles();
    this.ball = this.buildCrystalBall();

    this.witch.group.position.set(0, 0.7, -1.25);
    this.scene.add(this.witch.group);

    this.scene.add(this.motes.points);
    this.scene.add(this.particles.points);
    this.scene.add(this.fxRoot);
    this.buildDoor();

    window.addEventListener('pointermove', (e) => {
      this.parallaxTarget.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    });
  }

  private buildTable() {
    const topTex = tableTopTexture();
    const top = new THREE.MeshPhysicalMaterial({
      map: topTex, roughness: 0.85, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color('#b48cff'),
    });
    const sideTex = clothSideTexture();
    sideTex.repeat.set(3, 1);
    const side = new THREE.MeshPhysicalMaterial({
      map: sideTex, roughness: 0.9, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color('#9a6cff'), side: THREE.DoubleSide,
    });
    this.tableMats.push(top, side);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.15, 96), top);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(0, 0.84, -0.35);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.32, 0.84, 96, 1, true), side);
    skirt.position.set(0, 0.42, -0.35);
    this.scene.add(disc, skirt);
  }

  private buildCandles() {
    const ft = flameTexture();
    const wax = new THREE.MeshStandardMaterial({ color: 0xf2e6cf, roughness: 0.6, emissive: 0x3a2410 });
    const holder = new THREE.MeshStandardMaterial({ color: 0xb98a3c, metalness: 0.85, roughness: 0.3 });
    const spots: [number, number, number, number][] = [
      [-0.88, 0.0, 0.26, 1], [-0.74, 0.12, 0.17, 0], [-1.0, -0.15, 0.12, 0],
      [0.92, -0.55, 0.3, 1], [0.78, -0.72, 0.2, 0], [1.02, -0.32, 0.14, 0],
    ];
    for (const [x, z, h, light] of spots) {
      const g = new THREE.Group();
      g.position.set(x, 0.84, z);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.02, 20), holder);
      base.position.y = 0.01;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, h, 16), wax);
      body.position.y = 0.02 + h / 2;
      const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: ft, color: new THREE.Color(2.2, 1.6, 1.0), blending: THREE.AdditiveBlending, depthWrite: false }));
      flame.scale.set(0.05, 0.1, 1);
      flame.position.y = 0.02 + h + 0.04;
      g.add(base, body, flame);
      const pl = new THREE.PointLight(0xffa04a, light ? 1.6 : 0.0, 4, 2);
      pl.position.y = 0.02 + h + 0.08;
      if (light) g.add(pl);
      this.scene.add(g);
      this.candles.push({ flame, light: pl, base: light ? 1.6 : 0, seed: Math.random() * 100, s: 1 });
    }
  }

  private buildCrystalBall() {
    const stand = new THREE.Group();
    stand.position.set(0.66, 0.84, 0.3);
    const gold = new THREE.MeshStandardMaterial({ color: 0xc69a45, metalness: 0.9, roughness: 0.3 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.016, 12, 40), gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.03;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.035, 24), gold);
    foot.position.y = 0.017;
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.115, 48, 32),
      new THREE.ShaderMaterial({
        transparent: true,
        uniforms: { uTime: { value: 0 }, uPulse: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vV; varying vec3 vP;
          void main() {
            vP = position;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vN = normalize(normalMatrix * normal);
            vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime; uniform float uPulse;
          varying vec3 vN; varying vec3 vV; varying vec3 vP;
          float n3(vec3 p) { return sin(p.x * 3.1 + sin(p.y * 2.3)) * sin(p.y * 2.7 + sin(p.z * 3.7)) * sin(p.z * 2.9 + sin(p.x * 1.9)); }
          void main() {
            float fres = pow(clamp(1.0 - dot(normalize(vN), normalize(vV)), 0.0, 1.0), 2.2);
            vec3 p = vP * 14.0;
            float a = uTime * 0.6;
            p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
            float neb = n3(p) * 0.5 + 0.5;
            neb = neb * neb * neb;
            vec3 col = mix(vec3(0.12, 0.04, 0.3), vec3(0.75, 0.45, 1.4), neb);
            col += vec3(1.2, 0.9, 1.6) * fres * 0.9;
            col *= 0.8 + uPulse * 1.2;
            gl_FragColor = vec4(col, 0.55 + fres * 0.45);
          }
        `,
      }),
    );
    ball.position.y = 0.155;
    stand.add(ring, foot, ball);
    this.scene.add(stand);
    return ball;
  }

  private buildDoor() {
    const tex = new THREE.TextureLoader().load(doorUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    const H = 3.0, W = H * (848 / 1264);
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * W / 2, 0, DOOR_Z);
      const geo = new THREE.PlaneGeometry(W / 2, H);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, side < 0 ? uv.getX(i) * 0.5 : 0.5 + uv.getX(i) * 0.5);
      const leaf = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
      leaf.position.set(-side * W / 4, H / 2, 0);
      pivot.add(leaf);
      this.door.add(pivot);
      this.doorLeaves.push(pivot);
    }
    const st = stoneTexture();
    st.repeat.set(4, 3);
    const wallMat = new THREE.MeshBasicMaterial({ map: st, color: 0x8a7a9a });
    const wallW = 8;
    for (const side of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(wallW, 8), wallMat);
      w.position.set(side * (W / 2 + wallW / 2), 2, DOOR_Z + 0.001);
      this.door.add(w);
    }
    const floorTex = stoneTexture();
    floorTex.repeat.set(6, 4);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: floorTex, color: 0x4a3f58 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, DOOR_Z + 4);
    this.door.add(floor);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.02, 5), wallMat);
    top.position.set(0, H + 2.5, DOOR_Z + 0.001);
    this.door.add(top);
    // door frame trim
    const trim = new THREE.MeshStandardMaterial({ color: 0x8a6428, metalness: 0.8, roughness: 0.4, emissive: 0x221505 });
    const mk = (w: number, h: number, x: number, y: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), trim);
      m.position.set(x, y, DOOR_Z + 0.03);
      this.door.add(m);
    };
    mk(0.08, H + 0.08, -W / 2 - 0.04, H / 2);
    mk(0.08, H + 0.08, W / 2 + 0.04, H / 2);
    mk(W + 0.16, 0.08, 0, H + 0.04);
    // two torches beside the door
    const ft = flameTexture();
    for (const side of [-1, 1]) {
      const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: ft, color: new THREE.Color(2.4, 1.6, 0.9), blending: THREE.AdditiveBlending, depthWrite: false }));
      f.scale.set(0.16, 0.32, 1);
      f.position.set(side * (W / 2 + 0.55), 2.05, DOOR_Z + 0.12);
      const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.3, 12), trim);
      bracket.position.set(side * (W / 2 + 0.55), 1.82, DOOR_Z + 0.1);
      this.door.add(f, bracket);
      this.candles.push({ flame: f, light: new THREE.PointLight(), base: 0, seed: Math.random() * 100, s: 3.2 });
    }
    this.scene.add(this.door);
  }

  setDoorOpen(p: number) {
    // p 0..1, leaves swing away from the camera
    this.doorLeaves[0].rotation.y = p * 1.75;
    this.doorLeaves[1].rotation.y = -p * 1.75;
  }

  /** Camera-space → world point, for placing things relative to the view. */
  viewPoint(ndcX: number, ndcY: number, dist: number, target = new THREE.Vector3()) {
    const cam = this.camera;
    const h = 2 * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const w = h * cam.aspect;
    target.set((ndcX * w) / 2, (ndcY * h) / 2, -dist);
    return target.applyMatrix4(cam.matrixWorld);
  }

  viewHeight(dist: number) {
    return 2 * dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.aspect = w / h;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);
    const cam = this.camera;
    cam.aspect = this.aspect;
    // Keep the card fan (≈1.45 m wide at 2.8 m) inside the view on narrow screens.
    const needHalfW = 0.8;
    const hfovNeeded = 2 * Math.atan(needHalfW / 2.8);
    const vfovForWidth = 2 * Math.atan(Math.tan(hfovNeeded / 2) / this.aspect);
    cam.fov = Math.max(40, THREE.MathUtils.radToDeg(vfovForWidth));
    cam.updateProjectionMatrix();
    // Backdrop must cover the view (plus parallax margin) at its distance.
    const dist = PLAY_CAM.z - this.backdrop.position.z;
    const vh = 2 * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * 1.18;
    const vw = vh * this.aspect;
    const s = Math.max(vh / (1143 / 2048), vw);
    this.backdrop.scale.set(s, s, 1);
    // Moon sits ~33% from the top of the painting: line it up behind the witch's head.
    this.backdrop.position.y = 2.3 - 0.17 * s * (1143 / 2048);
    const pr = this.renderer.getPixelRatio();
    this.particles.uniforms.uScale.value = h * pr * 0.5 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    this.motes.uniforms.uScale.value = this.particles.uniforms.uScale.value;
  }

  /** Portrait screens look a little higher: more moonlit window, less empty tablecloth. */
  playTarget() {
    return PLAY_TARGET.clone().add(new THREE.Vector3(0, this.aspect < 1 ? 0.32 : 0, 0));
  }
  playCam() {
    return PLAY_CAM.clone().add(new THREE.Vector3(0, this.aspect < 1 ? 0.12 : 0, 0));
  }

  /** Re-aim after a resize/rotation once the player is in the room. */
  settleCamera() {
    this.camBase.copy(this.playCam());
    this.lookTarget.copy(this.playTarget());
  }

  update(dt: number, time: number) {
    // Candle flicker
    let fl = 0;
    for (const c of this.candles) {
      const n = Math.sin(time * 9.1 + c.seed) * 0.5 + Math.sin(time * 15.3 + c.seed * 2) * 0.3 + Math.sin(time * 3.7 + c.seed) * 0.2;
      c.flame.scale.set((0.05 + n * 0.004) * c.s, (0.1 + n * 0.012) * c.s, 1);
      if (c.base) {
        c.light.intensity = c.base * (1 + n * 0.18) * (1 - this.roomDim * 0.5);
        fl += n;
      }
    }
    this.flicker = fl / 2;
    this.witch.dim = this.roomDim;
    this.witch.update(dt, time, this.flicker);
    const bd = 1 - this.roomDim * 0.62;
    this.backdrop.material.color.setScalar(bd * (0.97 + this.flicker * 0.02));
    for (const m of this.tableMats) m.color.setScalar(1 - this.roomDim * 0.5);
    this.ambient.intensity = 0.9 * (1 - this.roomDim * 0.5);
    this.ball.material.uniforms.uTime.value = time;
    this.ball.material.uniforms.uPulse.value = 0.3 + 0.2 * Math.sin(time * 1.7);
    this.motes.uniforms.uTime.value = time;
    this.particles.update(dt);

    // Camera: base position + parallax + shake
    this.parallax.lerp(this.parallaxTarget, 1 - Math.exp(-dt * 2));
    const cam = this.camera;
    cam.position.copy(this.camBase);
    cam.position.x += this.parallax.x * 0.06;
    cam.position.y += -this.parallax.y * 0.03;
    if (this.shake > 0.001) {
      cam.position.x += (Math.sin(time * 61) + Math.sin(time * 37)) * 0.5 * this.shake * 0.02;
      cam.position.y += (Math.sin(time * 53) + Math.sin(time * 29)) * 0.5 * this.shake * 0.02;
      this.shake *= Math.exp(-dt * 6);
    }
    cam.lookAt(this.lookTarget);
    cam.updateMatrixWorld();
    (this.grade.uniforms.uTime as { value: number }).value = time % 100;
  }

  render() {
    this.composer.render();
  }
}
