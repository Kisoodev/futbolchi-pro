import { clubKit, type Club, type Kit } from '@futbolchi/engine';
/**
 * Kit colours for the 2D pitch. Club colours are kept as-is everywhere else,
 * but on the bright grass a green/teal kit disappears, and two similar kits
 * are hard to tell apart — so the replay swaps in a light or dark kit.
 */
export const LIGHT_KIT = '#f4f8fb';
export const DARK_KIT = '#12324f';

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** Green or teal hue with enough saturation to blend into the pitch. */
export function isGrassLike(hex: string): boolean {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (max === 0 || d / max < 0.25) return false;
  let hue: number;
  if (max === r) hue = 60 * (((g - b) / d) % 6);
  else if (max === g) hue = 60 * ((b - r) / d + 2);
  else hue = 60 * ((r - g) / d + 4);
  if (hue < 0) hue += 360;
  return hue >= 70 && hue <= 190;
}

const distance = (a: string, b: string): number => {
  const [x, y] = [rgb(a), rgb(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

export const MIN_KIT_DISTANCE = 110;

export function kitColors(homeColor: string, awayColor: string): { home: string; away: string } {
  const home = isGrassLike(homeColor) ? LIGHT_KIT : homeColor;
  let away = isGrassLike(awayColor) ? LIGHT_KIT : awayColor;
  if (distance(home, away) < MIN_KIT_DISTANCE) away = distance(home, LIGHT_KIT) >= MIN_KIT_DISTANCE ? LIGHT_KIT : DARK_KIT;
  return { home, away };
}

/** Outline that reads on both the kit and the grass. */
export function kitStroke(kit: string): string {
  const [r, g, b] = rgb(kit);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 170 ? DARK_KIT : '#ffffff';
}

// ---------------------------------------------------------------- full kits (docs/LEAGUE.md)

/** The away side's change kits: white or dark, in the club's own trim colour. */
const changeKit = (k: Kit, light: boolean): Kit =>
  light
    ? { shirt: LIGHT_KIT, secondary: k.shirt, shorts: LIGHT_KIT, socks: LIGHT_KIT, pattern: 'trim' }
    : { shirt: DARK_KIT, secondary: k.shirt, shorts: DARK_KIT, socks: DARK_KIT, pattern: 'trim' };

/**
 * A green shirt vanishes on the grass: a striped / hooped / halved kit still
 * reads (its other colour), a plain one is worn in its secondary colour with
 * the green as trim — still the club's own colours.
 */
function onGrass(k: Kit): Kit {
  if (!isGrassLike(k.shirt)) return k;
  if (['stripes', 'hoops', 'halves'].includes(k.pattern) && !isGrassLike(k.secondary)) return k;
  return isGrassLike(k.secondary) ? changeKit(k, true) : { ...k, shirt: k.secondary, secondary: k.shirt, pattern: 'trim' };
}

/** Both teams' kits for a match: the away side changes when the shirts clash (or vanish on the grass). */
export function matchKits(home: Club, away: Club): { home: Kit; away: Kit } {
  let h = clubKit(home);
  let a = clubKit(away);
  h = onGrass(h);
  a = onGrass(a);
  if (distance(h.shirt, a.shirt) < MIN_KIT_DISTANCE) {
    const white = changeKit(a, true);
    a = distance(h.shirt, white.shirt) >= MIN_KIT_DISTANCE ? white : changeKit(a, false);
  }
  return { home: h, away: a };
}

/** Paints a small shirt (x, y, w, h) with the kit's pattern. */
export function paintShirt(ctx: CanvasRenderingContext2D, k: Kit, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = k.shirt;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = k.secondary;
  const u = Math.max(1, w / 7);
  switch (k.pattern) {
    case 'stripes':
      for (let sx = x + u; sx < x + w - u / 2; sx += u * 2) ctx.fillRect(sx, y, u, h);
      break;
    case 'hoops':
      for (let sy = y + h / 5; sy < y + h; sy += (h / 5) * 2) ctx.fillRect(x, sy, w, h / 5);
      break;
    case 'band':
      ctx.fillRect(x, y + h * 0.3, w, h * 0.22);
      break;
    case 'shoulders':
      ctx.fillRect(x, y, w, h * 0.25);
      break;
    case 'halves':
      ctx.fillRect(x + w / 2, y, w / 2, h);
      break;
    case 'collar':
      ctx.fillRect(x + w * 0.3, y, w * 0.4, Math.max(1, h * 0.12));
      break;
    case 'trim':
      ctx.fillRect(x, y + h - Math.max(1, h * 0.1), w, Math.max(1, h * 0.1));
      ctx.fillRect(x + w * 0.3, y, w * 0.4, Math.max(1, h * 0.1));
      break;
    default:
      break;
  }
}
