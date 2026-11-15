/**
 * Coach Usmoxan Kapadze (docs/CHARACTERS.md §1), drawn at double resolution
 * (128×256, feet on row 244) so the face carries his aura: a lean, hard,
 * angular face, thick low brows always slightly furrowed over deep-set,
 * almost black eyes, a thin mouth pressed shut, a short black goatee with a
 * day's stubble, short neat hair combed back — and the thin old scar through
 * his left eyebrow, his signature. A cold rim light from behind.
 *
 * Two outfits: training (navy tracksuit zipped to the top, arms crossed, a big
 * silver watch) and match day (long black puffer with a COACH patch and the
 * academy crest, white shirt and black tie, the tablet in his hand). He never
 * uses a whistle.
 */
import type { Painter } from './painters';

const W = 128;
const H = 256;
type Pt = [number, number];

/** A small pixel canvas with crisp shapes (no anti-aliasing). */
class Pic {
  readonly px: (string | null)[] = new Array(W * H).fill(null);
  set(x: number, y: number, c: string) {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && x < W && y >= 0 && y < H) this.px[y * W + x] = c;
  }
  get(x: number, y: number) {
    return x >= 0 && x < W && y >= 0 && y < H ? this.px[y * W + x] : null;
  }
  rect(x: number, y: number, w: number, h: number, c: string) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  /** Even-odd scanline fill, sampled at pixel centres. */
  poly(pts: Pt[], c: string, keep?: (x: number, y: number) => boolean) {
    const ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const yc = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) if (!keep || keep(x, y)) this.set(x, y, c);
    }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: string) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
  }
  /** Recolours only pixels that already have colour `only`. */
  tint(pts: Pt[], c: string, only: string[]) {
    this.poly(pts, c, (x, y) => only.includes(this.get(x, y) ?? ''));
  }
  /** A dark outline around the figure and a cold rim light on its right edge. */
  finish(outline: string, rim: string) {
    const filled = this.px.slice();
    const f = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H && !!filled[y * W + x];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (f(x, y)) {
          if (!f(x + 1, y) && filled[y * W + x] !== outline) this.px[y * W + x] = mixHex(filled[y * W + x]!, rim, 0.45);
          continue;
        }
        if (f(x - 1, y) || f(x + 1, y) || f(x, y - 1) || f(x, y + 1)) this.px[y * W + x] = outline;
      }
  }
  paint(ctx: CanvasRenderingContext2D) {
    for (let i = 0; i < this.px.length; i++) {
      const c = this.px[i];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(i % W, Math.floor(i / W), 1, 1);
    }
  }
}

function mixHex(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const x = p(a);
  const y = p(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

const OUTLINE = '#120e14';
const RIM = '#9cc2ea';
// weathered, sun-tanned skin
const SK = '#b67d55';
const SK_LT = '#cd9468';
const SK_HI = '#dcaa7e';
const SK_DK = '#94603e';
const SK_DK2 = '#73452b';
const HAIR = '#141217';
const HAIR_LT = '#33303a';
const SCAR = '#d7a587';
const LIP = '#8a4c3c';
const LIP_DK = '#4f2620';

/** Mirror an x around the centre line (between 63 and 64). */
const mx = (x: number) => 127 - x;
const mirrorPts = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [mx(x), y]);

/** The head (both outfits). */
function head(p: Pic) {
  // neck in the jaw's shadow
  p.poly([[56, 70], [72, 70], [73, 88], [55, 88]], SK_DK);
  p.poly([[56, 70], [62, 70], [61, 88], [55, 88]], SK);
  // ears
  for (const [x, flip] of [[48, false], [79, true]] as const) {
    p.ellipse(x + 0.5, 57, 2.4, 5, flip ? SK_DK : SK);
    p.set(x + (flip ? 0 : 1), 55, SK_DK2);
    p.set(x + (flip ? 0 : 1), 56, SK_DK2);
    p.set(x + (flip ? 0 : 1), 58, SK_DK2);
  }
  // the face: lean, high cheekbones, a defined jaw, narrow chin
  const face: Pt[] = [[51.5, 37], [76.5, 37], [78.5, 45], [79, 53], [78, 61], [75.5, 68], [71.5, 73.5], [67, 77.5], [61, 77.5], [56.5, 73.5], [52.5, 68], [50, 61], [49, 53], [49.5, 45]];
  p.poly(face, SK);
  // light from the front-left: the right side of the face in shadow, a sharp jaw line
  p.tint([[71, 37], [78.5, 45], [79, 53], [78, 61], [75.5, 68], [71.5, 73.5], [67, 77.5], [65, 77.5], [70, 70], [73, 62], [74, 52], [73, 44]], SK_DK, [SK]);
  p.tint([[75, 58], [78, 61], [75.5, 68], [71.5, 73.5], [67, 77.5], [66, 77.5], [71, 71], [73.5, 64]], SK_DK2, [SK_DK]);
  // forehead and cheekbone highlights
  p.tint([[55, 40], [63, 39], [62, 46], [55, 46]], SK_LT, [SK]);
  p.tint([[50, 55], [56, 56], [56, 59], [50, 59]], SK_HI, [SK]);
  p.tint([[71, 56], [75, 56], [75, 58], [71, 58]], SK, [SK_DK]);
  // hollow under the cheekbones
  p.line(51, 62, 56, 67, SK_DK);
  p.line(52, 62, 57, 67, SK_DK);
  p.line(76, 62, 72, 67, SK_DK2);
  // a faint forehead line (he is 44)
  p.line(56, 44, 70, 44, mixHex(SK, SK_DK, 0.6));

  // stubble on the cheeks, jaw and around the goatee
  for (let y = 61; y <= 77; y++)
    for (let x = 49; x <= 79; x++) {
      const c = p.get(x, y);
      // a scattered (hashed) pattern, so it reads as stubble and not as stripes
      const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      if ((c === SK || c === SK_DK || c === SK_DK2 || c === SK_HI) && h % 7 < 2) p.set(x, y, mixHex(c, HAIR, 0.35));
    }

  // short neat black hair, combed back; short sides
  p.poly([[48, 50], [47.5, 41], [50, 34], [56, 29.5], [64, 28.5], [72, 29.5], [78, 34], [80.5, 41], [80, 50], [78.5, 43], [76, 39.5], [70, 37.5], [64, 37], [57, 37.5], [52, 39.5], [49.5, 43]], HAIR);
  // receding a little at the temples
  p.poly([[51, 38.5], [54.5, 37.5], [52.5, 41.5]], SK);
  p.poly([[77, 38.5], [73.5, 37.5], [75.5, 41.5]], SK_DK);
  // combed-back strands catch the light
  for (const [x0, y0] of [[54, 33], [58, 31], [62, 30], [66, 30]] as const) p.line(x0, y0, x0 + 4, y0 + 4, HAIR_LT);
  // faded sides: hair mixed with skin
  for (let y = 44; y <= 54; y++) {
    for (const x of [48, 49]) if ((x + y) % 2 === 0) p.set(x, y, mixHex(SK, HAIR, 0.7));
    for (const x of [79, 80]) if ((x + y) % 2 === 0) p.set(x, y, mixHex(SK_DK, HAIR, 0.7));
  }

  // deep-set eyes: dark sockets under the brow ridge
  p.poly([[52, 52], [62, 52], [62, 55], [53, 55]], SK_DK);
  p.poly(mirrorPts([[52, 52], [62, 52], [62, 55], [53, 55]]), SK_DK2);
  // eyes: a heavy upper lid, a sliver of white, almost black irises
  for (const side of [0, 1]) {
    const X = (x: number) => (side ? mx(x) : x);
    p.line(X(54), 54, X(60), 54, '#24161a');
    for (const x of [55, 56, 59, 60]) p.set(X(x), 55, '#d8cdbf');
    p.set(X(57), 55, '#1a1113');
    p.set(X(58), 55, '#1a1113');
    p.set(X(57), 56, '#2b1d1b');
    p.set(X(58), 56, '#2b1d1b');
    p.set(X(56), 56, '#c4b6a7');
    p.set(X(59), 56, '#c4b6a7');
    p.set(X(57), 54, '#2a1a1c');
    p.set(X(58), 55, '#6b5f5c'); // a cold catch-light
    p.line(X(55), 57, X(60), 57, side ? SK_DK2 : SK_DK); // lower lid
    p.line(X(56), 58, X(59), 58, mixHex(side ? SK_DK : SK, SK_DK2, 0.5)); // tired bags
  }
  // thick, low brows, always a little furrowed (inner ends lower and close)
  const brow: Pt[] = [[51.5, 50.5], [55, 48], [60, 48.5], [62.5, 50.5], [62.5, 52.5], [58, 51.5], [53, 52]];
  p.poly(brow, HAIR);
  p.poly(mirrorPts(brow), HAIR);
  p.line(53, 49, 58, 48.5, HAIR_LT);
  // the frown between the brows
  p.line(62, 50, 62, 53, SK_DK2);
  p.line(65, 50, 65, 53, SK_DK2);
  // the scar through his left eyebrow (our right): a thin pale cut, the brow broken by it
  p.line(72, 45, 69, 57, SCAR);
  p.line(73, 45, 70, 57, mixHex(SCAR, SK_DK, 0.4));
  p.set(71, 51, SCAR);
  p.set(70, 52, SCAR);

  // a long straight nose: lit bridge, shadowed side, nostrils
  p.line(63, 55, 63, 62, SK_LT);
  p.line(65, 54, 65, 63, SK_DK);
  p.line(66, 56, 66, 63, SK_DK2);
  p.rect(61, 63, 5, 1, SK_LT);
  p.set(62, 62, SK_HI);
  p.rect(61, 65, 6, 1, SK_DK);
  p.set(60, 65, SK_DK2);
  p.set(61, 65, SK_DK2);
  p.set(66, 65, SK_DK2);
  p.set(67, 65, SK_DK2);
  p.set(59, 63, SK_DK);
  p.set(59, 64, SK_DK);
  p.set(68, 63, SK_DK2);
  p.set(68, 64, SK_DK2);
  // lines from the nose to the mouth
  p.line(59, 66, 57, 71, SK_DK);
  p.line(69, 66, 71, 71, SK_DK2);

  // short goatee and moustache, joined at the corners of the mouth
  p.rect(59, 66, 10, 2, HAIR);
  p.set(58, 67, HAIR);
  p.set(69, 67, HAIR);
  p.line(58, 68, 59, 72, HAIR);
  p.line(69, 68, 68, 72, HAIR);
  p.poly([[59.5, 71], [68.5, 71], [68, 76], [65.5, 78.5], [62.5, 78.5], [60, 76]], HAIR);
  p.line(61, 73, 61, 76, HAIR_LT);
  // thin lips, pressed shut, the corners a little down
  p.rect(60, 68, 8, 1, mixHex(LIP, SK_DK, 0.5));
  p.rect(60, 69, 8, 1, LIP_DK);
  p.set(59, 70, LIP_DK);
  p.set(68, 70, LIP_DK);
  p.rect(62, 70, 4, 1, mixHex(LIP, SK, 0.6));
}

// ------------------------------------------------------------------ training: navy tracksuit, arms crossed
const JK = '#1c2b54';
const JK_LT = '#2c4178';
const JK_DK = '#111b38';
const PANTS = '#151c33';

export const paintCoachTraining: Painter = (ctx) => {
  const p = new Pic();
  // trousers and black trainers with white soles
  p.poly([[42, 180], [63, 180], [62, 237], [46, 237]], PANTS);
  p.poly([[65, 180], [86, 180], [82, 237], [66, 237]], mixHex(PANTS, '#000000', 0.25));
  p.line(48, 190, 50, 234, '#202a48');
  p.poly([[44, 236], [62, 236], [63, 243], [39, 243], [40, 239]], '#121317');
  p.poly([[66, 236], [83, 236], [88, 239], [89, 243], [65, 243]], '#121317');
  p.rect(39, 243, 25, 2, '#e6e6df');
  p.rect(65, 243, 25, 2, '#d4d4cc');
  // the jacket: broad shoulders, zipped to the top
  p.poly([[36, 98], [41, 89], [54, 84], [74, 84], [87, 89], [92, 98], [92, 168], [89, 182], [39, 182], [36, 168]], JK);
  p.tint([[80, 86], [87, 89], [92, 98], [92, 168], [89, 182], [79, 182], [84, 140]], JK_DK, [JK]);
  p.tint([[37, 98], [41, 90], [44, 90], [41, 170], [37, 168]], JK_LT, [JK]);
  p.rect(39, 176, 50, 6, JK_DK); // waistband
  p.line(64, 86, 64, 181, '#8e98ab'); // zip
  // high collar, closed up to the chin
  p.poly([[51, 77], [77, 77], [78, 90], [64, 93], [50, 90]], JK);
  p.poly([[64, 77], [77, 77], [78, 90], [64, 93]], JK_DK);
  p.line(51, 78, 77, 78, '#0b1228');
  p.rect(63, 82, 3, 4, '#aab3c4'); // zip pull
  // arms crossed: upper arms down the sides
  p.poly([[33, 98], [41, 91], [47, 128], [37, 135], [31, 121]], JK);
  p.poly([[30, 104], [34, 100], [35, 128], [31, 122]], JK_LT);
  p.poly(mirrorPts([[33, 98], [41, 91], [47, 128], [37, 135], [31, 121]]), JK_DK);
  // the forearms folded across the chest (the right one behind, the left one in front)
  p.poly([[92, 121], [94, 132], [47, 139], [43, 129]], JK_DK);
  p.poly([[34, 117], [38, 128], [84, 124], [82, 113]], JK);
  p.line(40, 119, 80, 115, JK_LT);
  p.line(55, 125, 74, 123, JK_DK); // folds
  p.line(46, 126, 52, 125, JK_DK);
  // the right hand resting on the left arm, the left hand tucked under the right arm
  p.poly([[37, 124], [45, 123], [46, 132], [38, 134]], SK);
  p.line(39, 127, 45, 126, SK_DK);
  p.line(39, 130, 45, 129, SK_DK);
  p.poly([[83, 113], [89, 115], [89, 123], [84, 122]], SK_DK);
  // the big silver watch on the left wrist
  p.poly([[75, 112], [81, 111.5], [82, 123], [76, 123.5]], '#c9d0d8');
  p.poly([[76.5, 114], [80.5, 113.5], [81, 121], [77, 121.5]], '#eef2f6');
  p.line(78, 115, 79, 118, '#4b525d');
  p.set(77, 113, '#ffffff');
  p.line(75, 112, 75, 123, '#7c8591');
  // a small academy crest on the chest
  p.poly([[72, 98], [79, 98], [79, 103], [75.5, 106], [72, 103]], '#e0b545');
  p.poly([[73, 99], [78, 99], [78, 102.5], [75.5, 104.5], [73, 102.5]], '#1c2b54');
  p.line(75.5, 100, 75.5, 103, '#e0b545');
  head(p);
  p.finish(OUTLINE, RIM);
  p.paint(ctx);
};

// ------------------------------------------------------------------ match day: long black puffer, tie, tablet
const PF = '#1f2228';
const PF_LT = '#353a44';
const PF_DK = '#121418';

/** Tiny 3×5 letters for the COACH patch. */
const GLYPHS: Record<string, string[]> = {
  C: ['111', '100', '100', '100', '111'],
  O: ['111', '101', '101', '101', '111'],
  A: ['010', '101', '111', '101', '101'],
  H: ['101', '101', '111', '101', '101'],
};

export const paintCoachMatch: Painter = (ctx) => {
  const p = new Pic();
  // black trousers and polished shoes
  p.poly([[44, 200], [63, 200], [62, 237], [47, 237]], '#16181d');
  p.poly([[65, 200], [84, 200], [81, 237], [66, 237]], '#0f1013');
  p.poly([[45, 236], [62, 236], [63, 244], [39, 244], [40, 240]], '#0b0c0e');
  p.poly([[66, 236], [82, 236], [88, 240], [89, 244], [65, 244]], '#0b0c0e');
  p.line(42, 240, 48, 238, '#4a505b');
  p.line(80, 238, 86, 240, '#3a3f48');
  // the hood folded behind the neck
  p.poly([[46, 77], [82, 77], [88, 92], [40, 92]], PF_DK);
  // the long puffer coat, down to the knees
  const coat: Pt[] = [[33, 99], [41, 88], [55, 83], [73, 83], [87, 88], [95, 99], [97, 160], [95, 206], [33, 206], [31, 160]];
  p.poly(coat, PF);
  p.tint([[80, 86], [87, 88], [95, 99], [97, 160], [95, 206], [81, 206], [86, 150]], PF_DK, [PF]);
  // quilted: each band puffs out (a light row on top, a seam below)
  for (let y = 104; y <= 196; y += 13) {
    for (let x = 30; x <= 98; x++) {
      const bend = Math.abs(x - 64) > 24 ? 1 : 0;
      const c = p.get(x, y + bend);
      if (c === PF || c === PF_DK) p.set(x, y + bend, '#0b0c0f');
      const c2 = p.get(x, y - 3 + bend);
      if (c2 === PF) p.set(x, y - 3 + bend, PF_LT);
    }
  }
  // the opening: white shirt and a black tie
  p.poly([[57, 83], [71, 83], [64, 100]], '#e8ebee');
  p.poly([[66, 84], [71, 83], [64, 100]], '#c7ccd2');
  p.rect(62, 84, 5, 3, '#191b20');
  p.poly([[62.5, 87], [65.5, 87], [66.5, 99], [64, 102], [61.5, 99]], '#15171c');
  p.line(64, 102, 64, 205, '#474c56'); // zip
  // COACH patch and the academy crest
  p.rect(39, 105, 23, 9, '#9aa1ab');
  p.rect(40, 106, 21, 7, '#262a32');
  'COACH'.split('').forEach((ch, i) => {
    GLYPHS[ch].forEach((row, r) => row.split('').forEach((b, c) => b === '1' && p.set(41 + i * 4 + c, 107 + r, '#f1f3f5')));
  });
  p.poly([[74, 104], [84, 104], [84, 111], [79, 115], [74, 111]], '#8c939d');
  p.poly([[75, 105], [83, 105], [83, 110.5], [79, 113.5], [75, 110.5]], '#2a2e36');
  p.line(79, 106, 79, 112, '#8c939d');
  p.line(76, 108, 82, 108, '#8c939d');
  // the left arm hangs down (puffy sleeve), the right arm holds the tablet
  p.poly([[31, 99], [40, 92], [44, 132], [42, 152], [31, 153], [27, 130]], PF);
  p.poly([[28, 104], [32, 100], [33, 150], [29, 140]], PF_LT);
  for (const y of [112, 125, 138]) p.line(28, y, 43, y + 1, '#0b0c0f');
  p.poly([[32, 152], [41, 152], [41, 160], [34, 161]], SK);
  p.line(34, 156, 40, 156, SK_DK);
  p.poly([[87, 92], [96, 100], [99, 128], [89, 133]], PF_DK);
  p.poly([[99, 127], [91, 136], [66, 146], [64, 137]], PF);
  p.line(70, 140, 92, 131, PF_LT);
  // the tablet — every player's numbers are on it
  p.poly([[50, 128], [82, 125], [84, 147], [52, 151]], '#3a414c');
  p.poly([[52, 130], [80, 127.5], [82, 145], [54, 148.5]], '#566476');
  p.line(54, 132, 78, 130, '#8fa3ba');
  p.line(55, 136, 70, 135, '#7a8da3');
  p.line(55, 140, 74, 138.5, '#7a8da3');
  p.poly([[78, 136], [86, 133], [88, 142], [80, 145]], SK);
  p.line(80, 139, 86, 137, SK_DK);
  head(p);
  p.finish(OUTLINE, RIM);
  p.paint(ctx);
};
