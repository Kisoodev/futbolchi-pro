/**
 * Intro sound, synthesized in the browser with the Web Audio API, so there are
 * no files to license. The music borrows an Uzbek colour: a doira (frame drum)
 * usul, a plucked dutor-like voice and a drone, in modes that move from warm
 * to tense to hopeful with the story.
 *
 * Real music: put a licensed track at /audio/intro-music.mp3 (apps/web/public/audio/).
 * When that file exists it replaces the synthesized music; the sound effects stay.
 *
 * Everything also goes to a MediaStream (`stream`) so the admin recorder can
 * put the sound into videos.
 */
export type Mood = 'warm' | 'dream' | 'tense' | 'night' | 'hope' | 'rise' | 'title' | 'none';
export type Ambience = 'crickets' | 'wind' | 'room' | 'birds' | 'pitch' | 'none';
export type Sfx = 'kick' | 'bounce' | 'thud' | 'phone' | 'door' | 'whoosh' | 'heart' | 'hit' | 'step' | 'laugh' | 'cloth';

interface MoodDef {
  bpm: number;
  /** Root frequency (Hz) and scale in semitones above the root. */
  root: number;
  scale: number[];
  /** 16 steps: 'D' = dum (low), 't' = tak (high), '.' = rest. */
  drum: string;
  /** 16 steps of scale degrees (null = rest); octave +7 means one octave up. */
  melody: (number | null)[];
  /** Chord (scale degrees) for the drone pad. */
  pad: number[];
  gain: number;
}

// D-based modes: Dorian (warm/hope), Aeolian (tense/night), Lydian-ish shimmer (dream)
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
const MIXO = [0, 2, 4, 5, 7, 9, 10];
const D = 146.83;

const MOODS: Record<Exclude<Mood, 'none'>, MoodDef> = {
  warm: { bpm: 100, root: D, scale: DORIAN, drum: 'D..t.tD.D..t.t..', melody: [4, null, 3, 4, null, 6, 4, null, 3, null, 1, 2, 3, null, 0, null], pad: [0, 4], gain: 0.8 },
  dream: { bpm: 84, root: D, scale: MIXO, drum: '................', melody: [7, null, 9, null, 11, null, 9, null, 7, null, 6, null, 4, null, null, null], pad: [0, 2, 4], gain: 0.7 },
  tense: { bpm: 66, root: D / 2, scale: AEOLIAN, drum: 'D.......D...t...', melody: [null, null, null, null, 5, null, null, 4, null, null, null, null, 2, null, null, 1], pad: [0, 2], gain: 0.75 },
  night: { bpm: 60, root: D, scale: AEOLIAN, drum: '................', melody: [0, null, null, null, 2, null, null, 3, null, null, null, null, 1, null, null, null], pad: [0, 4], gain: 0.6 },
  hope: { bpm: 88, root: D, scale: DORIAN, drum: 'D.......D..t....', melody: [0, null, 2, 3, 4, null, null, 6, 7, null, 6, 4, 5, null, 4, null], pad: [0, 2, 4], gain: 0.8 },
  rise: { bpm: 112, root: D, scale: DORIAN, drum: 'D.tD.tD.D.tD.ttt', melody: [7, 7, 6, 7, null, 9, 7, 6, 4, null, 6, 7, 9, null, 11, null], pad: [0, 4], gain: 0.95 },
  title: { bpm: 112, root: D, scale: MIXO, drum: 'D...............', melody: [0, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null], pad: [0, 2, 4, 7], gain: 1 },
};

const freq = (m: MoodDef, degree: number) => {
  const oct = Math.floor(degree / 7);
  const step = ((degree % 7) + 7) % 7;
  return m.root * Math.pow(2, oct + m.scale[step] / 12);
};

/** Deterministic white noise. */
function noiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = b.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < d.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (s / 0x7fffffff) * 2 - 1;
  }
  return b;
}

export class IntroAudio {
  readonly ctx: AudioContext;
  private master: GainNode;
  private musicBus: GainNode;
  private sfxBus: GainNode;
  private dest: MediaStreamAudioDestinationNode;
  private noise: AudioBuffer;
  private mood: Mood = 'none';
  private ambience: Ambience = 'none';
  private ambNode: { stop: () => void } | null = null;
  private pad: { stop: (at: number) => void } | null = null;
  private nextStep = 0;
  private step = 0;
  private timer: number | null = null;
  private fileMusic: AudioBufferSourceNode | null = null;
  private hasFileMusic = false;

  constructor() {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    this.dest = this.ctx.createMediaStreamDestination();
    comp.connect(this.dest);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.32;
    this.musicBus.connect(this.master);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.7;
    this.sfxBus.connect(this.master);
    this.noise = noiseBuffer(this.ctx, 2);
  }

  /** Sound for the recorder. */
  get stream(): MediaStream {
    return this.dest.stream;
  }

  get now(): number {
    return this.ctx.currentTime;
  }

  /** Loads /audio/intro-music.mp3 if the owner has added one. */
  async loadFileMusic(): Promise<void> {
    try {
      const res = await fetch('/audio/intro-music.mp3');
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('audio')) return;
      const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.musicBus);
      this.fileMusic = src;
      this.hasFileMusic = true;
    } catch {
      /* no file: the synthesized score plays */
    }
  }

  async start(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume().catch(() => undefined);
    this.fileMusic?.start();
    this.nextStep = this.ctx.currentTime + 0.05;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  pause() {
    void this.ctx.suspend();
  }
  resume() {
    void this.ctx.resume();
  }

  stop() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(0, t, 0.25);
    setTimeout(() => void this.ctx.close().catch(() => undefined), 1200);
  }

  /** Fades the music out (end of the film). */
  fadeOut(seconds: number) {
    this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, seconds / 3);
  }

  setMood(m: Mood) {
    if (m === this.mood) return;
    this.mood = m;
    this.step = 0;
    const t = this.ctx.currentTime;
    this.pad?.stop(t + 1.2);
    this.pad = null;
    if (m === 'none' || this.hasFileMusic) return;
    this.pad = this.drone(MOODS[m]);
  }

  setAmbience(a: Ambience) {
    if (a === this.ambience) return;
    this.ambience = a;
    this.ambNode?.stop();
    this.ambNode = null;
    if (a === 'wind' || a === 'room' || a === 'pitch') {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = a === 'wind' ? 'bandpass' : 'lowpass';
      f.frequency.value = a === 'wind' ? 500 : a === 'pitch' ? 700 : 300;
      f.Q.value = a === 'wind' ? 0.7 : 0.5;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(a === 'wind' ? 0.16 : a === 'pitch' ? 0.1 : 0.04, this.ctx.currentTime, 0.6);
      if (a === 'wind') {
        const lfo = this.ctx.createOscillator();
        const lg = this.ctx.createGain();
        lfo.frequency.value = 0.15;
        lg.gain.value = 260;
        lfo.connect(lg).connect(f.frequency);
        lfo.start();
      }
      src.connect(f).connect(g).connect(this.sfxBus);
      src.start();
      this.ambNode = {
        stop: () => {
          g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
          src.stop(this.ctx.currentTime + 2);
        },
      };
    }
  }

  // ------------------------------------------------------------ scheduler
  private schedule() {
    const ahead = this.ctx.currentTime + 0.12;
    while (this.nextStep < ahead) {
      const at = this.nextStep;
      if (this.mood !== 'none' && !this.hasFileMusic) {
        const m = MOODS[this.mood];
        const i = this.step % 16;
        const d = m.drum[i];
        if (d === 'D') this.dum(at, m.gain);
        else if (d === 't') this.tak(at, m.gain);
        const n = m.melody[i];
        if (n !== null) this.pluck(at, freq(m, n), m.gain);
      }
      if (this.ambience === 'crickets' && this.step % 6 === 0) this.cricket(at);
      if (this.ambience === 'birds' && this.step % 11 === 3) this.bird(at, 2400 + ((this.step * 37) % 900));
      const bpm = this.mood === 'none' ? 100 : MOODS[this.mood].bpm;
      this.nextStep += 60 / bpm / 4;
      this.step++;
    }
  }

  // ------------------------------------------------------------ instruments
  private env(at: number, attack: number, peak: number, decay: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    return g;
  }

  /** Doira "dum": a low, round thump. */
  private dum(at: number, v: number) {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(120, at);
    o.frequency.exponentialRampToValueAtTime(55, at + 0.18);
    const g = this.env(at, 0.004, 0.9 * v, 0.28);
    o.connect(g).connect(this.musicBus);
    o.start(at);
    o.stop(at + 0.35);
  }

  /** Doira "tak": the bright slap at the rim, with jingles. */
  private tak(at: number, v: number) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 3200;
    f.Q.value = 1.4;
    const g = this.env(at, 0.002, 0.5 * v, 0.09);
    src.connect(f).connect(g).connect(this.musicBus);
    src.start(at, (at * 7) % 1.5);
    src.stop(at + 0.15);
  }

  /** Dutor-like pluck: a bright attack that dulls quickly. */
  private pluck(at: number, hz: number, v: number) {
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = hz * 2;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3800, at);
    f.frequency.exponentialRampToValueAtTime(500, at + 0.35);
    const g = this.env(at, 0.004, 0.22 * v, 0.6);
    o.connect(f).connect(g).connect(this.musicBus);
    o.start(at);
    o.stop(at + 0.7);
  }

  /** Soft drone pad for the mood's chord. */
  private drone(m: MoodDef): { stop: (at: number) => void } {
    const t = this.ctx.currentTime;
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.16 * m.gain, t + 1.5);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    f.connect(out).connect(this.musicBus);
    const oscs = m.pad.flatMap((deg) =>
      [-6, 6].map((cents) => {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = freq(m, deg) / 2;
        o.detune.value = cents;
        o.connect(f);
        o.start(t);
        return o;
      }),
    );
    return {
      stop: (at: number) => {
        out.gain.cancelScheduledValues(this.ctx.currentTime);
        out.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.4);
        oscs.forEach((o) => o.stop(at + 0.5));
      },
    };
  }

  private cricket(at: number) {
    for (let k = 0; k < 3; k++) {
      const o = this.ctx.createOscillator();
      o.frequency.value = 4600;
      const g = this.env(at + k * 0.05, 0.005, 0.03, 0.03);
      o.connect(g).connect(this.sfxBus);
      o.start(at + k * 0.05);
      o.stop(at + k * 0.05 + 0.06);
    }
  }

  private bird(at: number, hz: number) {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(hz, at);
    o.frequency.exponentialRampToValueAtTime(hz * 1.5, at + 0.08);
    o.frequency.exponentialRampToValueAtTime(hz * 0.9, at + 0.16);
    const g = this.env(at, 0.01, 0.05, 0.15);
    o.connect(g).connect(this.sfxBus);
    o.start(at);
    o.stop(at + 0.2);
  }

  private noiseHit(at: number, type: BiquadFilterType, hz: number, peak: number, decay: number) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = hz;
    const g = this.env(at, 0.003, peak, decay);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(at, (hz % 1000) / 1000);
    src.stop(at + decay + 0.05);
  }

  private thump(at: number, from: number, to: number, peak: number, decay: number) {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(from, at);
    o.frequency.exponentialRampToValueAtTime(to, at + decay);
    const g = this.env(at, 0.003, peak, decay);
    o.connect(g).connect(this.sfxBus);
    o.start(at);
    o.stop(at + decay + 0.05);
  }

  /** One-shot sound effect, now. */
  sfx(name: Sfx) {
    const at = this.ctx.currentTime + 0.01;
    switch (name) {
      case 'kick':
        this.thump(at, 180, 50, 1, 0.22);
        this.noiseHit(at, 'highpass', 1800, 0.4, 0.06);
        break;
      case 'bounce':
        this.thump(at, 140, 70, 0.45, 0.12);
        break;
      case 'thud':
        this.thump(at, 90, 40, 0.8, 0.3);
        this.noiseHit(at, 'lowpass', 600, 0.4, 0.15);
        break;
      case 'step':
        this.noiseHit(at, 'lowpass', 900, 0.18, 0.06);
        break;
      case 'phone':
        for (const [k, hz] of [[0, 1318], [0.14, 1760]] as const) {
          const o = this.ctx.createOscillator();
          o.type = 'triangle';
          o.frequency.value = hz;
          const g = this.env(at + k, 0.005, 0.25, 0.25);
          o.connect(g).connect(this.sfxBus);
          o.start(at + k);
          o.stop(at + k + 0.3);
        }
        break;
      case 'door':
        this.thump(at, 70, 35, 1, 0.45);
        this.noiseHit(at, 'lowpass', 400, 0.6, 0.3);
        break;
      case 'whoosh': {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noise;
        const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = 2;
        f.frequency.setValueAtTime(300, at);
        f.frequency.exponentialRampToValueAtTime(3000, at + 0.6);
        const g = this.env(at, 0.25, 0.35, 0.4);
        src.connect(f).connect(g).connect(this.sfxBus);
        src.start(at);
        src.stop(at + 0.8);
        break;
      }
      case 'heart':
        this.thump(at, 60, 40, 0.8, 0.18);
        this.thump(at + 0.22, 60, 40, 0.6, 0.18);
        break;
      case 'hit':
        this.thump(at, 110, 45, 1, 0.9);
        this.noiseHit(at, 'lowpass', 1200, 0.5, 0.6);
        if (!this.hasFileMusic) for (const deg of [0, 4, 7]) this.pluck(at, freq(MOODS.rise, deg), 1.2);
        break;
      case 'laugh':
        for (let k = 0; k < 3; k++) this.thump(at + k * 0.13, 420, 300, 0.12, 0.08);
        break;
      case 'cloth':
        this.noiseHit(at, 'bandpass', 2400, 0.12, 0.25);
        break;
    }
  }
}
