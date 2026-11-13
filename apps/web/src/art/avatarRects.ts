/**
 * Pixel avatar built from the persona's appearance, on a 64×96 grid.
 *
 * Pure and deterministic: the figure is painted part by part into layers
 * (hair, legs, kit, arms, head…). Each layer is shaded automatically (light
 * from the top-left), then the whole figure gets a dark outline. The result
 * is merged into horizontal runs, drawn as SVG in the UI and onto the canvas
 * share card. Kits are plain colours only: no real clubs, sponsors or logos.
 */
import {
  constants as C,
  type Appearance,
  type BootColor,
  CELEBRATIONS,
  type Celebration,
  type EyeColor,
  type HairColor,
  type HeadShape,
  type SkinTone,
} from '@futbolchi/engine';

export const AVATAR_W = 64;
export const AVATAR_H = 96;
/** Preview-only football poses (not saved; the saved one is the celebration). */
export const EXTRA_POSES = ['hands_hips', 'arms_crossed', 'ball_arm', 'thumbs_up', 'ball_foot'] as const;
export type ExtraPose = (typeof EXTRA_POSES)[number];
/** Standing, a calm football pose, or one of the goal celebrations. */
export type Pose = 'stand' | ExtraPose | Celebration;
/** Order the pose button walks through. */
export const POSE_CYCLE: readonly Exclude<Pose, 'stand'>[] = [...EXTRA_POSES, ...CELEBRATIONS];

export const SKIN_HEX: Record<SkinTone, string> = {
  pale: '#fbe2cd',
  light: '#f3cca6',
  medium: '#dea472',
  olive: '#c48f59',
  tan: '#a8703f',
  brown: '#83532f',
  dark: '#5a3720',
};
export const HAIR_HEX: Record<HairColor, string> = {
  black: '#1d1a19',
  chestnut: '#3d2516',
  brown: '#6e4426',
  blonde: '#e1b44c',
  platinum: '#efe5c4',
  red: '#b4462a',
  gray: '#8b939b',
  white: '#eef1f4',
};
export const EYE_HEX: Record<EyeColor, string> = {
  dark: '#231914',
  brown: '#5d3920',
  hazel: '#8c6b2b',
  green: '#3e7d3c',
  blue: '#3a70c2',
  gray: '#6f808d',
};
export const BOOT_HEX: Record<BootColor, string> = {
  black: '#202228',
  white: '#f3f4f6',
  red: '#d43a2c',
  gold: '#e3b23a',
  blue: '#2f6fd1',
  orange: '#f07a1f',
};

const OUTLINE = '#1a2230';
const SHORTS = '#f2f2ee';
const WHITE = '#fbfbf8';
const MOUTH = '#8c3b2f';
const MOUTH_OPEN = '#4f1716';
const SHADOW = 'rgba(16, 40, 24, 0.22)';

// ---------- colour helpers ----------
const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (c: number[]) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
/** amt < 0 darkens (towards a cool shadow), amt > 0 lightens. */
export function shade(hex: string, amt: number): string {
  const c = rgb(hex);
  if (amt < 0) return toHex([c[0] * (1 + amt * 1.05), c[1] * (1 + amt), c[2] * (1 + amt * 0.85)]);
  return toHex(c.map((v) => v + (255 - v) * amt));
}
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}
const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

// ---------- drawing surfaces ----------
type Pixels = (string | null)[];
const idx = (x: number, y: number) => y * AVATAR_W + x;
const inside = (x: number, y: number) => x >= 0 && x < AVATAR_W && y >= 0 && y < AVATAR_H;

/** One body part in a single base colour; shaded when composited. */
class Layer {
  readonly px = new Set<number>();
  constructor(
    readonly color: string,
    /** How strong the automatic light/shadow is (0 = flat). */
    readonly relief = 1,
  ) {}
  set(x: number, y: number) {
    x = Math.round(x);
    y = Math.round(y);
    if (inside(x, y)) this.px.add(idx(x, y));
  }
  unset(x: number, y: number) {
    this.px.delete(idx(Math.round(x), Math.round(y)));
  }
  has(x: number, y: number) {
    return inside(x, y) && this.px.has(idx(x, y));
  }
  rect(x: number, y: number, w: number, h: number) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, clipBottom = Infinity) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      if (y > clipBottom) break;
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y);
      }
    }
  }
  /** Paints into the picture with top-left light and bottom-right shadow. */
  paint(out: Pixels) {
    const hi = shade(this.color, 0.2 * this.relief);
    const lo = shade(this.color, -0.2 * this.relief);
    const lo2 = shade(this.color, -0.34 * this.relief);
    for (const p of this.px) {
      const x = p % AVATAR_W;
      const y = (p - x) / AVATAR_W;
      let c = this.color;
      if (this.relief > 0) {
        const right = !this.has(x + 1, y);
        const below = !this.has(x, y + 1);
        if (right && below) c = lo2;
        else if (right || (!this.has(x + 2, y) && this.px.size > 40)) c = right ? lo2 : lo;
        else if (below) c = lo;
        else if (!this.has(x - 1, y) || !this.has(x, y - 1)) c = hi;
      }
      out[p] = c;
    }
  }
}

/** Direct pixel writes for small details (eyes, mouth, logos…). */
const put = (out: Pixels, x: number, y: number, c: string) => {
  x = Math.round(x);
  y = Math.round(y);
  if (inside(x, y)) out[idx(x, y)] = c;
};

// ---------- body layout ----------
/** Head width per row, top to bottom (even numbers, centred). */
const HEAD_ROWS: Record<HeadShape, number[]> = {
  round: [8, 12, 14, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 14, 14, 12, 10, 8, 6],
  oval: [8, 10, 12, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 12, 12, 10, 10, 8, 6],
  square: [12, 14, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 14, 14, 12, 10],
  angular: [10, 12, 14, 16, 16, 16, 16, 16, 16, 16, 16, 14, 14, 12, 12, 10, 8, 6, 4],
};

export interface AvatarLayout {
  cx: number;
  ground: number;
  headTop: number;
  headRows: number[];
  torsoTop: number;
  torsoLen: number;
  torsoW: number;
  legTop: number;
  shortsLen: number;
  sockLen: number;
  legW: number;
  limb: number;
}

export function avatarLayout(a: Appearance): AvatarLayout {
  const th = (a.heightCm - C.HEIGHT_MIN_CM) / (C.HEIGHT_MAX_CM - C.HEIGHT_MIN_CM);
  const tw = (a.weightKg - C.WEIGHT_MIN_KG) / (C.WEIGHT_MAX_KG - C.WEIGHT_MIN_KG);
  const cx = 32;
  const ground = 92;
  const legLen = Math.round(25 + 9 * th);
  const torsoLen = Math.round(19 + 5 * th);
  const torsoW = 2 * Math.round((17 + 8 * tw) / 2);
  const legTop = ground - legLen + 1;
  const torsoTop = legTop - torsoLen;
  const headRows = HEAD_ROWS[a.headShape];
  const headTop = torsoTop - 3 - headRows.length + 1;
  return {
    cx,
    ground,
    headTop,
    headRows,
    torsoTop,
    torsoLen,
    torsoW,
    legTop,
    shortsLen: 9 + Math.round(2 * th),
    sockLen: 10 + Math.round(3 * th),
    legW: Math.max(6, torsoW / 2 - 3),
    limb: tw < 0.34 ? 5 : tw < 0.67 ? 6 : 7,
  };
}

/** Square around the head, for small "bust" previews (hair-style chips, header). */
export function headBox(a: Appearance): { x: number; y: number; w: number; h: number } {
  const L = avatarLayout(a);
  return { x: L.cx - 17, y: L.headTop - 9, w: 34, h: 34 };
}

// ---------- the painter ----------
export function avatarPixels(a: Appearance, kit: string, pose: Pose = 'stand'): Pixels {
  const L = avatarLayout(a);
  const { cx, headTop, headRows } = L;
  const out: Pixels = new Array(AVATAR_W * AVATAR_H).fill(null);
  const skin = SKIN_HEX[a.skinTone];
  const hair = HAIR_HEX[a.hairColor];
  const boot = BOOT_HEX[a.boots];
  const trim = luminance(kit) < 0.62 ? WHITE : '#1d3a5c';
  const celebrating = (CELEBRATIONS as readonly string[]).includes(pose);
  const headH = headRows.length;
  const maxW = Math.max(...headRows);
  const rowX0 = (i: number) => cx - headRows[Math.max(0, Math.min(headH - 1, i))] / 2;
  const rowX1 = (i: number) => cx + headRows[Math.max(0, Math.min(headH - 1, i))] / 2 - 1;

  // ---- hair behind the head ----
  const back = new Layer(shade(hair, -0.12));
  if (a.hairStyle === 'afro') back.ellipse(cx - 0.5, headTop + 6, maxW / 2 + 7, 13);
  if (a.hairStyle === 'long') {
    back.rect(cx - maxW / 2 - 2, headTop + 3, maxW + 4, headH + 3);
    for (let x = cx - maxW / 2 - 2; x < cx + maxW / 2 + 2; x += 3) back.set(x + 1, headTop + headH + 6);
  }
  if (a.hairStyle === 'dreads') {
    for (let x = cx - maxW / 2 - 3; x <= cx + maxW / 2 + 1; x += 3) {
      const len = headH + 1 + ((x * 7) % 5);
      back.rect(x, headTop + 3, 2, len);
    }
  }
  back.paint(out);

  // ---- legs: skin, socks, boots ----
  const legSkin = new Layer(skin);
  const socks = new Layer(kit);
  const boots = new Layer(boot, 0.7);
  const shortsBottom = L.legTop + L.shortsLen;
  const sockTop = L.ground - 2 - L.sockLen;
  const legXs = [cx - 1 - L.legW, cx + 1];
  for (const lx of legXs) {
    legSkin.rect(lx, shortsBottom - 1, L.legW, sockTop - shortsBottom + 1);
    socks.rect(lx, sockTop, L.legW, L.sockLen);
  }
  legSkin.paint(out);
  socks.paint(out);
  for (const lx of legXs) {
    for (let x = lx; x < lx + L.legW; x++) put(out, x, sockTop + 1, trim); // sock band
  }
  // Boots point outwards a little
  boots.rect(legXs[0] - 1, L.ground - 2, L.legW + 1, 3);
  boots.rect(legXs[1], L.ground - 2, L.legW + 1, 3);
  boots.paint(out);
  const stud = a.boots === 'white' ? '#3a4150' : WHITE;
  put(out, legXs[0] + 1, L.ground - 1, stud);
  put(out, legXs[0] + 2, L.ground - 1, stud);
  put(out, legXs[1] + L.legW - 3, L.ground - 1, stud);
  put(out, legXs[1] + L.legW - 2, L.ground - 1, stud);
  for (const lx of [legXs[0] - 1, legXs[1]]) for (let x = lx; x <= lx + L.legW; x++) put(out, x, L.ground, shade(boot, -0.45));

  // ---- shorts ----
  const shorts = new Layer(SHORTS);
  const tl = cx - L.torsoW / 2;
  shorts.rect(tl, L.legTop, L.torsoW, L.shortsLen);
  for (let y = shortsBottom - 3; y < shortsBottom; y++) {
    shorts.unset(cx - 1, y);
    shorts.unset(cx, y);
  }
  shorts.paint(out);
  for (let y = L.legTop + 1; y < shortsBottom - 1; y++) {
    put(out, tl + 1, y, kit);
    put(out, tl + L.torsoW - 2, y, kit);
  }

  // ---- shirt ----
  const shirt = new Layer(kit);
  shirt.rect(tl, L.torsoTop, L.torsoW, L.torsoLen + 1);
  shirt.unset(tl, L.torsoTop);
  shirt.unset(tl + L.torsoW - 1, L.torsoTop);
  shirt.paint(out);
  // V-neck collar
  for (let x = cx - 3; x <= cx + 2; x++) put(out, x, L.torsoTop, trim);
  put(out, cx - 2, L.torsoTop + 1, trim);
  put(out, cx + 1, L.torsoTop + 1, trim);
  put(out, cx - 1, L.torsoTop + 1, shade(skin, -0.15));
  put(out, cx, L.torsoTop + 1, shade(skin, -0.15));
  put(out, cx - 1, L.torsoTop + 2, trim);
  put(out, cx, L.torsoTop + 2, trim);
  // Fictional crest: small shield on the left chest
  const crestX = tl + 3;
  const crestY = L.torsoTop + 5;
  for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [1, 2]]) put(out, crestX + dx, crestY + dy, '#f2c94c');
  put(out, crestX + 1, crestY, shade('#f2c94c', -0.35));
  // Fabric folds and hem
  const fold = shade(kit, -0.16);
  put(out, cx + 3, L.torsoTop + L.torsoLen - 6, fold);
  put(out, cx + 4, L.torsoTop + L.torsoLen - 5, fold);
  put(out, cx - 4, L.torsoTop + L.torsoLen - 3, fold);
  for (let x = tl + 1; x < tl + L.torsoW - 1; x++) put(out, x, L.torsoTop + L.torsoLen, shade(kit, -0.28));

  // ---- neck ----
  const neck = new Layer(skin, 0.6);
  neck.rect(cx - 3, L.torsoTop - 3, 6, 4);
  neck.paint(out);
  for (let x = cx - 3; x <= cx + 2; x++) put(out, x, L.torsoTop - 3, shade(skin, -0.3));

  // ---- head and ears ----
  const head = new Layer(skin, 0.75);
  headRows.forEach((w, i) => head.rect(cx - w / 2, headTop + i, w, 1));
  for (const ey of [8, 9, 10, 11]) {
    head.set(rowX0(ey) - 1, headTop + ey);
    head.set(rowX1(ey) + 1, headTop + ey);
  }
  head.set(rowX0(9) - 2, headTop + 9);
  head.set(rowX0(9) - 2, headTop + 10);
  head.set(rowX1(9) + 2, headTop + 9);
  head.set(rowX1(9) + 2, headTop + 10);
  head.paint(out);
  put(out, rowX0(9) - 1, headTop + 10, shade(skin, -0.3));
  put(out, rowX1(9) + 1, headTop + 10, shade(skin, -0.3));
  // Cheek blush and chin shadow
  put(out, cx - 6, headTop + 12, mix(skin, '#e0705a', 0.18));
  put(out, cx + 5, headTop + 12, mix(skin, '#e0705a', 0.18));

  // ---- facial hair (under the mouth/nose details) ----
  const fh = HAIR_HEX[a.hairColor];
  const onFace = (x: number, y: number) => {
    const i = y - headTop;
    return i >= 0 && i < headH && x >= rowX0(i) && x <= rowX1(i);
  };
  if (a.facialHair === 'stubble' || a.facialHair === 'beard') {
    const from = a.facialHair === 'beard' ? 11 : 12;
    for (let y = headTop + from; y < headTop + headH; y++) {
      for (let x = rowX0(y - headTop); x <= rowX1(y - headTop); x++) {
        const nearMouth = Math.abs(x - cx + 0.5) <= 2.5 && y >= headTop + 13 && y <= headTop + 15;
        if (a.facialHair === 'stubble') {
          if ((x + y) % 2 === 0 && !nearMouth) put(out, x, y, mix(skin, fh, 0.42));
        } else if (!nearMouth || y === headTop + 13) {
          put(out, x, y, (x * 3 + y) % 5 === 0 ? shade(fh, 0.18) : fh);
        }
      }
    }
    if (a.facialHair === 'beard') {
      for (let y = headTop + 7; y < headTop + 11; y++) {
        put(out, rowX0(y - headTop), y, fh);
        put(out, rowX1(y - headTop), y, fh);
      }
    }
  }
  if (a.facialHair === 'mustache' || a.facialHair === 'goatee') {
    for (let x = cx - 3; x <= cx + 2; x++) put(out, x, headTop + 13, fh);
    put(out, cx - 3, headTop + 14, fh);
    put(out, cx + 2, headTop + 14, fh);
  }
  if (a.facialHair === 'goatee') {
    for (let y = headTop + 15; y < headTop + headH; y++) {
      for (let x = cx - 2; x <= cx + 1; x++) if (onFace(x, y)) put(out, x, y, fh);
    }
  }

  // ---- face ----
  // Eyes (closed and squeezed when shouting in celebration)
  const eye = EYE_HEX[a.eyeColor];
  const squint = pose === 'arms_up' || pose === 'ear_cup' || pose === 'fists';
  const eyeY = headTop + 8;
  if (squint) {
    for (const x of [cx - 6, cx - 5, cx - 4, cx + 3, cx + 4, cx + 5]) put(out, x, eyeY + 1, shade(skin, -0.5));
    put(out, cx - 6, eyeY, shade(skin, -0.35));
    put(out, cx + 5, eyeY, shade(skin, -0.35));
  } else {
    put(out, cx - 6, eyeY, WHITE);
    put(out, cx - 5, eyeY, eye);
    put(out, cx - 4, eyeY, eye);
    put(out, cx - 6, eyeY + 1, WHITE);
    put(out, cx - 5, eyeY + 1, shade(eye, -0.5));
    put(out, cx - 4, eyeY + 1, shade(eye, -0.5));
    put(out, cx + 3, eyeY, eye);
    put(out, cx + 4, eyeY, eye);
    put(out, cx + 5, eyeY, WHITE);
    put(out, cx + 3, eyeY + 1, shade(eye, -0.5));
    put(out, cx + 4, eyeY + 1, shade(eye, -0.5));
    put(out, cx + 5, eyeY + 1, WHITE);
    put(out, cx - 4, eyeY, shade(eye, 0.45)); // catch-light
    put(out, cx + 3, eyeY, shade(eye, 0.45));
  }
  // Eyebrows
  const brow = luminance(hair) > 0.55 ? shade(hair, -0.4) : hair;
  const browY = headTop + 6;
  const browLen = a.brows === 'thin' ? 3 : 4;
  for (let i = 0; i < browLen; i++) {
    put(out, cx - 3 - i, browY, brow);
    put(out, cx + 2 + i, browY, brow);
  }
  if (a.brows === 'thick') {
    for (let i = 0; i < 4; i++) {
      put(out, cx - 3 - i, browY - 1, brow);
      put(out, cx + 2 + i, browY - 1, brow);
    }
  }
  if (celebrating) {
    // Frown of effort: inner brow ends drop one pixel
    put(out, cx - 3, browY + 1, brow);
    put(out, cx + 2, browY + 1, brow);
  }
  // Nose
  const noseDark = shade(skin, -0.24);
  const noseHi = shade(skin, 0.14);
  if (a.nose === 'small') {
    put(out, cx, headTop + 11, noseDark);
  } else if (a.nose === 'medium') {
    put(out, cx, headTop + 10, noseDark);
    put(out, cx, headTop + 11, noseDark);
    put(out, cx - 1, headTop + 10, noseHi);
    put(out, cx - 1, headTop + 12, noseDark);
  } else {
    for (const y of [9, 10, 11]) put(out, cx, headTop + y, noseDark);
    put(out, cx - 1, headTop + 9, noseHi);
    put(out, cx - 1, headTop + 10, noseHi);
    for (let x = cx - 2; x <= cx + 1; x++) put(out, x, headTop + 12, noseDark);
  }
  // Mouth: open shout when celebrating
  if (celebrating) {
    for (let y = headTop + 13; y <= headTop + 16; y++) {
      const w = y === headTop + 13 || y === headTop + 16 ? 2 : 4;
      for (let x = cx - w / 2; x < cx + w / 2; x++) put(out, x, y, MOUTH_OPEN);
    }
    put(out, cx - 1, headTop + 14, WHITE);
    put(out, cx, headTop + 14, WHITE);
    put(out, cx - 1, headTop + 16, '#c4534a');
  } else {
    for (let x = cx - 2; x <= cx + 1; x++) put(out, x, headTop + 14, MOUTH);
    put(out, cx - 3, headTop + 13, shade(skin, -0.2));
    put(out, cx + 2, headTop + 13, shade(skin, -0.2));
  }

  // ---- hair in front ----
  const front = new Layer(hair);
  const dome = (ry: number, clipRow: number, extra = 1) => front.ellipse(cx - 0.5, headTop + 7, maxW / 2 + extra, ry, headTop + clipRow);
  const sideburns = (to: number) => {
    for (let y = headTop + 5; y <= headTop + to; y++) {
      front.set(rowX0(y - headTop), y);
      front.set(rowX1(y - headTop), y);
    }
  };
  switch (a.hairStyle) {
    case 'short':
      dome(9, 4);
      sideburns(8);
      for (let x = rowX0(5); x < cx + 1; x++) if (x % 2 === 0) front.set(x, headTop + 5);
      break;
    case 'sidepart':
      dome(10, 4);
      sideburns(8);
      for (let x = cx - 4; x <= rowX1(5); x++) front.set(x, headTop + 5);
      front.ellipse(cx + 3, headTop - 2, 5, 2.5);
      break;
    case 'spiky':
      dome(8, 4);
      sideburns(7);
      for (let x = rowX0(0) - 3, k = 0; x <= rowX1(0) + 3; x += 3, k++) {
        const h = k % 2 ? 4 : 3;
        for (let i = 0; i < h; i++) {
          front.set(x, headTop - 1 - i);
          if (i < h - 1) front.set(x + 1, headTop - 1 - i);
        }
      }
      break;
    case 'buzz':
      dome(8, 3, 0);
      break;
    case 'curly':
      dome(11, 5, 2);
      sideburns(8);
      for (let x = rowX0(0) - 3; x <= rowX1(0) + 3; x += 3) front.ellipse(x, headTop - 3, 1.6, 1.6);
      for (let x = rowX0(6) + 1; x < rowX1(6); x += 4) front.set(x, headTop + 6);
      break;
    case 'afro':
      dome(10, 4, 2);
      break;
    case 'long':
      dome(10, 4, 1);
      for (let y = headTop + 5; y <= headTop + headH; y++) {
        for (const x of [rowX0(5) - 1, rowX0(5), rowX1(5), rowX1(5) + 1]) front.set(x, y);
      }
      break;
    case 'dreads':
      dome(10, 3, 1);
      for (let x = rowX0(4); x <= rowX1(4); x += 3) {
        front.set(x, headTop + 4);
        front.set(x, headTop + 5);
      }
      sideburns(12);
      break;
    case 'bun':
      dome(8, 4, 0);
      sideburns(7);
      front.ellipse(cx - 0.5, headTop - 4, 4, 3.5);
      break;
    case 'mohawk':
      front.rect(cx - 2, headTop - 6, 4, 10);
      front.unset(cx - 2, headTop - 6);
      front.unset(cx + 1, headTop - 6);
      break;
    case 'bald':
      break;
  }
  // Buzzed sides for mohawk, very short hair for buzz
  if (a.hairStyle === 'buzz' || a.hairStyle === 'mohawk') {
    const fuzz = mix(skin, hair, a.hairStyle === 'buzz' ? 0.62 : 0.3);
    for (let y = headTop - 1; y <= headTop + 3; y++) {
      for (let x = rowX0(0) - 3; x <= rowX1(0) + 3; x++) {
        const dx = (x - cx + 0.5) / (maxW / 2 + 0.5);
        const dy = (y - headTop - 7) / 8;
        if (dx * dx + dy * dy <= 1 && !front.has(x, y)) put(out, x, y, (x + y) % 2 ? fuzz : shade(fuzz, -0.08));
      }
    }
  }
  front.paint(out);
  // Hair texture: strands and shine
  const shine = shade(hair, 0.32);
  const strand = shade(hair, -0.28);
  for (const p of front.px) {
    const x = p % AVATAR_W;
    const y = (p - x) / AVATAR_W;
    if ((a.hairStyle === 'curly' || a.hairStyle === 'afro') && (x * 3 + y * 2) % 7 === 0) put(out, x, y, strand);
    else if (a.hairStyle === 'dreads' && y % 3 === 0) put(out, x, y, strand);
    else if (x < cx - 1 && y === headTop - 1 + ((x + 1) % 2) && a.hairStyle !== 'mohawk') put(out, x, y, shine);
  }
  if (a.hairStyle === 'afro' || a.hairStyle === 'curly') {
    for (const p of back.px) {
      const x = p % AVATAR_W;
      const y = (p - x) / AVATAR_W;
      if ((x * 3 + y * 2) % 7 === 0 && out[p] === back.color) put(out, x, y, shade(hair, -0.32));
    }
  }
  if (a.hairStyle === 'sidepart') {
    for (let y = headTop - 1; y <= headTop + 2; y++) put(out, cx - 4, y, shade(hair, 0.45));
  }
  if (a.hairStyle === 'bald') {
    put(out, cx - 4, headTop + 2, shade(skin, 0.3));
    put(out, cx - 3, headTop + 1, shade(skin, 0.3));
  }
  if (a.hairStyle === 'bun') {
    for (let x = cx - 3; x <= cx + 2; x++) put(out, x, headTop - 1, shade(hair, -0.4));
  }

  // ---- headband ----
  if (a.accessory === 'headband') {
    const band = new Layer(WHITE, 0.5);
    for (const y of [headTop + 3, headTop + 4]) band.rect(rowX0(y - headTop) - 1, y, headRows[y - headTop] + 2, 1);
    band.paint(out);
    put(out, cx - 1, headTop + 3, kit);
    put(out, cx, headTop + 3, kit);
  }

  // ---- arms ----
  const torsoL = tl;
  const torsoR = tl + L.torsoW - 1;
  const sy = L.torsoTop + 2;
  const hang = L.torsoTop + L.torsoLen + 2;
  type Pt = [number, number];
  const leftDown: Pt[] = [[torsoL - L.limb / 2 + 1, sy], [torsoL - L.limb / 2 - 0.5, sy + 10], [torsoL - L.limb / 2 - 1, hang]];
  const mirror = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [2 * cx - 1 - x, y]);
  let left: Pt[] = leftDown;
  let right: Pt[] = mirror(leftDown);
  const shoulderL: Pt = [torsoL - L.limb / 2 + 1, sy];
  let fingerUp = false;
  let thumbUp = false;
  let ball: { x: number; y: number; r: number; front: boolean } | null = null;
  switch (pose) {
    case 'hands_hips':
      left = [shoulderL, [shoulderL[0] - 6, sy + 8], [torsoL + 1, L.legTop - 3]];
      right = mirror(left);
      break;
    case 'arms_crossed':
      left = [shoulderL, [torsoL - 1, sy + 10], [cx + 5, sy + 8]];
      right = mirror([shoulderL, [torsoL - 1, sy + 12], [cx + 5, sy + 11]]);
      break;
    case 'ball_arm':
      ball = { x: torsoR + 7, y: L.legTop - 1, r: 6.5, front: false };
      right = [[torsoR + L.limb / 2, sy], [torsoR + 5, sy + 8], [torsoR + 8, L.legTop - 8]];
      break;
    case 'thumbs_up':
      right = mirror([shoulderL, [shoulderL[0] - 4, sy + 10], [shoulderL[0] + 2, sy + 3]]);
      thumbUp = true;
      break;
    case 'ball_foot':
      ball = { x: cx + 1 + L.legW + 7, y: L.ground - 4.5, r: 5.5, front: true };
      left = [shoulderL, [shoulderL[0] - 6, sy + 8], [torsoL + 1, L.legTop - 3]];
      right = mirror(left);
      break;
    case 'arms_up':
      left = [shoulderL, [shoulderL[0] - 6, sy - 8], [shoulderL[0] - 10, sy - 17]];
      right = mirror(left);
      break;
    case 'point_sky':
      right = mirror([shoulderL, [shoulderL[0] - 1, sy - 9], [shoulderL[0] - 1, sy - 18]]);
      fingerUp = true;
      break;
    case 'ear_cup':
      left = [shoulderL, [shoulderL[0] - 7, sy - 5], [rowX0(9) - 4, headTop + 9]];
      right = mirror(left);
      break;
    case 'fists':
      left = [shoulderL, [shoulderL[0] - 5, sy + 8], [shoulderL[0] - 6, sy - 3]];
      right = mirror(left);
      break;
    default:
      break;
  }
  // Ball: a white pixel ball with dark patches
  if (ball) {
    const b = new Layer(WHITE, 0.9);
    b.ellipse(ball.x, ball.y, ball.r, ball.r);
    b.paint(out);
    const patch = '#2a2f3a';
    const bx = Math.round(ball.x);
    const by = Math.round(ball.y);
    for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1], [-3, 2], [2, 2], [2, -3], [-3, -3]]) put(out, bx + dx, by + dy, patch);
  }
  // Each arm gets its own layers so crossed arms stay readable.
  const drawArm = (pts: Pt[]) => {
    const sleeve = new Layer(kit);
    const armSkin = new Layer(skin, 0.8);
    const cuffs = new Layer(a.accessory === 'wristbands' ? WHITE : trim, 0.5);
    const segs = pts.slice(1).map((p, i) => {
      const q = pts[i];
      return { a: q, b: p, len: Math.hypot(p[0] - q[0], p[1] - q[1]) };
    });
    const total = segs.reduce((s, g) => s + g.len, 0);
    const sleeveEnd = a.sleeves === 'long' ? total - 3 : Math.min(7, segs[0].len * 0.55);
    let walked = 0;
    const r = L.limb / 2;
    for (const g of segs) {
      const steps = Math.ceil(g.len * 2);
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = g.a[0] + (g.b[0] - g.a[0]) * t;
        const y = g.a[1] + (g.b[1] - g.a[1]) * t;
        const d = walked + g.len * t;
        const isSleeve = d <= sleeveEnd;
        const isBand = (a.accessory === 'wristbands' && d > total - 5 && d <= total - 3) || (a.sleeves === 'long' && d > total - 4.5 && d <= total - 3);
        for (let j = -r; j < r; j++) {
          for (let i = -r; i < r; i++) {
            const px = x + i + 0.5;
            const py = y + j + 0.5;
            if (isBand) {
              cuffs.set(px, py);
              sleeve.unset(px, py);
            } else if (isSleeve) {
              sleeve.set(px, py);
            } else if (!sleeve.has(Math.round(px), Math.round(py)) && !cuffs.has(Math.round(px), Math.round(py))) {
              armSkin.set(px, py);
            }
          }
        }
      }
      walked += g.len;
    }
    // Fist
    const [hx, hy] = pts[pts.length - 1];
    armSkin.rect(Math.round(hx - r - 0.5), Math.round(hy - r), L.limb + 1, L.limb);
    armSkin.paint(out);
    sleeve.paint(out);
    cuffs.paint(out);
    return [hx, hy] as Pt;
  };
  const handL = drawArm(left);
  const handR = drawArm(right);
  // Knuckle lines on fists
  for (const [hx, hy] of [handL, handR]) {
    put(out, hx - 1, hy, shade(skin, -0.25));
    put(out, hx + 1, hy, shade(skin, -0.25));
  }
  if (thumbUp) {
    const [hx, hy] = handR;
    const t = new Layer(skin, 0.6);
    t.rect(Math.round(hx - L.limb / 2), Math.round(hy - L.limb / 2) - 4, 2, 4);
    t.paint(out);
  }
  if (fingerUp) {
    // Open palm raised to the sky: three spread fingers and a thumb (never a single finger).
    const [hx, hy] = handR;
    const top = Math.round(hy - L.limb / 2) - 1;
    const x0 = Math.round(hx - L.limb / 2);
    const f = new Layer(skin, 0.6);
    for (let i = 0; i < 3; i++) f.rect(x0 + i * 2, top - 2, 1, 3);
    f.rect(x0 + L.limb, top + 2, 1, 2);
    f.paint(out);
  }

  // ---- outline around the whole figure ----
  const filled = out.slice();
  for (let y = 0; y < AVATAR_H; y++) {
    for (let x = 0; x < AVATAR_W; x++) {
      if (filled[idx(x, y)]) continue;
      if ((x > 0 && filled[idx(x - 1, y)]) || (x < AVATAR_W - 1 && filled[idx(x + 1, y)]) || (y > 0 && filled[idx(x, y - 1)]) || (y < AVATAR_H - 1 && filled[idx(x, y + 1)])) {
        out[idx(x, y)] = OUTLINE;
      }
    }
  }
  // ---- ground shadow ----
  for (let y = L.ground + 2; y <= L.ground + 3; y++) {
    const half = y === L.ground + 2 ? L.torsoW / 2 + 5 : L.torsoW / 2 + 1;
    for (let x = cx - half; x < cx + half; x++) if (inside(x, y) && !out[idx(x, y)]) out[idx(x, y)] = SHADOW;
  }
  return out;
}

export interface AvatarRect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

/** Same picture as horizontal runs of one colour (few hundred rects). */
export function avatarRects(a: Appearance, kit: string, pose: Pose = 'stand'): AvatarRect[] {
  const px = avatarPixels(a, kit, pose);
  const rects: AvatarRect[] = [];
  for (let y = 0; y < AVATAR_H; y++) {
    let x = 0;
    while (x < AVATAR_W) {
      const c = px[idx(x, y)];
      if (!c) {
        x++;
        continue;
      }
      let end = x + 1;
      while (end < AVATAR_W && px[idx(end, y)] === c) end++;
      rects.push({ x, y, w: end - x, h: 1, color: c });
      x = end;
    }
  }
  return rects;
}

export function drawAvatar(ctx: CanvasRenderingContext2D, a: Appearance, kit: string, x: number, y: number, scale: number, pose: Pose = 'stand'): void {
  for (const r of avatarRects(a, kit, pose)) {
    ctx.fillStyle = r.color;
    ctx.fillRect(x + r.x * scale, y + r.y * scale, r.w * scale, r.h * scale);
  }
}
