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
