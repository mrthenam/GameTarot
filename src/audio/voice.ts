// The witch's recorded voice (public/voice, made by `npm run voice`).
// Lines are looked up by their exact text: a line whose wording changed since it was recorded
// simply plays silent (the mouth falls back to the procedural flap) instead of saying the old words.
import type { AudioEngine } from './audio';
import { clock } from '../core/time';

interface Entry { id: string; d: number }
interface Clip { buf: AudioBuffer; env: Float32Array }
interface Playing { src: AudioBufferSourceNode; clip: Clip; t0Ctx: number; t0Clock: number }

const BASE = `${import.meta.env.BASE_URL}voice/`;
const ENV_HZ = 100;

/** Loudness envelope of a line (ENV_HZ frames, 0..1 scaled to the line's own loud syllables). */
function envelope(buf: AudioBuffer): Float32Array {
  const d = buf.getChannelData(0);
  const hop = Math.round(buf.sampleRate / ENV_HZ);
  const win = hop * 2;
  const n = Math.ceil(d.length / hop);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0, c = 0;
    for (let j = i * hop - win / 2; j < i * hop + win / 2; j++) {
      if (j < 0 || j >= d.length) continue;
      sum += d[j] * d[j];
      c++;
    }
    env[i] = c ? Math.sqrt(sum / c) : 0;
  }
  const sorted = Float32Array.from(env).sort();
  const loud = sorted[Math.floor(sorted.length * 0.9)] || 1;
  for (let i = 0; i < n; i++) env[i] = Math.min(1, Math.max(0, (env[i] / loud - 0.12) / 0.88));
  return env;
}

export class Voice {
  private audio: AudioEngine;
  private capture: boolean;
  private byText = new Map<string, Entry>();
  private raw = new Map<string, Promise<ArrayBuffer | null>>();
  private clips = new Map<string, Clip>();
  private decoding = new Map<string, Promise<Clip | null>>();
  private playing: Playing[] = [];
  /** Loudness of what she is saying right now, 0..1 (drives her jaw). */
  level = 0;
  /** Lines started, in game-clock time: the capture script lays the audio under its video with this. */
  readonly log: { id: string; t: number }[] = [];

  /** `capture`: frames are stepped by the capture script, so follow the game clock, not the sound card. */
  constructor(audio: AudioEngine, capture = false) {
    this.audio = audio;
    this.capture = capture;
  }

  async load() {
    try {
      const r = await fetch(`${BASE}manifest.json`, { cache: 'no-cache' });
      if (!r.ok) return;
      const m = (await r.json()) as Record<string, { d: number; t: string }>;
      for (const [id, e] of Object.entries(m)) if (e && e.t) this.byText.set(e.t, { id, d: e.d });
    } catch {
      /* no voice pack: the witch talks silently */
    }
  }

  /** Start downloading (and, once audio is unlocked, decoding) lines that are about to be needed. */
  preload(...texts: string[]) {
    for (const t of texts) {
      const e = this.byText.get(t);
      if (!e) continue;
      if (!this.raw.has(e.id)) {
        this.raw.set(e.id, fetch(`${BASE}${e.id}.mp3?v=${e.d}`).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null));
      }
      if (this.audio.ctx) void this.decode(e.id);
    }
  }

  private decode(id: string): Promise<Clip | null> {
    const ctx = this.audio.ctx;
    if (!ctx) return Promise.resolve(null);
    let p = this.decoding.get(id);
    if (!p) {
      p = (this.raw.get(id) ?? Promise.resolve(null)).then(async (ab) => {
        if (!ab) return null;
        try {
          // decodeAudioData detaches its input: hand it a copy
          const buf = await ctx.decodeAudioData(ab.slice(0));
          const clip = { buf, env: envelope(buf) };
          this.clips.set(id, clip);
          return clip;
        } catch {
          return null;
        }
      });
      this.decoding.set(id, p);
    }
    return p;
  }

  /** Wait (up to `timeout` s) for a line to be playable; false if it has no recording. */
  async whenReady(text: string, timeout = 1.5): Promise<boolean> {
    const e = this.byText.get(text);
    if (!e || !this.audio.ctx) return false;
    if (this.clips.has(e.id)) return true;
    this.preload(text);
    const p = this.decode(e.id).then((c) => !!c);
    return Promise.race([p, new Promise<boolean>((r) => setTimeout(() => r(false), timeout * 1000))]);
  }

  /**
   * Speak a line. Cuts off whatever she was saying, unless `queue` is set: then it starts once the
   * current line ends. Returns when it starts and how long it lasts (s from now), or null if silent.
   */
  play(text: string, queue = false): { delay: number; dur: number } | null {
    const ctx = this.audio.ctx;
    const e = this.byText.get(text);
    if (!ctx || !e) return null;
    const clip = this.clips.get(e.id);
    if (!clip) {
      this.preload(text);
      return null;
    }
    const last = this.playing[this.playing.length - 1];
    const lastEnd = last ? last.t0Clock + last.clip.buf.duration : 0;
    const delay = queue && last && lastEnd > clock.time ? lastEnd - clock.time + 0.12 : 0.02;
    if (!queue) this.stop();
    const src = ctx.createBufferSource();
    src.buffer = clip.buf;
    src.connect(this.audio.voiceBus);
    src.start(ctx.currentTime + delay);
    this.audio.voiceDuck(true);
    // bookkeeping runs on the game clock (see update), so queueing behaves the same live and in capture
    const p: Playing = { src, clip, t0Ctx: ctx.currentTime + delay, t0Clock: clock.time + delay };
    this.playing.push(p);
    this.log.push({ id: e.id, t: p.t0Clock });
    return { delay, dur: clip.buf.duration };
  }

  stop() {
    if (this.playing.length) this.audio.voiceDuck(false);
    for (const p of this.playing) {
      try {
        p.src.stop();
      } catch {
        /* not started */
      }
    }
    this.playing = [];
    this.level = 0;
  }

  /** Seconds until she finishes what she is saying (0 when quiet). */
  remaining() {
    let end = 0;
    for (const p of this.playing) end = Math.max(end, p.t0Clock + p.clip.buf.duration);
    return Math.max(0, end - clock.time);
  }

  /** Is a recorded line playing (or queued) right now? */
  get speaking() {
    return this.playing.some((p) => clock.time < p.t0Clock + p.clip.buf.duration);
  }

  /** Per frame: how loud is she at this instant (read from the line's envelope, so it stays in step with the picture). */
  update() {
    const ctx = this.audio.ctx;
    const live = !!ctx && ctx.state === 'running' && !this.capture;
    const had = this.playing.length;
    this.playing = this.playing.filter((p) => clock.time < p.t0Clock + p.clip.buf.duration + 0.05);
    if (had && !this.playing.length) this.audio.voiceDuck(false);
    let lv = 0;
    for (const p of this.playing) {
      const t = live ? ctx!.currentTime - p.t0Ctx : clock.time - p.t0Clock;
      const i = Math.floor(t * ENV_HZ);
      if (i >= 0 && i < p.clip.env.length) lv = Math.max(lv, p.clip.env[i]);
    }
    this.level = lv;
  }
}
