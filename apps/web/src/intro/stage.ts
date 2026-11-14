/**
 * The intro's tiny 2D "film" engine.
 *
 * Every scene paints a pixel-art world into a small buffer canvas (VIEW_H
 * pixels tall, as wide as the output's aspect ratio needs). The player then
 * scales that buffer up to the real canvas with crisp pixels and draws the
 * subtitles on top at full resolution. Because everything is drawn from time
 * alone (no randomness, no real clock inside the scenes) the intro looks the
 * same every time, at any aspect ratio: 9:16, 16:9 or 1:1.
 *
 * World coordinates: x = 0 is the centre of the set, y = 0 is the ground,
 * negative y goes up. A standing person is about 100 units tall.
 */
import type { Appearance, Gender } from '@futbolchi/engine';
import { drawAvatar, type Pose } from '../art/avatarRects';
import { characterSprite } from '../characters';
import { paintBag, paintBoots, type Painter } from '../characters/painters';

/** Buffer height in world units at zoom 1. */
export const VIEW_H = 300;

export interface Cam {
  x: number;
  y: number;
  zoom: number;
}

/** What a scene gets every frame. */
export interface Paint {
  ctx: CanvasRenderingContext2D;
  /** Buffer size in pixels. */
  bw: number;
  bh: number;
  cam: Cam;
  /** Time since the scene started, in ms. */
  t: number;
  /** Sets the world transform for a layer; f < 1 moves slower (parallax), 0 is pinned to the screen. */
  world(f?: number): void;
  /** Screen space of the buffer (for skies, light and vignettes). */
  screen(): void;
  cast: Cast;
}

// ---------------------------------------------------------------- timing helpers
export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const smooth = (u: number) => u * u * (3 - 2 * u);
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** Keyframes [time ms, value]: smooth between keys, held before the first and after the last. */
export function keys(k: [number, number][], t: number, ease: (u: number) => number = smooth): number {
  if (t <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    const [t1, v1] = k[i];
    if (t <= t1) {
      const [t0, v0] = k[i - 1];
      return lerp(v0, v1, ease(clamp01((t - t0) / Math.max(1, t1 - t0))));
    }
  }
  return k[k.length - 1][1];
}

/** Camera from three keyframe tracks. */
export function camKeys(x: [number, number][], y: [number, number][], zoom: [number, number][]) {
  return (t: number): Cam => ({ x: keys(x, t), y: keys(y, t), zoom: keys(zoom, t) });
}

/** Deterministic pseudo-random number in [0, 1) for decoration (stars, leaves…). */
export function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- sprites
type Canvas = HTMLCanvasElement;

function makeCanvas(w: number, h: number, paint: Painter): Canvas {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  paint(ctx);
  return c;
}

/** The hero in everyday clothes (a faded T-shirt and shorts). */
const HOME_KIT = '#b8433a';
/** The academy kids' kit and a second, rival-looking one. */
const ACADEMY_KITS = ['#2f78b7', '#1f8a4c', '#2f78b7'];

/** Fixed looks for the academy kids (deterministic). */
function kidLook(i: number, gender: Gender): Appearance {
  const male = (['short', 'spiky', 'curly', 'sidepart'] as const)[i % 4];
  const female = (['ponytail', 'bun', 'braid'] as const)[i % 3];
  return {
    gender,
    headShape: (['oval', 'square', 'round'] as const)[i % 3],
    skinTone: (['light', 'tan', 'medium', 'dark'] as const)[i % 4],
    hairStyle: gender === 'female' ? female : male,
    hairColor: (['black', 'brown', 'black', 'chestnut'] as const)[i % 4],
    eyeColor: 'brown',
    brows: 'normal',
    nose: 'medium',
    facialHair: 'none',
    heightCm: 176 + (i % 3) * 6,
    weightKg: 70 + (i % 3) * 5,
    foot: 'right',
    boots: (['black', 'white', 'red'] as const)[i % 3],
    sleeves: 'short',
    accessory: i === 1 ? 'headband' : 'none',
    celebration: 'arms_up',
  };
}

/** Everyone who appears in the film, drawn once and cached. */
export class Cast {
  private cache = new Map<string, Canvas>();
  constructor(
    readonly hero: Appearance,
    readonly name: string,
  ) {}

  get gender(): Gender {
    return this.hero.gender;
  }

  private get(key: string, w: number, h: number, paint: Painter): Canvas {
    let c = this.cache.get(key);
    if (!c) {
      c = makeCanvas(w, h, paint);
      this.cache.set(key, c);
    }
    return c;
  }

  heroSprite(pose: Pose = 'stand', kit = HOME_KIT): Canvas {
    return this.get(`hero:${pose}:${kit}`, 64, 128, (ctx) => drawAvatar(ctx, this.hero, kit, 0, 0, 1, pose));
  }
  kid(i: number, pose: Pose = 'stand'): Canvas {
    return this.get(`kid:${i}:${pose}`, 64, 128, (ctx) => drawAvatar(ctx, kidLook(i, this.gender), ACADEMY_KITS[i % 3], 0, 0, 1, pose));
  }
  // story characters come from the shared registry (characters/)
  dad(): Canvas {
    return characterSprite('dad');
  }
  mom(): Canvas {
    return characterSprite('mom');
  }
  coach(): Canvas {
    return characterSprite('coach');
  }
  boots(): Canvas {
    return this.get('boots', 18, 8, paintBoots);
  }
  bag(): Canvas {
    return this.get('bag', 22, 16, paintBag);
  }

  /** Draws all sprites once so the film never stutters on a first use. */
  warmUp(): void {
    for (const pose of ['stand', 'ball_arm', 'hands_hips', 'arms_crossed', 'thumbs_up', 'ball_foot'] as const) this.heroSprite(pose);
    this.heroSprite('stand', '#2f78b7');
    for (let i = 0; i < 3; i++) this.kid(i);
    this.kid(1, 'arms_crossed');
    this.dad();
    this.mom();
    this.coach();
    this.boots();
    this.bag();
  }
}

/**
 * Draws a 64×128 person sprite standing at (x, ground y). `bob` lifts it a
 * little (walking, breathing); `flip` mirrors it.
 */
export function person(ctx: CanvasRenderingContext2D, sprite: Canvas, x: number, y = 0, opts: { bob?: number; flip?: boolean; alpha?: number } = {}) {
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  // Feet are on sprite row 122; the figure is about 100 units tall in the world (scale 0.8).
  const s = 0.8;
  ctx.translate(Math.round(x), Math.round(y - (opts.bob ?? 0)));
  if (opts.flip) ctx.scale(-1, 1);
  ctx.drawImage(sprite, -32 * s, -122 * s, 64 * s, 128 * s);
  ctx.restore();
}

/** Height of the face centre above the ground for a person sprite (for close-ups). */
export const FACE_Y = -86;

/** Walk bob: a 1-unit step every 260 ms while moving. */
export const walkBob = (t: number) => (Math.floor(t / 260) % 2 ? 1 : 0);
/** Slow breathing for idle people. */
export const breathe = (t: number, phase = 0) => (Math.sin((t + phase) / 700) > 0.6 ? 1 : 0);
