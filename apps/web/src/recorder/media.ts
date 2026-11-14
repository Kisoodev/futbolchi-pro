/**
 * Video plumbing for the admin recorder.
 *
 * Every recording goes through one Compositor: it copies the source (the intro
 * canvas or the captured browser tab) into an output canvas of the exact video
 * size (1080×1920, 1920×1080…), adds the optional logo and the closing
 * "play now" card, and that canvas is what MediaRecorder records. Anything
 * outside the source (the red REC indicator, buttons) never reaches the video.
 */
export type Aspect = '9:16' | '16:9' | '1:1';

export interface RecSettings {
  quality: 720 | 1080;
  fps: 30 | 60;
  /** Mbit/s */
  bitrate: number;
  aspect: Aspect;
  audio: boolean;
  mic: boolean;
  watermark: boolean;
  /** 0–100 */
  watermarkOpacity: number;
  endCard: boolean;
}

export const DEFAULT_SETTINGS: RecSettings = {
  quality: 1080,
  fps: 30,
  bitrate: 8,
  aspect: '9:16',
  audio: true,
  mic: false,
  watermark: true,
  watermarkOpacity: 70,
  endCard: true,
};

/** Output size in pixels for a format and quality. */
export function videoSize(aspect: Aspect, quality: 720 | 1080): { w: number; h: number } {
  const short = quality;
  const long = Math.round((quality * 16) / 9);
  if (aspect === '9:16') return { w: short, h: long };
  if (aspect === '16:9') return { w: long, h: short };
  return { w: short, h: short };
}

/** MP4 (H.264 + AAC) when the browser can record it, otherwise WebM. */
export function pickMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const options = [
    'video/mp4;codecs=avc1.640028,mp4a.40.2',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  return options.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

export const canRecord = () => pickMime() !== null && typeof HTMLCanvasElement.prototype.captureStream === 'function';
export const canCaptureScreen = () => !!navigator.mediaDevices?.getDisplayMedia && !/Android|iPhone|iPad/i.test(navigator.userAgent);

// ---------------------------------------------------------------- compositor
export interface CompositorOptions {
  settings: RecSettings;
  /** Words on the end card. */
  playNow: string;
  url: string;
}

export class Compositor {
  readonly canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private endCardAt: number | null = null;
  private logo: HTMLCanvasElement;

  constructor(
    private source: CanvasImageSource & { width?: number; height?: number; videoWidth?: number; videoHeight?: number },
    private opts: CompositorOptions,
  ) {
    const { w, h } = videoSize(opts.settings.aspect, opts.settings.quality);
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d')!;
    this.logo = this.makeLogo();
  }

  /** The logo: a small pixel ball and the game's name. */
  private makeLogo(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    const s = Math.round(this.canvas.width / 360);
    c.width = 120 * s;
    c.height = 22 * s;
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(8,12,26,0.55)';
    g.beginPath();
    g.roundRect(0, 0, c.width, c.height, 11 * s);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(11 * s, 11 * s, 7 * s, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1b1620';
    g.fillRect(9 * s, 9 * s, 4 * s, 4 * s);
    g.fillStyle = '#ffffff';
    g.font = `700 ${11 * s}px "Pixelify Sans", sans-serif`;
    g.textBaseline = 'middle';
    g.fillText('FUTBOLCHI PRO', 22 * s, 11.5 * s);
    return c;
  }

  start() {
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.draw();
    };
    loop();
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  /** Shows the end card for `ms`, then resolves. */
  endCard(ms = 2600): Promise<void> {
    this.endCardAt = performance.now();
    return new Promise((r) => setTimeout(r, ms));
  }

  private draw() {
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    if (this.endCardAt !== null) {
      this.drawEndCard((performance.now() - this.endCardAt) / 1000);
      return;
    }
    // "cover": fill the frame, cropping the source's longer side around its centre
    const sw = this.source.videoWidth || this.source.width || W;
    const sh = this.source.videoHeight || this.source.height || H;
    const k = Math.max(W / sw, H / sh);
    const dw = sw * k;
    const dh = sh * k;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    try {
      ctx.drawImage(this.source, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } catch {
      /* the video has no frame yet */
    }
    if (this.opts.settings.watermark) {
      ctx.globalAlpha = this.opts.settings.watermarkOpacity / 100;
      const m = Math.round(W * 0.035);
      ctx.drawImage(this.logo, W - this.logo.width - m, H - this.logo.height - m * (this.opts.settings.aspect === '9:16' ? 6 : 1.2));
      ctx.globalAlpha = 1;
    }
  }

  private drawEndCard(sec: number) {
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1d4f8a');
    g.addColorStop(1, '#0b1d36');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const a = Math.min(1, sec / 0.5);
    const big = Math.round(Math.min(W * 0.11, H * 0.09));
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // ball
    const r = big * 0.7;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(W / 2, H * 0.32, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b1620';
    ctx.fillRect(W / 2 - r * 0.28, H * 0.32 - r * 0.28, r * 0.56, r * 0.56);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${big}px "Pixelify Sans", sans-serif`;
    ctx.fillText('FUTBOLCHI PRO', W / 2, H * 0.47);
    // pulsing "play now" button
    const pulse = 1 + 0.04 * Math.sin(sec * 6);
    const bw = W * 0.62 * pulse;
    const bh = big * 1.25 * pulse;
    ctx.fillStyle = '#4fae24';
    ctx.beginPath();
    ctx.roundRect(W / 2 - bw / 2, H * 0.6 - bh / 2, bw, bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.round(big * 0.55)}px "Nunito", sans-serif`;
    ctx.fillText(`▶ ${this.opts.playNow}`, W / 2, H * 0.6);
    ctx.font = `700 ${Math.round(big * 0.4)}px "Nunito", sans-serif`;
    ctx.fillStyle = '#cfe6fa';
    ctx.fillText(this.opts.url, W / 2, H * 0.7);
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- recording
/** Mixes several audio streams into one track (game sound + microphone). */
export function mixAudio(streams: MediaStream[]): { stream: MediaStream; close: () => void } | null {
  const withAudio = streams.filter((s) => s.getAudioTracks().length > 0);
  if (!withAudio.length) return null;
  const ac = new AudioContext();
  const dest = ac.createMediaStreamDestination();
  for (const s of withAudio) ac.createMediaStreamSource(s).connect(dest);
  return { stream: dest.stream, close: () => void ac.close().catch(() => undefined) };
}

export interface Recording {
  blob: Blob;
  url: string;
  mime: string;
  seconds: number;
  /** "MP4" or "WebM" */
  format: string;
}

/** MediaRecorder that collects one-second chunks (memory stays even on long takes). */
export class Take {
  private rec: MediaRecorder;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private pausedTotal = 0;
  private pausedAt: number | null = null;

  constructor(
    stream: MediaStream,
    readonly mime: string,
    settings: RecSettings,
  ) {
    this.rec = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: settings.bitrate * 1_000_000,
      audioBitsPerSecond: 160_000,
    });
    this.rec.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data);
    };
  }

  start() {
    this.startedAt = performance.now();
    this.rec.start(1000);
  }
  pause() {
    if (this.rec.state === 'recording') {
      this.rec.pause();
      this.pausedAt = performance.now();
    }
  }
  resume() {
    if (this.rec.state === 'paused') {
      this.rec.resume();
      if (this.pausedAt !== null) this.pausedTotal += performance.now() - this.pausedAt;
      this.pausedAt = null;
    }
  }
  /** Seconds recorded so far (pauses excluded). */
  elapsed(): number {
    const now = this.pausedAt ?? performance.now();
    return Math.max(0, (now - this.startedAt - this.pausedTotal) / 1000);
  }
  stop(): Promise<Recording> {
    const seconds = Math.round(this.elapsed());
    return new Promise((resolve) => {
      this.rec.onstop = () => {
        const type = this.mime.split(';')[0];
        const blob = new Blob(this.chunks, { type });
        this.chunks = [];
        resolve({ blob, url: URL.createObjectURL(blob), mime: type, seconds, format: type.includes('mp4') ? 'MP4' : 'WebM' });
      };
      if (this.rec.state !== 'inactive') this.rec.stop();
    });
  }
}

/**
 * Captures this browser tab and, when the browser allows it, limits the
 * capture to `el` so floating controls are left out (Element Capture in
 * Chrome 132+; otherwise Region Capture crops to the element's box).
 * Returns whether the floating controls are guaranteed to be hidden.
 */
export async function captureTab(el: Element, fps: number, audio: boolean): Promise<{ stream: MediaStream; overlayHidden: boolean }> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: fps },
    audio,
    // Chrome-only hints: offer this tab first, don't let the source switch mid-take.
    ...({ preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude' } as object),
  } as DisplayMediaStreamOptions);
  const [track] = stream.getVideoTracks();
  const w = window as unknown as {
    RestrictionTarget?: { fromElement(e: Element): Promise<unknown> };
    CropTarget?: { fromElement(e: Element): Promise<unknown> };
  };
  const t = track as MediaStreamTrack & { restrictTo?: (x: unknown) => Promise<void>; cropTo?: (x: unknown) => Promise<void> };
  try {
    if (w.RestrictionTarget && t.restrictTo) {
      await t.restrictTo(await w.RestrictionTarget.fromElement(el));
      return { stream, overlayHidden: true };
    }
  } catch {
    /* fall back to cropping */
  }
  try {
    if (w.CropTarget && t.cropTo) await t.cropTo(await w.CropTarget.fromElement(el));
  } catch {
    /* whole tab */
  }
  return { stream, overlayHidden: false };
}

/** A <video> that plays a capture stream (the compositor draws from it). */
export function streamVideo(stream: MediaStream): Promise<HTMLVideoElement> {
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.srcObject = stream;
  return v.play().then(() => v);
}

/** File name like futbolchi-intro-9x16-2026-11-15-1432.mp4 */
export function fileName(kind: string, aspect: Aspect, mime: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  return `futbolchi-${kind}-${aspect.replace(':', 'x')}-${stamp}.${mime.includes('mp4') ? 'mp4' : 'webm'}`;
}
