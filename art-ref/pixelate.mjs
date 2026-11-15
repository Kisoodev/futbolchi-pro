/**
 * Reference → pixel sprite (the "codixel" way: pixelate the reference picture
 * instead of drawing from imagination).
 *
 *   node art-ref/pixelate.mjs
 *
 * Reads the coach references in art-ref/, masks the background, samples the
 * figure into a 128×256 sprite (feet on row 244, like every person sprite at
 * double resolution), keeps the largest figure, reduces it to a small palette,
 * adds a dark outline and writes apps/web/src/characters/coachSprites.ts.
 *
 * Windows: the JPEGs are decoded with System.Drawing (art-ref/decode.ps1).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const W = 128;
const H = 256;

function decode(name) {
  const raw = join(tmpdir(), `${name}.raw`);
  if (!existsSync(raw)) {
    const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(here, 'decode.ps1'), '-In', join(here, `${name}.jpg`), '-Out', raw], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('decode failed');
  }
  const buf = readFileSync(raw);
  const w = buf.readInt32LE(0);
  const h = buf.readInt32LE(4);
  const stride = buf.readInt32LE(8);
  const src = new Uint8Array(w * h * 4); // RGBA
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = 12 + y * stride + x * 4;
      const d = (y * w + x) * 4;
      src[d] = buf[s + 2];
      src[d + 1] = buf[s + 1];
      src[d + 2] = buf[s];
      src[d + 3] = 255;
    }
  return { W: w, H: h, src };
}

/** Background = light, low-saturation (and grass) pixels reachable from the crop border. */
function mask(img, crop, opts = {}) {
  const { W: iw, src } = img;
  const [cx0, cy0, cx1, cy1] = crop;
  const cw = cx1 - cx0;
  const ch = cy1 - cy0;
  const bg = new Uint8Array(cw * ch);
  const isBg = (si) => {
    const r = src[si], g = src[si + 1], b = src[si + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if ((r + g + b) / 3 > (opts.bgLight ?? 175) && mx - mn < (opts.bgSat ?? 70)) return true;
    return !!opts.grass && g > r + 12 && g > b + 5;
  };
  const stack = [];
  for (let i = 0; i < cw; i++) stack.push(i, 0, i, ch - 1);
  for (let j = 0; j < ch; j++) stack.push(0, j, cw - 1, j);
  while (stack.length) {
    const j = stack.pop();
    const i = stack.pop();
    if (i < 0 || j < 0 || i >= cw || j >= ch) continue;
    const k = j * cw + i;
    if (bg[k] || !isBg(((cy0 + j) * iw + (cx0 + i)) * 4)) continue;
    bg[k] = 1;
    stack.push(i + 1, j, i - 1, j, i, j + 1, i, j - 1);
  }
  return { ...img, bg, cx0, cy0, cw, ch };
}

function bbox(m) {
  let x0 = 1e9, y0 = 1e9, x1 = 0, y1 = 0;
  for (let j = 0; j < m.ch; j++)
    for (let i = 0; i < m.cw; i++)
      if (!m.bg[j * m.cw + i]) {
        x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j);
      }
  return { x0: x0 + m.cx0, x1: x1 + m.cx0, y0: y0 + m.cy0, y1: y1 + m.cy0 };
}

/** Target rows [ty0, ty1) ← source rows [sy0, sy1); horizontal scale sxTop → sxBottom; srcCx lands on dstCx. */
function sample(bands, alphaCut = 0.5) {
  const out = new Array(W * H).fill(null);
  for (const b of bands) {
    const m = b.m;
    for (let ty = b.ty0; ty < b.ty1; ty++) {
      const t0 = (ty - b.ty0) / (b.ty1 - b.ty0);
      const t1 = (ty + 1 - b.ty0) / (b.ty1 - b.ty0);
      const sy0 = b.sy0 + (b.sy1 - b.sy0) * t0;
      const sy1 = b.sy0 + (b.sy1 - b.sy0) * t1;
      const sx = b.sxTop + (b.sxBottom - b.sxTop) * ((t0 + t1) / 2);
      for (let tx = 0; tx < W; tx++) {
        const sx0 = b.srcCx + (tx - b.dstCx) / sx;
        const sx1 = b.srcCx + (tx + 1 - b.dstCx) / sx;
        let n = 0, fg = 0, r = 0, g = 0, bl = 0;
        for (let j = Math.floor(sy0); j < Math.ceil(sy1); j++)
          for (let i = Math.floor(sx0); i < Math.ceil(sx1); i++) {
            n++;
            const ci = i - m.cx0, cj = j - m.cy0;
            if (ci < 0 || cj < 0 || ci >= m.cw || cj >= m.ch || m.bg[cj * m.cw + ci]) continue;
            fg++;
            const si = (j * m.W + i) * 4;
            r += m.src[si]; g += m.src[si + 1]; bl += m.src[si + 2];
          }
        if (n && fg / n >= alphaCut) out[ty * W + tx] = [r / fg, g / fg, bl / fg];
      }
    }
  }
  return out;
}

function largestPart(out) {
  const seen = new Int32Array(W * H).fill(-1);
  let best = -1, bestN = 0, id = 0;
  for (let k = 0; k < W * H; k++) {
    if (!out[k] || seen[k] >= 0) continue;
    let n = 0;
    const st = [k];
    seen[k] = id;
    while (st.length) {
      const q = st.pop();
      n++;
      const x = q % W, y = (q - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const nk = ny * W + nx;
        if (out[nk] && seen[nk] < 0) { seen[nk] = id; st.push(nk); }
      }
    }
    if (n > bestN) { bestN = n; best = id; }
    id++;
  }
  return out.map((p, k) => (p && seen[k] === best ? p : null));
}

function quantize(out, K) {
  const pts = out.filter(Boolean);
  let cent = pts
    .slice()
    .sort((a, b) => a[0] + a[1] + a[2] - b[0] - b[1] - b[2])
    .filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length / K)) === 0)
    .slice(0, K)
    .map((p) => p.slice());
  const near = (p) => {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < cent.length; i++) {
      const q = cent[i];
      const d = (p[0] - q[0]) ** 2 * 0.3 + (p[1] - q[1]) ** 2 * 0.59 + (p[2] - q[2]) ** 2 * 0.11;
      if (d < bd) { bd = d; bi = i; }
    }
    return bi;
  };
  for (let it = 0; it < 14; it++) {
    const sum = cent.map(() => [0, 0, 0, 0]);
    for (const p of pts) { const i = near(p); sum[i][0] += p[0]; sum[i][1] += p[1]; sum[i][2] += p[2]; sum[i][3]++; }
    cent = cent.map((q, i) => (sum[i][3] ? [sum[i][0] / sum[i][3], sum[i][1] / sum[i][3], sum[i][2] / sum[i][3]] : q));
  }
  const hex = (p) => '#' + p.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  return { palette: cent.map(hex), data: out.map((p) => (p ? near(p) : -1)) };
}

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function outline(res, color = '#120e14') {
  const idx = res.palette.push(color) - 1;
  const d = res.data.slice();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (res.data[y * W + x] >= 0) continue;
      if (N4.some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < W && ny < H && res.data[ny * W + nx] >= 0; })) d[y * W + x] = idx;
    }
  res.data = d;
  return idx;
}

/** Front-facing trainers (black, white soles) under the legs, replacing what the back view gave. */
function trainers(res, OUT) {
  const yRef = 232;
  const spans = [];
  let st = -1;
  for (let x = 0; x <= W; x++) {
    const v = x < W ? res.data[yRef * W + x] : -1;
    const on = v >= 0 && v !== OUT;
    if (on && st < 0) st = x;
    if (!on && st >= 0) { spans.push([st, x - 1]); st = -1; }
  }
  for (let y = 233; y < H; y++) for (let x = 0; x < W; x++) res.data[y * W + x] = -1;
  const add = (c) => res.palette.push(c) - 1;
  const BLK = add('#17181d'), BLK2 = add('#2a2c33'), SOLE = add('#e7e6df'), SOLE2 = add('#b9b8b0');
  spans.forEach(([a, b], i) => {
    const o = i === 0 ? -1 : 1; // toes point a little outwards
    for (let y = 233; y <= 241; y++) {
      const grow = y >= 237 ? 2 : 1;
      for (let x = a - (o < 0 ? grow : 0); x <= b + (o > 0 ? grow : 0); x++) res.data[y * W + x] = y === 234 ? BLK2 : BLK;
    }
    for (let x = a - (o < 0 ? 2 : 0); x <= b + (o > 0 ? 2 : 0); x++) {
      res.data[242 * W + x] = SOLE;
      res.data[243 * W + x] = SOLE2;
    }
  });
  for (let y = 232; y < 247; y++)
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      if (res.data[k] >= 0) continue;
      if (N4.some(([dx, dy]) => { const v = res.data[(y + dy) * W + x + dx]; return v >= 0 && v !== OUT; })) res.data[k] = OUT;
    }
}

/** Palette + run-length rows: "index-in-base36[count]" runs separated by commas, "." = transparent. */
function encode(res) {
  const rows = [];
  for (let y = 0; y < H; y++) {
    const parts = [];
    let x = 0;
    while (x < W) {
      const v = res.data[y * W + x];
      let n = 1;
      while (x + n < W && res.data[y * W + x + n] === v) n++;
      const sym = v < 0 ? '.' : v.toString(36);
      parts.push(n > 1 ? `${sym}*${n}` : sym);
      x += n;
    }
    rows.push(parts.join(','));
  }
  // trim empty rows at the top (the decoder starts at `top`)
  let top = 0;
  while (top < rows.length && rows[top] === `.*${W}`) top++;
  return { palette: res.palette, top, rows: rows.slice(top) };
}

// ------------------------------------------------------------------ match day (full-body reference)
const matchImg = decode('coach-match');
const m = mask(matchImg, [230, 190, 960, 1925]);
const b = bbox(m);
const s = 216 / (b.y1 - b.y0 + 1);
const match = quantize(largestPart(sample([{ m, ty0: 28, ty1: 245, sy0: b.y0, sy1: b.y0 + 217 / s, sxTop: s, sxBottom: s, srcCx: (b.x0 + b.x1) / 2, dstCx: 64 }])), 30);
outline(match);

// ------------------------------------------------------------------ training (front to the thighs + legs of the back view)
const trainImg = decode('coach-training');
const front = mask(trainImg, [90, 300, 1130, 2000], { grass: true, bgLight: 165, bgSat: 60 });
const back = mask(trainImg, [1150, 560, 1900, 1950], { grass: true, bgLight: 165, bgSat: 60 });
const fs_ = 0.106;
const training = quantize(
  largestPart(
    sample([
      { m: front, ty0: 28, ty1: 74, sy0: 365, sy1: 799, sxTop: fs_, sxBottom: fs_, srcCx: 600, dstCx: 64 },
      { m: front, ty0: 74, ty1: 150, sy0: 799, sy1: 1716, sxTop: fs_, sxBottom: fs_ * 0.96, srcCx: 600, dstCx: 64 },
      { m: front, ty0: 150, ty1: 182, sy0: 1716, sy1: 2000, sxTop: fs_ * 0.95, sxBottom: 0.092, srcCx: 603, dstCx: 64 },
      { m: back, ty0: 182, ty1: 245, sy0: 1560, sy1: 1880, sxTop: 0.125, sxBottom: 0.125, srcCx: 1500, dstCx: 64 },
    ]),
  ),
  30,
);
trainers(training, outline(training));

const out = `/**
 * Coach Usmoxan Kapadze as pixel sprites (128×256, feet on row 244), made from
 * the character-sheet references in art-ref/ by art-ref/pixelate.mjs —
 * generated, do not edit by hand.
 */
export interface SpriteData {
  palette: string[];
  /** First row of \`rows\` in the sprite. */
  top: number;
  /** Run-length rows: comma-separated runs "c" or "c*n" (c = palette index in base 36, "." = transparent). */
  rows: string[];
}

export const COACH_MATCH: SpriteData = ${JSON.stringify(encode(match))};

export const COACH_TRAINING: SpriteData = ${JSON.stringify(encode(training))};
`;
writeFileSync(join(here, '..', 'apps', 'web', 'src', 'characters', 'coachSprites.ts'), out);
console.log('written coachSprites.ts', out.length, 'bytes');
