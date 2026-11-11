import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/600-italic.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import './style.css';
import { clock } from './core/time';
import { loadConfig } from './game/config';
import { GameState } from './game/state';
import { Stage } from './scene/stage';
import { Deck } from './scene/deck';
import { initCardAssets, frontTexture } from './scene/cards';
import { AudioEngine } from './audio/audio';
import { UI } from './ui/ui';
import { Game } from './game/game';

declare global {
  interface Window {
    __ready?: boolean;
    __step?: (n?: number) => Promise<void>;
    __game?: Game;
    __gl?: string;
  }
}

async function boot() {
  const params = new URLSearchParams(location.search);
  const capture = params.has('capture');
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const cfg = await loadConfig();
  document.title = cfg.gameTitle;
  const state = new GameState(cfg);
  await Promise.all([
    document.fonts.load('700 44px "Cormorant Garamond"', 'ĐỊNH MỆNH'),
    document.fonts.load('italic 500 24px "Cormorant Garamond"', 'The Fool'),
    document.fonts.load('600 20px "Cormorant Garamond"', 'Ả'),
  ]).catch(() => {});
  await initCardAssets();

  const stage = new Stage(canvas, capture);
  const audio = new AudioEngine();
  const deck = new Deck(stage, audio);
  const ui = new UI(document.getElementById('ui')!, cfg, state, audio);
  const game = new Game(stage, deck, ui, audio, state, cfg);
  game.bindInput(canvas);
  ui.setIntroTurns(state.turns);
  ui.onEnter(() => void game.enter());

  const resize = () => {
    stage.resize();
    if (game.phase !== 'intro' && game.phase !== 'entering') stage.settleCamera();
  };
  window.addEventListener('resize', resize);
  resize();

  const gl = stage.renderer.getContext();
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  window.__gl = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'unknown';

  const tick = (dt: number) => {
    clock.update(dt);
    deck.update(dt, clock.time);
    stage.update(dt, clock.time);
    stage.render();
  };

  if (capture) {
    // Fixed 1/30 s steps driven by the capture script.
    window.__step = async (n = 1) => {
      for (let i = 0; i < n; i++) {
        tick(1 / 30);
        await new Promise((r) => setTimeout(r, 0)); // let tween continuations run
      }
    };
    tick(1 / 30);
  } else {
    let last = performance.now();
    stage.renderer.setAnimationLoop((now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      tick(dt);
    });
  }
  window.__game = game;

  // Warm the card faces in the background so reveals never wait.
  window.setTimeout(() => {
    for (let i = 0; i < 22; i++) void frontTexture(i);
  }, 1500);
  window.__ready = true;
}

boot().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#fff;position:fixed;inset:20px;white-space:pre-wrap">${String(e?.stack || e)}</pre>`);
});
