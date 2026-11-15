/**
 * Plays a film (a list of scenes) on a canvas: pixel buffer → crisp upscale →
 * subtitles at full resolution → fades. The skip button is a normal DOM button
 * on top, so it never appears in recorded videos.
 *
 * `size` fixes the canvas resolution (the admin recorder uses 1080×1920 etc.);
 * without it the canvas fills its container at the screen's own aspect ratio.
 */
import { useEffect, useRef, useState } from 'react';
import type { Appearance } from '@futbolchi/engine';
import { characterLabel, CHARACTERS } from '../characters';
import { introScript, type IntroScript, type IntroVars } from '../i18n/intro';
import { IntroAudio } from './audio';
import { OPENING, filmLength, type Line, type Scene, type Speaker } from './scenes';
import { Cast, VIEW_H, type Cam, type Paint } from './stage';

export interface IntroHandle {
  canvas: HTMLCanvasElement;
  /** The film's sound, for the recorder. */
  audio: MediaStream;
  start: () => void;
  pause: () => void;
  resume: () => void;
  /** Total length in ms. */
  length: number;
}

interface Props {
  name: string;
  appearance: Appearance;
  onDone: () => void;
  scenes?: Scene[];
  size?: { w: number; h: number };
  /** Recording mode: no skip button, waits for start(). */
  clean?: boolean;
  onReady?: (h: IntroHandle) => void;
}

const FADE = 380;
const SPEAKER_COLORS: Record<Speaker, string> = {
  narrator: '#f2c84b',
  thought: '#b9d4ff',
  hero: '#ffd27a',
  dad: CHARACTERS.dad.color,
  mom: CHARACTERS.mom.color,
  coach: CHARACTERS.coach.color,
  kid: '#9ee28a',
};

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(' ');
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > max && line) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

function drawLine(ctx: CanvasRenderingContext2D, w: number, h: number, line: Line, local: number, script: IntroScript, vars: IntroVars) {
  const a = Math.min(1, (local - line.at) / 250, (line.end - local) / 250);
  if (a <= 0) return;
  const fs = Math.round(Math.min(w, h * 0.75) * 0.05);
  const italic = line.who === 'thought' || line.who === 'narrator';
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = `${italic ? 'italic ' : ''}700 ${fs}px "Nunito", sans-serif`;
  const lines = wrap(ctx, script.lines[line.key](vars), w * 0.84);
  const label =
    line.who === 'hero'
      ? script.who.hero(vars)
      : line.who === 'dad' || line.who === 'mom' || line.who === 'coach'
        ? characterLabel(line.who)
        : line.who === 'kid'
          ? script.who.kid
          : null;
  const lh = fs * 1.3;
  const boxH = lines.length * lh + fs * 0.9 + (label ? fs * 1.05 : 0);
  const boxW = Math.min(w * 0.92, Math.max(...lines.map((l) => ctx.measureText(l).width)) + fs * 1.6);
  const x = w / 2;
  const bottom = h - Math.max(h * 0.07, fs * 1.6);
  const top = bottom - boxH;
  ctx.fillStyle = 'rgba(8,12,26,0.66)';
  const r = fs * 0.5;
  ctx.beginPath();
  ctx.roundRect(x - boxW / 2, top, boxW, boxH, r);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  let y = top + fs * 0.45;
  if (label) {
    ctx.font = `800 ${Math.round(fs * 0.78)}px "Nunito", sans-serif`;
    ctx.fillStyle = SPEAKER_COLORS[line.who];
    ctx.fillText(label.toUpperCase(), x, y);
    y += fs * 1.05;
    ctx.font = `700 ${fs}px "Nunito", sans-serif`;
  }
  ctx.fillStyle = line.who === 'narrator' ? SPEAKER_COLORS.narrator : line.who === 'thought' ? '#e6eeff' : '#ffffff';
  for (const l of lines) {
    ctx.fillText(l, x, y);
    y += lh;
  }
  ctx.restore();
}

export function IntroPlayer({ name, appearance, onDone, scenes = OPENING, size, clean, onReady }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  /**
   * The skip button stays hidden so the film plays clean; it appears only when
   * the viewer touches the screen (or presses a key) and hides again after a while.
   */
  const hideSkip = useRef(0);
  const revealSkip = () => {
    if (clean) return;
    setShowSkip(true);
    window.clearTimeout(hideSkip.current);
    hideSkip.current = window.setTimeout(() => setShowSkip(false), 4000);
  };
  useEffect(() => () => window.clearTimeout(hideSkip.current), []);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const script = introScript();

  useEffect(() => {
    const canvas = canvasRef.current!;
    const holder = wrapRef.current!;
    const out = canvas.getContext('2d')!;
    const buffer = document.createElement('canvas');
    const bctx = buffer.getContext('2d')!;
    const cast = new Cast(appearance, name);
    const vars: IntroVars = { name, g: appearance.gender };
    const audio = new IntroAudio();
    const total = filmLength(scenes);
    let raf = 0;
    let started = false;
    let finished = false;
    let startAt = 0;
    let pausedAt: number | null = null;
    let lastScene = -1;
    let lastLocal = 0;

    // Canvas size: fixed (recording) or the container at the device's pixel ratio.
    const fit = () => {
      if (size) {
        canvas.width = size.w;
        canvas.height = size.h;
      } else {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const r = holder.getBoundingClientRect();
        const k = Math.min(dpr, 1920 / Math.max(r.width, r.height, 1));
        canvas.width = Math.max(2, Math.round(r.width * k));
        canvas.height = Math.max(2, Math.round(r.height * k));
      }
      buffer.height = VIEW_H;
      buffer.width = Math.max(2, Math.round((VIEW_H * canvas.width) / canvas.height));
    };
    fit();
    const ro = size ? null : new ResizeObserver(fit);
    ro?.observe(holder);

    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      audio.stop();
      doneRef.current();
    };

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!started) return;
      // While paused the frame is still drawn (no time passes), so a paused film stays on screen.
      const t = (pausedAt ?? performance.now()) - startAt;
      if (t >= total) {
        finish();
        return;
      }
      // which scene, and the time inside it
      let i = 0;
      let acc = 0;
      while (i < scenes.length - 1 && t >= acc + scenes[i].duration) acc += scenes[i++].duration;
      const sc = scenes[i];
      const local = t - acc;
      if (i !== lastScene) {
        lastScene = i;
        lastLocal = -1;
        audio.setAmbience(sc.ambience);
      }
      // music mood and sound cues crossed since the last frame (skip stale ones after a stall)
      let mood = sc.moods[0][1];
      for (const [at, m] of sc.moods) if (local >= at) mood = m;
      audio.setMood(mood);
      for (const c of sc.cues) if (c.at > lastLocal && c.at <= local && local - c.at < 300) audio.sfx(c.sfx);
      if (i === scenes.length - 1 && local > sc.duration - 2500 && lastLocal <= sc.duration - 2500) audio.fadeOut(2.2);
      lastLocal = local;

      // paint the world into the pixel buffer
      const cam: Cam = sc.camera(local);
      const bw = buffer.width;
      const bh = buffer.height;
      const p: Paint = {
        ctx: bctx,
        bw,
        bh,
        cam,
        t: local,
        cast,
        world(f = 1) {
          const z = 1 + (cam.zoom - 1) * f;
          bctx.setTransform(z, 0, 0, z, Math.round(bw / 2 - cam.x * f * z), Math.round(bh / 2 - cam.y * f * z));
        },
        screen() {
          bctx.setTransform(1, 0, 0, 1, 0, 0);
        },
      };
      bctx.imageSmoothingEnabled = false;
      p.screen();
      bctx.clearRect(0, 0, bw, bh);
      sc.paint(p, script);
      p.screen();

      // upscale with crisp pixels, then the full-resolution layers
      const W = canvas.width;
      const H = canvas.height;
      out.setTransform(1, 0, 0, 1, 0, 0);
      out.imageSmoothingEnabled = false;
      out.drawImage(buffer, 0, 0, W, H);
      sc.overlay?.({ ctx: out, w: W, h: H, t: local, script, tagline: script.lines.tagline(vars) });
      for (const line of sc.lines) if (local >= line.at && local <= line.end) drawLine(out, W, H, line, local, script, vars);

      // fades between scenes; the film opens fast (hook) and ends slowly
      const fadeIn = i === 0 ? 150 : FADE;
      const fadeOut = i === scenes.length - 1 ? 900 : FADE;
      const dark = Math.max(1 - local / fadeIn, (local - (sc.duration - fadeOut)) / fadeOut, 0);
      if (dark > 0) {
        out.fillStyle = `rgba(0,0,0,${Math.min(1, dark)})`;
        out.fillRect(0, 0, W, H);
      }
    };

    const start = () => {
      if (started) return;
      started = true;
      startAt = performance.now();
      void audio.start();
    };
    const handle: IntroHandle = {
      canvas,
      audio: audio.stream,
      start,
      length: total,
      pause: () => {
        if (pausedAt === null && started) {
          pausedAt = performance.now();
          audio.pause();
        }
      },
      resume: () => {
        if (pausedAt !== null) {
          startAt += performance.now() - pausedAt;
          pausedAt = null;
          audio.resume();
        }
      },
    };

    // Dev only: jump to a time in the film from the console, e.g. __introSeek(30000).
    if (import.meta.env.DEV) Object.assign(window, {
      __introSeek: (ms: number) => {
        startAt = (pausedAt ?? performance.now()) - ms;
        lastScene = -1;
      },
      /** Freezes the film on one moment (for checking frames). */
      __introFreeze: (ms: number) => {
        pausedAt = performance.now();
        startAt = pausedAt - ms;
        lastScene = -1;
      },
    });

    let cancelled = false;
    (async () => {
      // fonts and sprites first, so nothing pops in mid-film
      await Promise.all([
        document.fonts.load('700 20px "Pixelify Sans"'),
        document.fonts.load('700 20px "Nunito"'),
        document.fonts.load('italic 700 20px "Nunito"'),
        audio.loadFileMusic(),
      ]).catch(() => undefined);
      if (cancelled) return;
      cast.warmUp();
      setReady(true);
      raf = requestAnimationFrame(frame);
      onReady?.(handle);
      if (!clean) start();
    })();

    const onKey = (e: KeyboardEvent) => {
      if (clean) return;
      if (e.key === 'Escape') finish();
      else revealSkip();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      cancelled = true;
      finished = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('keydown', onKey);
      audio.stop();
    };
    // The film is built once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={wrapRef} className={size ? 'intro-stage fixed-size' : 'intro-stage'} onPointerDown={revealSkip}>
      <canvas ref={canvasRef} className="intro-canvas" style={size ? { aspectRatio: `${size.w} / ${size.h}` } : undefined} />
      {!ready && <p className="intro-loading">{script.loading}</p>}
      {showSkip && !clean && (
        <button type="button" className="intro-skip" onClick={() => doneRef.current()}>
          {script.skip}
        </button>
      )}
    </div>
  );
}
