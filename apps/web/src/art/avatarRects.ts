/**
 * Pixel avatar built from the persona's appearance. Pure: returns rectangles
 * on a 32×48 grid, drawn as SVG in the UI and onto the canvas share card.
 */
import { constants as C, type Appearance, type HairColor, type HeadShape, type SkinTone } from '@futbolchi/engine';

export const AVATAR_W = 32;
export const AVATAR_H = 48;

export const SKIN_HEX: Record<SkinTone, string> = { light: '#f6d2b0', medium: '#e0ac7e', tan: '#b97f52', dark: '#7a4e30' };
export const HAIR_HEX: Record<HairColor, string> = {
  black: '#1d1a1a',
  brown: '#5b3a21',
  blonde: '#e2b64a',
  red: '#b5462a',
  gray: '#8c949c',
  white: '#eef1f4',
};

const INK = '#12324f';
const MOUTH = '#8f3b2e';

/** Width of each head row, top to bottom. */
const HEAD_ROWS: Record<HeadShape, number[]> = {
  round: [6, 8, 10, 10, 10, 10, 10, 8, 6],
  oval: [6, 8, 8, 8, 8, 8, 8, 8, 6, 4],
  square: [10, 10, 10, 10, 10, 10, 10, 10, 8],
};

export interface AvatarRect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

export function avatarRects(a: Appearance, kit: string): AvatarRect[] {
  const out: AvatarRect[] = [];
  const add = (x: number, y: number, w: number, h: number, color: string) => out.push({ x, y, w, h, color });

  const cx = 16;
  const ground = 46;
  const th = (a.heightCm - C.HEIGHT_MIN_CM) / (C.HEIGHT_MAX_CM - C.HEIGHT_MIN_CM);
  const tw = (a.weightKg - C.WEIGHT_MIN_KG) / (C.WEIGHT_MAX_KG - C.WEIGHT_MIN_KG);
  const legs = Math.round(10 + 6 * th);
  const torsoLen = Math.round(9 + 3 * th);
  const torsoW = 2 * Math.round((8 + 4 * tw) / 2); // 8, 10 or 12
  const legW = (torsoW - 2) / 2;
  const skin = SKIN_HEX[a.skinTone];
  const hair = HAIR_HEX[a.hairColor];

  const legTop = ground - legs;
  const torsoTop = legTop - torsoLen;
  const rows = HEAD_ROWS[a.headShape];
  const headTop = torsoTop - 1 - rows.length;
  const left = cx - torsoW / 2;

  // Legs, shorts, socks, boots
  for (const lx of [left, cx + 1]) {
    add(lx, legTop, legW, legs - 2, skin);
    add(lx, ground - 5, legW, 3, kit);
  }
  add(left, legTop, torsoW, 4, INK);
  add(left - 1, ground - 2, legW + 1, 2, INK);
  add(cx + 1, ground - 2, legW + 1, 2, INK);

  // Arms (sleeve + skin), shirt
  for (const ax of [left - 2, left + torsoW]) {
    add(ax, torsoTop, 2, 3, kit);
    add(ax, torsoTop + 3, 2, torsoLen - 4, skin);
  }
  add(left, torsoTop, torsoW, torsoLen, kit);
  add(cx - 2, torsoTop, 4, 1, '#ffffff'); // collar

  // Neck and head
  add(cx - 2, torsoTop - 1, 4, 1, skin);
  rows.forEach((w, i) => add(cx - w / 2, headTop + i, w, 1, skin));

  // Hair
  const maxW = Math.max(...rows);
  const hairRows = (count: number, extra = 0) => {
    for (let i = 0; i < count; i++) add(cx - rows[i] / 2 - extra / 2, headTop + i, rows[i] + extra, 1, hair);
  };
  switch (a.hairStyle) {
    case 'bald':
      break;
    case 'buzz':
      hairRows(2);
      break;
    case 'short':
      add(cx - rows[0] / 2, headTop - 1, rows[0], 1, hair);
      hairRows(3);
      break;
    case 'curly':
      for (let x = cx - rows[0] / 2; x < cx + rows[0] / 2; x += 2) add(x, headTop - 3, 1, 1, hair);
      add(cx - rows[0] / 2, headTop - 2, rows[0], 1, hair);
      add(cx - rows[0] / 2 - 1, headTop - 1, rows[0] + 2, 1, hair);
      hairRows(3, 2);
      break;
    case 'long':
      add(cx - rows[0] / 2, headTop - 1, rows[0], 1, hair);
      hairRows(3);
      add(cx - maxW / 2 - 1, headTop + 1, 1, rows.length + 2, hair);
      add(cx + maxW / 2, headTop + 1, 1, rows.length + 2, hair);
      break;
    case 'mohawk':
      add(cx - 1, headTop - 3, 2, 5, hair);
      break;
  }

  // Face
  add(cx - 3, headTop + 4, 1, 1, INK);
  add(cx + 2, headTop + 4, 1, 1, INK);
  add(cx - 1, headTop + 6, 2, 1, MOUTH);
  return out;
}

export function drawAvatar(ctx: CanvasRenderingContext2D, a: Appearance, kit: string, x: number, y: number, scale: number): void {
  for (const r of avatarRects(a, kit)) {
    ctx.fillStyle = r.color;
    ctx.fillRect(x + r.x * scale, y + r.y * scale, r.w * scale, r.h * scale);
  }
}
