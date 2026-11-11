// Game clock + tween/timeline system. Everything animated reads this clock,
// so capture mode can step time deterministically (see main.ts).

export type Ease = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t: number) => t * t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outExpo: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: (t: number) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outBack: (t: number) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
};

interface Job {
  start: number;
  dur: number;
  fn: (p: number, raw: number) => void;
  ease: Ease;
  resolve: () => void;
  started: boolean;
}

type FrameFn = (dt: number, time: number) => void;

class Clock {
  time = 0;
  dt = 0;
  private jobs: Job[] = [];
  private frameFns = new Set<FrameFn>();

  /** Animate p from 0→1 over `dur` seconds of game time. */
  tween(dur: number, fn: (p: number, raw: number) => void, e: Ease = ease.inOutCubic, delay = 0): Promise<void> {
    return new Promise((resolve) => {
      const job: Job = { start: this.time + delay, dur: Math.max(dur, 1e-4), fn, ease: e, resolve, started: false };
      if (delay <= 0) {
        job.started = true;
        fn(e(0), 0);
      }
      this.jobs.push(job);
    });
  }

  wait(sec: number): Promise<void> {
    return this.tween(sec, () => {}, ease.linear);
  }

  onFrame(fn: FrameFn): () => void {
    this.frameFns.add(fn);
    return () => this.frameFns.delete(fn);
  }

  update(dt: number) {
    this.dt = dt;
    this.time += dt;
    for (const fn of [...this.frameFns]) fn(dt, this.time);
    const jobs = this.jobs;
    this.jobs = [];
    const keep: Job[] = [];
    for (const j of jobs) {
      if (this.time < j.start) {
        keep.push(j);
        continue;
      }
      const raw = Math.min(1, (this.time - j.start) / j.dur);
      j.started = true;
      j.fn(j.ease(raw), raw);
      if (raw >= 1) j.resolve();
      else keep.push(j);
    }
    // jobs created during this update were pushed to this.jobs
    this.jobs = keep.concat(this.jobs);
  }
}

export const clock = new Clock();

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
