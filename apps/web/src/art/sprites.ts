/**
 * Tiny pixel-art sprites, defined as character grids. Each character maps to a
 * palette colour; '.' is transparent. Rendered as SVG (UI) or onto a canvas
 * (share card), so the art stays crisp at any size.
 */
export interface Sprite {
  grid: readonly string[];
  palette: Record<string, string>;
}

export const CLOUD: Sprite = {
  grid: [
    '........WWWW..........',
    '......WWWWWWWW..WWW...',
    '.....WWWWWWWWWWWWWWW..',
    '...WWWWWWWWWWWWWWWWWW.',
    '.WWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWWWWWWWS',
    '.SSWWWWWWWWWWWWWWWSSS.',
    '...SSSSSSSSSSSSSSSS...',
  ],
  palette: { W: '#ffffff', S: '#d6ebf8' },
};

export const BALL: Sprite = {
  grid: [
    '....KKKK....',
    '..KKWWWWKK..',
    '.KWWWWWWWWK.',
    '.KWWWKKWWWK.',
    'KWWWKKKKWWWK',
    'KKWWKKKKWWKK',
    'KKKWWKKWWKKK',
    'KWWWWWWWWWGK',
    'KWWWWWWWWWGK',
    '.KKWWWWWWKK.',
    '..KKKWWKKK..',
    '....KKKK....',
  ],
  palette: { K: '#12324f', W: '#ffffff', G: '#c9dced' },
};

/** Seamless horizontal tile. */
export const GRASS: Sprite = {
  grid: [
    '.........L......',
    '....L....L......',
    '.L..L....L..L...',
    '.L..LL..LL..L.L.',
    'LLLLLLLLLLLLLLLL',
    'GGGGGGGGGGGGGGGG',
    'GGLGGGGGGGGGLGGG',
    'GGGGGGGLGGGGGGGG',
    'GGGGGGGGGGGGGGGG',
    'DGGGGDGGGGGDGGGG',
    'DDDDDDDDDDDDDDDD',
    'DDDDDDDDDDDDDDDD',
  ],
  palette: { L: '#7fd146', G: '#5cb82e', D: '#4a9a24' },
};

export const spriteSize = (s: Sprite) => ({ w: Math.max(...s.grid.map((r) => r.length)), h: s.grid.length });

/** Horizontal runs of one colour — fewer rects than one per pixel. */
export function spriteRuns(s: Sprite): { x: number; y: number; w: number; color: string }[] {
  const out: { x: number; y: number; w: number; color: string }[] = [];
  s.grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      const color = s.palette[ch];
      if (color) out.push({ x, y, w: end - x, color });
      x = end;
    }
  });
  return out;
}

export function spriteSvg(s: Sprite): string {
  const { w, h } = spriteSize(s);
  const rects = spriteRuns(s)
    .map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${r.color}"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${rects}</svg>`;
}

export const spriteDataUri = (s: Sprite): string => `url("data:image/svg+xml,${encodeURIComponent(spriteSvg(s))}")`;

export function drawSprite(ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number, scale: number): void {
  for (const r of spriteRuns(s)) {
    ctx.fillStyle = r.color;
    ctx.fillRect(x + r.x * scale, y + r.y * scale, r.w * scale, scale);
  }
}
