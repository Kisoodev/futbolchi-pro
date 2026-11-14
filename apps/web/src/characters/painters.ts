/**
 * Pixel portraits of the story characters (parents, coach), in the same 64×128 grid as the
 * player avatar (feet on row 122), so they stand next to the hero naturally.
 *
 * Father: do'ppi with the white "bodom" pattern, a striped chopon over a white
 * shirt, a belbog' (sash), dark trousers and a grey moustache.
 * Mother: a cream ro'mol with small flowers, gold earrings, a black kamzul with
 * gold trim over an atlas dress with the ikat diamond pattern, hands folded.
 */
export type Painter = (ctx: CanvasRenderingContext2D) => void;

const px = (ctx: CanvasRenderingContext2D, c: string) => (x: number, y: number, w = 1, h = 1) => {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
};

const OUTLINE = '#1b1620';
const SKIN = '#cf9a6e';
const SKIN_SHADE = '#b07d55';
const SKIN_HI = '#e2b48a';

/** A head (rows of widths, centred on x=32) with eyes, brows, nose and mouth. */
function head(ctx: CanvasRenderingContext2D, top: number, rows: number[], smile: boolean) {
  rows.forEach((w, i) => {
    px(ctx, OUTLINE)(32 - w / 2 - 1, top + i, w + 2, 1);
  });
  rows.forEach((w, i) => {
    px(ctx, SKIN)(32 - w / 2, top + i, w, 1);
    px(ctx, SKIN_SHADE)(32 + w / 2 - 2, top + i, 2, 1);
    if (i > 1 && i < rows.length - 3) px(ctx, SKIN_HI)(32 - w / 2, top + i, 1, 1);
  });
  px(ctx, OUTLINE)(32 - rows[rows.length - 1] / 2, top + rows.length, rows[rows.length - 1], 1);
  const ey = top + 8;
  // eyes: white, iris, dark lower half
  for (const x of [26, 35]) {
    px(ctx, '#f4efe6')(x, ey, 3, 2);
    px(ctx, '#3a2418')(x + 1, ey, 2, 1);
    px(ctx, '#140c08')(x + 1, ey + 1, 2, 1);
  }
  const nose = px(ctx, SKIN_SHADE);
  nose(32, top + 10, 1, 2);
  nose(31, top + 12, 2, 1);
  if (smile) {
    px(ctx, '#9c4a44')(30, top + 14, 4, 1);
    px(ctx, '#9c4a44')(29, top + 13, 1, 1);
    px(ctx, '#9c4a44')(34, top + 13, 1, 1);
  } else {
    px(ctx, '#8e4a40')(30, top + 15, 4, 1);
  }
}

// ---------------------------------------------------------------- father
export const paintFather: Painter = (ctx) => {
  const P = (c: string) => px(ctx, c);
  const top = 22;
  // shoes and trousers
  P(OUTLINE)(20, 117, 11, 6);
  P(OUTLINE)(33, 117, 11, 6);
  P('#26232a')(21, 118, 9, 4);
  P('#26232a')(34, 118, 9, 4);
  P('#3c3a44')(22, 118, 3, 1);
  P(OUTLINE)(22, 92, 21, 26);
  P('#2f2d36')(23, 92, 8, 25);
  P('#2f2d36')(34, 92, 8, 25);
  P('#3d3b46')(24, 93, 2, 22);
  // chopon: striped robe from the shoulders to below the knees
  const robeTop = 45;
  const robeBottom = 104;
  for (let y = robeTop; y <= robeBottom; y++) {
    const spread = y < robeTop + 3 ? y - robeTop : 3 + Math.floor((y - robeTop) / 20);
    const x0 = 17 - spread + (y < robeTop + 3 ? 3 : 0);
    const x1 = 47 + spread - (y < robeTop + 3 ? 3 : 0);
    P(OUTLINE)(x0 - 1, y, x1 - x0 + 3, 1);
    for (let x = x0; x <= x1; x++) {
      const k = (x + 64) % 7;
      const c = k < 3 ? '#253a78' : k < 5 ? '#2f6f80' : k === 5 ? '#d8c69c' : '#1c2a5a';
      P(y > robeBottom - 2 ? '#1c2a5a' : c)(x, y, 1, 1);
    }
  }
  // open front: white shirt and the belbog'
  for (let y = robeTop + 1; y < robeBottom; y++) {
    const half = y < 60 ? 4 : y < 80 ? 5 : 6;
    P('#efe8da')(32 - half, y, half * 2, 1);
  }
  P('#d8d0c0')(36, robeTop + 2, 1, 40);
  P('#9b958a')(32, 50, 1, 1);
  P('#9b958a')(32, 56, 1, 1);
  P('#9b958a')(32, 62, 1, 1);
  P('#5a3b2a')(20, 72, 25, 6);
  P('#74503a')(20, 72, 25, 1);
  P('#4a2f20')(29, 78, 4, 10);
  P('#4a2f20')(33, 78, 3, 7);
  // sleeves and hands
  for (const [x, dir] of [[11, -1], [47, 1]] as const) {
    for (let y = 48; y < 86; y++) {
      const w = 6 + (y > 78 ? 1 : 0);
      const xx = dir < 0 ? x - (y > 70 ? 1 : 0) : x + (y > 70 ? 1 : 0);
      P(OUTLINE)(xx - 1, y, w + 2, 1);
      for (let i = 0; i < w; i++) {
        const k = (xx + i + 64) % 7;
        P(k < 3 ? '#253a78' : k < 5 ? '#2f6f80' : k === 5 ? '#d8c69c' : '#1c2a5a')(xx + i, y, 1, 1);
      }
    }
    P('#d8c69c')(dir < 0 ? x - 1 : x + 1, 84, 7, 2);
    P(OUTLINE)(dir < 0 ? x - 1 : x + 1, 86, 7, 7);
    P(SKIN)(dir < 0 ? x : x + 2, 86, 5, 6);
    P(SKIN_SHADE)(dir < 0 ? x + 3 : x + 5, 87, 2, 4);
  }
  // collar and neck
  P(OUTLINE)(27, 38, 10, 7);
  P(SKIN_SHADE)(28, 38, 8, 6);
  P('#efe8da')(27, 43, 10, 3);
  // head
  head(ctx, top, [10, 12, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 12, 12, 10, 8], false);
  // ears
  P(OUTLINE)(23, top + 7, 2, 6);
  P(SKIN)(24, top + 8, 1, 4);
  P(OUTLINE)(40, top + 7, 2, 6);
  P(SKIN_SHADE)(40, top + 8, 1, 4);
  // grey temples and thick brows
  P('#55525a')(24, top + 2, 2, 6);
  P('#55525a')(39, top + 2, 2, 6);
  P('#2a2628')(26, top + 6, 4, 1);
  P('#2a2628')(34, top + 6, 4, 1);
  // moustache
  P('#3a3638')(28, top + 12, 9, 2);
  P('#3a3638')(27, top + 13, 1, 1);
  P('#3a3638')(37, top + 13, 1, 1);
  P('#55525a')(30, top + 12, 4, 1);
  // do'ppi: a black four-sided cap with white "bodom" (almond) motifs
  P(OUTLINE)(22, top - 7, 21, 9);
  P('#141218')(23, top - 6, 19, 8);
  P('#141218')(24, top - 8, 17, 2);
  P(OUTLINE)(24, top - 9, 17, 1);
  for (const x of [25, 31, 37]) {
    P('#f2ede2')(x, top - 4, 3, 1);
    P('#f2ede2')(x + 1, top - 5, 2, 1);
    P('#f2ede2')(x, top - 3, 2, 1);
  }
  P('#f2ede2')(23, top, 19, 1);
};

// ---------------------------------------------------------------- mother
export const paintMother: Painter = (ctx) => {
  const P = (c: string) => px(ctx, c);
  const top = 30;
  // shoes
  P(OUTLINE)(23, 118, 8, 5);
  P(OUTLINE)(33, 118, 8, 5);
  P('#1f1c22')(24, 119, 6, 3);
  P('#1f1c22')(34, 119, 6, 3);
  // atlas dress with the ikat diamond pattern
  const dressTop = 52;
  const dressBottom = 118;
  for (let y = dressTop; y <= dressBottom; y++) {
    const t = (y - dressTop) / (dressBottom - dressTop);
    const half = Math.round(13 + t * 4);
    P(OUTLINE)(32 - half - 1, y, half * 2 + 2, 1);
    for (let x = 32 - half; x < 32 + half; x++) {
      const u = (((x - 32 + 64) % 10) + 10) % 10;
      const v = (y + 2) % 14;
      const d = Math.abs(u - 5) + Math.abs(v - 7) * 0.72;
      const c = d < 1.6 ? '#d39a2e' : d < 3 ? '#e6d2a6' : d < 4.2 ? '#7a1f2e' : d < 5 ? '#e6d2a6' : '#7a1f2e';
      P(c)(x, y, 1, 1);
    }
  }
  P('#5c1622')(18, dressBottom, 28, 1);
  // kamzul (black velvet vest) with gold trim and curls
  for (let y = dressTop; y < 96; y++) {
    const half = y < 70 ? 13 : 14;
    P('#1d1a22')(32 - half, y, half - 3, 1);
    P('#1d1a22')(35, y, half - 3, 1);
    P('#d4a640')(32 - 4, y, 1, 1);
    P('#d4a640')(35, y, 1, 1);
  }
  P('#d4a640')(19, 95, 10, 1);
  P('#d4a640')(35, 95, 10, 1);
  for (const [x, y] of [[22, 60], [23, 67], [21, 75], [23, 84], [40, 60], [39, 67], [41, 75], [39, 84]]) {
    P('#d4a640')(x, y, 2, 1);
    P('#d4a640')(x + (x < 32 ? 1 : -1), y + 1, 1, 2);
  }
  // sleeves bending to hands folded in front
  for (const side of [-1, 1]) {
    for (let y = 54; y < 80; y++) {
      const x = side < 0 ? 15 + Math.max(0, y - 70) : 43 - Math.max(0, y - 70);
      P(OUTLINE)(x - 1, y, 8, 1);
      P(y % 6 < 3 ? '#7a1f2e' : '#8f2a3a')(x, y, 6, 1);
    }
  }
  P(OUTLINE)(23, 78, 18, 7);
  P('#8f2a3a')(24, 78, 6, 5);
  P('#8f2a3a')(34, 78, 6, 5);
  P(SKIN)(28, 79, 8, 5);
  P(SKIN_SHADE)(28, 82, 8, 1);
  P(SKIN_HI)(29, 79, 3, 1);
  // neck
  P(SKIN_SHADE)(29, 47, 6, 5);
  // ro'mol: the scarf covers the hair and falls behind the right shoulder
  P(OUTLINE)(21, top - 6, 23, 24);
  P('#efe6d2')(22, top - 5, 21, 22);
  P(OUTLINE)(40, top + 14, 8, 22);
  P('#e5dac2')(41, top + 14, 6, 21);
  // face
  head(ctx, top, [10, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 10, 10, 8], true);
  // scarf edge over the forehead and the sides of the face
  P('#efe6d2')(25, top - 1, 14, 3);
  P('#efe6d2')(24, top + 2, 2, 12);
  P('#efe6d2')(38, top + 2, 2, 12);
  // flowers on the scarf
  for (const [x, y, c] of [
    [24, top - 3, '#8c2a3a'], [30, top - 4, '#3e7a4a'], [36, top - 3, '#8c2a3a'], [41, top + 1, '#8c2a3a'],
    [23, top + 8, '#3e7a4a'], [43, top + 18, '#8c2a3a'], [44, top + 26, '#3e7a4a'], [27, top - 2, '#3e7a4a'],
  ] as const) {
    P(c)(x, y, 2, 1);
    P(c)(x, y + 1, 1, 1);
  }
  // dark hair line and gold earrings
  P('#2a1c18')(26, top + 2, 12, 1);
  P('#d9a632')(25, top + 12, 1, 2);
  P('#d9a632')(39, top + 12, 1, 2);
  // brows
  P('#2a1c18')(26, top + 6, 3, 1);
  P('#2a1c18')(35, top + 6, 3, 1);
};

/** A pair of old football boots (the gift in the turning-point scene). */
export const paintBoots: Painter = (ctx) => {
  const P = (c: string) => px(ctx, c);
  for (const x of [0, 9]) {
    P(OUTLINE)(x, 2, 9, 6);
    P('#2b2622')(x + 1, 3, 7, 4);
    P('#f0ece2')(x + 2, 4, 4, 1);
    P('#d8d2c4')(x + 1, 6, 7, 1);
  }
  P('#c8b89a')(3, 0, 1, 3);
  P('#c8b89a')(12, 0, 1, 3);
};

/** Sports bag carried on the shoulder. */
export const paintBag: Painter = (ctx) => {
  const P = (c: string) => px(ctx, c);
  P(OUTLINE)(0, 4, 22, 12);
  P('#2b4a7a')(1, 5, 20, 10);
  P('#3a64a0')(1, 5, 20, 2);
  P('#f2c84b')(3, 9, 16, 1);
  P(OUTLINE)(8, 0, 1, 5);
  P(OUTLINE)(14, 0, 1, 5);
};

// ---------------------------------------------------------------- coach
/**
 * Coach Rustam Sobirov of the Yulduz academy (a fictional character): bald
 * with short grey sides, a grey stubble beard, a dark suit over a black shirt,
 * the academy's gold star on the chest, a whistle and a clipboard.
 */
export const paintCoach: Painter = (ctx) => {
  const P = (c: string) => px(ctx, c);
  const top = 20;
  const SUIT = '#2a2a31';
  const SUIT_HI = '#3a3a44';
  const SUIT_LO = '#1e1e24';
  // shoes and trousers
  P(OUTLINE)(20, 117, 11, 6);
  P(OUTLINE)(33, 117, 11, 6);
  P('#18171b')(21, 118, 9, 4);
  P('#18171b')(34, 118, 9, 4);
  P('#3a3940')(22, 118, 3, 1);
  P(OUTLINE)(22, 88, 21, 30);
  P(SUIT)(23, 88, 8, 29);
  P(SUIT)(34, 88, 8, 29);
  P(SUIT_HI)(24, 90, 1, 26);
  P(SUIT_LO)(30, 92, 1, 25);
  // jacket
  for (let y = 44; y <= 92; y++) {
    const inset = y < 47 ? 47 - y : 0;
    const x0 = 17 + inset;
    const x1 = 47 - inset;
    P(OUTLINE)(x0 - 1, y, x1 - x0 + 3, 1);
    P(SUIT)(x0, y, x1 - x0 + 1, 1);
    P(SUIT_HI)(x0, y, 1, 1);
    P(SUIT_LO)(x1, y, 1, 1);
  }
  // black shirt in the V of the lapels
  for (let y = 44; y < 66; y++) {
    const half = Math.max(1, Math.round(5 - (y - 44) / 5));
    P('#111114')(32 - half, y, half * 2, 1);
    P(SUIT_HI)(32 - half - 1, y, 1, 1);
    P(SUIT_HI)(32 + half, y, 1, 1);
  }
  P(SUIT_LO)(32, 66, 1, 26);
  P('#4a4a54')(31, 72, 1, 1);
  P('#4a4a54')(31, 80, 1, 1);
  // gold academy star on the chest and a whistle on a blue cord
  P('#f2c84b')(39, 52, 3, 1);
  P('#f2c84b')(40, 51, 1, 3);
  P('#2f78b7')(29, 44, 1, 10);
  P('#2f78b7')(35, 44, 1, 10);
  P('#c9ced4')(30, 54, 4, 2);
  P('#8e959c')(33, 55, 1, 1);
  // arms; the left hand (screen right) holds a clipboard
  for (const x of [11, 48]) {
    for (let y = 47; y < 86; y++) {
      P(OUTLINE)(x - 1, y, 7, 1);
      P(y % 9 === 0 ? SUIT_HI : SUIT)(x, y, 5, 1);
    }
    P(OUTLINE)(x - 1, 86, 7, 6);
    P(SKIN)(x, 86, 5, 5);
    P(SKIN_SHADE)(x + 3, 87, 2, 3);
  }
  P(OUTLINE)(49, 76, 13, 19);
  P('#8a6a44')(50, 77, 11, 17);
  P('#f2efe6')(51, 79, 9, 13);
  P('#9aa3ad')(52, 81, 7, 1);
  P('#9aa3ad')(52, 84, 6, 1);
  P('#9aa3ad')(52, 87, 7, 1);
  P('#c9ced4')(53, 76, 5, 2);
  // neck
  P(OUTLINE)(27, 37, 10, 8);
  P(SKIN_SHADE)(28, 37, 8, 7);
  // bald head
  head(ctx, top, [10, 12, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 12, 12, 10, 8], false);
  P(SKIN_HI)(27, top + 1, 4, 1);
  P(SKIN_HI)(26, top + 2, 2, 1);
  // ears and short grey sides
  P(OUTLINE)(23, top + 7, 2, 6);
  P(SKIN)(24, top + 8, 1, 4);
  P(OUTLINE)(40, top + 7, 2, 6);
  P(SKIN_SHADE)(40, top + 8, 1, 4);
  P('#8d8a86')(24, top + 4, 2, 4);
  P('#8d8a86')(39, top + 4, 2, 4);
  // heavy brows
  P('#4e4a46')(26, top + 6, 4, 1);
  P('#4e4a46')(34, top + 6, 4, 1);
  P('#4e4a46')(29, top + 7, 1, 1);
  P('#4e4a46')(34, top + 7, 1, 1);
  // grey stubble beard and moustache (dotted so the skin shows through)
  const rows = [10, 12, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 12, 12, 10, 8];
  for (let i = 11; i < rows.length; i++) {
    const w = rows[i];
    for (let x = 32 - w / 2; x < 32 + w / 2; x++) {
      if ((x + i) % 2 === 0 || i > 14) P(i > 15 ? '#6f6a65' : '#8a847e')(x, top + i, 1, 1);
    }
  }
  P('#7a746e')(29, top + 12, 7, 1);
  P('#8e4a40')(30, top + 14, 4, 1);
};
