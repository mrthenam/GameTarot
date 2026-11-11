// Procedural audio: generative mystical music + all sound effects, synthesized with WebAudio.

const D_MINOR_CHORDS: number[][] = [
  // MIDI notes; progression Dm – B♭ – Gm – A (2 bars each)
  [50, 57, 62, 65, 69],
  [46, 53, 58, 62, 65],
  [43, 55, 58, 62, 67],
  [45, 52, 57, 61, 64],
];
const PENTA = [62, 65, 67, 69, 72, 74, 77, 79, 81, 84];
const BPM = 72;
const BEAT = 60 / BPM;

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private musicFilter!: BiquadFilterNode;
  private sfxBus!: GainNode;
  private reverb!: ConvolverNode;
  private reverbSend!: GainNode;
  private noiseBuf!: AudioBuffer;
  private nextBeatTime = 0;
  private beatIndex = 0;
  private timer: number | null = null;
  muted = false;

  /** Must be called from a user gesture. */
  init() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(3.6);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.5;
    this.reverbSend.connect(this.reverb).connect(this.master);

    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 9000;
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.55;
    this.musicBus.connect(this.musicFilter).connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);

    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  private impulse(sec: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return buf;
  }

  // ------------------------------------------------------------ primitives
  private tone(freq: number, t: number, dur: number, o: { type?: OscillatorType; gain?: number; attack?: number; dest?: AudioNode; rev?: number; detune?: number; endFreq?: number } = {}) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.endFreq) osc.frequency.exponentialRampToValueAtTime(o.endFreq, t + dur);
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    const a = o.attack ?? 0.005;
    const peak = o.gain ?? 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, a + 0.01));
    osc.connect(g);
    g.connect(o.dest ?? this.sfxBus);
    if (o.rev) {
      const s = ctx.createGain();
      s.gain.value = o.rev;
      g.connect(s).connect(this.reverbSend);
    }
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private bell(freq: number, t: number, dur = 1.6, gain = 0.12, dest?: AudioNode, rev = 0.8) {
    this.tone(freq, t, dur, { gain, dest, rev });
    this.tone(freq * 2.76, t, dur * 0.45, { gain: gain * 0.35, dest, rev });
    this.tone(freq * 5.4, t, dur * 0.2, { gain: gain * 0.15, dest, rev });
  }

  private noise(t: number, dur: number, o: { gain?: number; type?: BiquadFilterType; f0?: number; f1?: number; q?: number; attack?: number; rev?: number }) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? 'bandpass';
    f.Q.value = o.q ?? 1;
    f.frequency.setValueAtTime(o.f0 ?? 1000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    const g = ctx.createGain();
    const a = o.attack ?? 0.01;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.gain ?? 0.2, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    if (o.rev) {
      const s = ctx.createGain();
      s.gain.value = o.rev;
      g.connect(s).connect(this.reverbSend);
    }
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  private get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }
  private ok() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  // ------------------------------------------------------------ music
  startMusic() {
    if (!this.ctx || this.timer !== null) return;
    this.nextBeatTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 100);
  }

  private schedule() {
    if (!this.ctx) return;
    while (this.nextBeatTime < this.ctx.currentTime + 0.4) {
      this.playBeat(this.beatIndex, this.nextBeatTime);
      this.nextBeatTime += BEAT;
      this.beatIndex++;
    }
  }

  private playBeat(i: number, t: number) {
    const chord = D_MINOR_CHORDS[Math.floor(i / 8) % D_MINOR_CHORDS.length];
    const bus = this.musicBus;
    const beatInBar = i % 8;
    if (beatInBar === 0) {
      // pad: slow swelling chord
      for (const n of chord.slice(1)) {
        for (const det of [-7, 7]) {
          this.tone(mtof(n), t, BEAT * 8.5, { type: 'triangle', gain: 0.022, attack: 1.6, dest: bus, rev: 0.6, detune: det });
        }
      }
      this.tone(mtof(chord[0] - 12), t, BEAT * 8.2, { type: 'sine', gain: 0.09, attack: 1.2, dest: bus });
    }
    // harp arpeggio in eighths
    const arp = [0, 1, 2, 3, 4, 3, 2, 1];
    for (let h = 0; h < 2; h++) {
      if (Math.random() < 0.18) continue;
      const step = (beatInBar * 2 + h) % arp.length;
      const n = chord[arp[step]] + (step > 3 ? 12 : 0);
      this.tone(mtof(n + 12), t + h * BEAT * 0.5, 1.4, { type: 'triangle', gain: 0.035, dest: bus, rev: 0.5 });
    }
    // celesta twinkles
    if (Math.random() < 0.28) {
      const n = PENTA[Math.floor(Math.random() * PENTA.length)] + 12;
      this.bell(mtof(n), t + Math.random() * BEAT, 2.2, 0.02, bus, 1.2);
    }
    // soft frame drum
    if (beatInBar % 4 === 0) this.tone(95, t, 0.5, { gain: 0.08, endFreq: 55, dest: bus });
    if (beatInBar % 4 === 3 && Math.random() < 0.5) this.tone(140, t + BEAT * 0.5, 0.25, { gain: 0.03, endFreq: 80, dest: bus });
  }

  /** 0 = normal, 1 = heavily ducked + muffled (suspense). */
  duck(amount: number, time = 0.6) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(0.55 * (1 - amount * 0.75), t, time / 3);
    this.musicFilter.frequency.setTargetAtTime(9000 * (1 - amount) + 500 * amount, t, time / 3);
  }

  // ------------------------------------------------------------ sfx
  click() {
    if (!this.ok()) return;
    this.bell(1318, this.now, 0.5, 0.05);
  }

  hover(i: number) {
    if (!this.ok()) return;
    this.bell(mtof(PENTA[i % PENTA.length] + 12), this.now, 0.9, 0.035);
  }

  deal(i: number) {
    if (!this.ok()) return;
    const t = this.now;
    this.noise(t, 0.16, { gain: 0.07, type: 'bandpass', f0: 2500 + i * 120, f1: 5000, q: 0.9 });
  }

  shuffle() {
    if (!this.ok()) return;
    const t = this.now;
    this.noise(t, 1.6, { gain: 0.06, type: 'bandpass', f0: 600, f1: 3000, q: 0.7, attack: 0.5, rev: 0.4 });
    for (let k = 0; k < 6; k++) this.bell(mtof(PENTA[k] + 12), t + 0.35 + k * 0.13, 1.0, 0.025);
  }

  whoosh() {
    if (!this.ok()) return;
    const t = this.now;
    this.noise(t, 0.7, { gain: 0.18, type: 'bandpass', f0: 300, f1: 2400, q: 1.2, attack: 0.25, rev: 0.3 });
  }

  pick() {
    if (!this.ok()) return;
    const t = this.now;
    this.whoosh();
    this.bell(mtof(74), t + 0.05, 1.8, 0.08);
    this.bell(mtof(81), t + 0.12, 1.8, 0.06);
    this.tone(55, t, 1.2, { type: 'sine', gain: 0.15, endFreq: 40 });
  }

  heartbeat(strength = 1) {
    if (!this.ok()) return;
    const t = this.now;
    this.tone(70, t, 0.22, { gain: 0.35 * strength, endFreq: 40 });
    this.tone(64, t + 0.2, 0.25, { gain: 0.25 * strength, endFreq: 36 });
  }

  /** Seal layer shatters. level 0..2, tier 0..3 colours the chime. */
  sealBreak(level: number, tier: number) {
    if (!this.ok()) return;
    const t = this.now;
    this.noise(t, 0.35, { gain: 0.25, type: 'highpass', f0: 2500, q: 0.5, rev: 0.6 });
    this.tone(90 - level * 10, t, 0.6, { gain: 0.35, endFreq: 35 });
    const base = [62, 65, 69, 74][tier] + level * 5;
    this.bell(mtof(base + 12), t + 0.02, 2.2, 0.11);
    this.bell(mtof(base + 19), t + 0.06, 2.0, 0.06);
  }

  upgrade(tier: number) {
    if (!this.ok()) return;
    const t = this.now;
    const notes = [[74, 77, 81], [74, 78, 81, 86], [74, 78, 81, 85, 90], [74, 78, 81, 86, 90, 93]][tier];
    notes.forEach((n, k) => this.bell(mtof(n), t + k * 0.07, 2.4, 0.08));
    this.noise(t, 1.2, { gain: 0.08, type: 'highpass', f0: 5000, q: 0.3, attack: 0.05, rev: 1 });
  }

  riser(dur: number) {
    if (!this.ok()) return;
    const t = this.now;
    this.noise(t, dur, { gain: 0.16, type: 'bandpass', f0: 300, f1: 6000, q: 2, attack: dur * 0.9, rev: 0.5 });
    this.tone(110, t, dur, { type: 'sawtooth', gain: 0.03, attack: dur * 0.9, endFreq: 440 });
    this.tone(165, t, dur, { type: 'sine', gain: 0.06, attack: dur * 0.9, endFreq: 660 });
  }

  flip(tier: number) {
    if (!this.ok()) return;
    const t = this.now;
    this.noise(t, 1.8, { gain: 0.3, type: 'lowpass', f0: 8000, f1: 400, q: 0.4, rev: 1 });
    this.tone(60, t, 1.5, { gain: 0.4, endFreq: 30 });
    const chords = [[62, 69, 74, 77, 81], [62, 69, 74, 78, 81, 86], [62, 66, 69, 74, 78, 81, 86, 90], [50, 62, 66, 69, 74, 78, 81, 86, 90, 93, 98]];
    chords[tier].forEach((n, k) => {
      this.bell(mtof(n), t + 0.05 + k * (tier === 3 ? 0.09 : 0.06), 3 + tier * 0.6, 0.07);
      if (tier >= 2) this.tone(mtof(n), t + 0.05, 3.5, { type: 'triangle', gain: 0.015, attack: 0.4, rev: 0.8 });
    });
  }

  gift() {
    if (!this.ok()) return;
    const t = this.now;
    [86, 90, 93, 98].forEach((n, k) => this.bell(mtof(n), t + k * 0.06, 1.4, 0.05));
  }

  door() {
    if (!this.ok()) return;
    const t = this.now;
    this.tone(48, t, 2.4, { type: 'sawtooth', gain: 0.05, attack: 0.3, endFreq: 36 });
    this.noise(t, 2.2, { gain: 0.12, type: 'lowpass', f0: 400, f1: 150, q: 0.5, attack: 0.4, rev: 0.6 });
    [62, 69, 74, 81].forEach((n, k) => this.bell(mtof(n), t + 0.6 + k * 0.18, 2.6, 0.06));
  }
}
