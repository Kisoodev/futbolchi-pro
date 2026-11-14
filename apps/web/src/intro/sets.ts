/**
 * Set pieces for the intro: an Uzbek mahalla courtyard (hovli) with a carved
 * darvoza, a grape trellis (ishkom), a so'ri with a gilam; a home interior with
 * tokcha niches, lagan plates, a dastarxon with a choynak, piyolas and non; and
 * the academy gate and pitch. All drawn with plain rectangles, deterministically.
 */
import { hash, type Paint } from './stage';

type C = CanvasRenderingContext2D;
const R = (ctx: C, c: string, x: number, y: number, w: number, h: number) => {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

/** Mixes two #rrggbb colours (u = 0 → a, 1 → b). Used for day/night tints. */
export function mixHex(a: string, b: string, u: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - u) + ((pb >> s) & 255) * u);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

// ---------------------------------------------------------------- sky and light
export function sky(p: Paint, top: string, bottom: string) {
  p.screen();
  const g = p.ctx.createLinearGradient(0, 0, 0, p.bh);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  p.ctx.fillStyle = g;
  p.ctx.fillRect(0, 0, p.bw, p.bh);
}

export function stars(p: Paint, alpha = 1) {
  p.world(0.06);
  for (let i = 0; i < 140; i++) {
    const x = -700 + hash(i * 3) * 1400;
    const y = -160 + hash(i * 3 + 1) * 120;
    const tw = 0.5 + 0.5 * Math.sin(p.t / 400 + i);
    p.ctx.globalAlpha = alpha * (0.35 + 0.65 * tw * hash(i * 3 + 2));
    R(p.ctx, '#fdf6d8', x, y, 1, 1);
  }
  p.ctx.globalAlpha = 1;
}

/** Crescent moon (also a quiet nod to the flag). */
export function moon(p: Paint, x: number, y: number, night = '#0d1630') {
  p.world(0.08);
  const ctx = p.ctx;
  ctx.fillStyle = '#fbf1c4';
  ctx.beginPath();
  ctx.arc(x, y, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = night;
  ctx.beginPath();
  ctx.arc(x + 5, y - 3, 10, 0, Math.PI * 2);
  ctx.fill();
}

/** Additive warm light pool (a bulb, a window, a phone screen). */
export function glow(p: Paint, x: number, y: number, r: number, color: string, strength = 0.6) {
  p.world(1);
  const ctx = p.ctx;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = strength;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** Darkens the edges of the frame for a filmic look. */
export function vignette(p: Paint, strength = 0.55) {
  p.screen();
  const ctx = p.ctx;
  const g = ctx.createRadialGradient(p.bw / 2, p.bh / 2, Math.min(p.bw, p.bh) * 0.3, p.bw / 2, p.bh / 2, Math.max(p.bw, p.bh) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, p.bw, p.bh);
}

/** Tints the whole frame (night blue, dawn orange…). */
export function tint(p: Paint, color: string, alpha: number) {
  p.screen();
  p.ctx.globalAlpha = alpha;
  R(p.ctx, color, 0, 0, p.bw, p.bh);
  p.ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- the mahalla
/** Distant flat roofs, a chinar and a blue-domed mosque against the sky. */
export function skyline(p: Paint, color: string, dome: string) {
  p.world(0.3);
  const ctx = p.ctx;
  const base = -62;
  for (let i = -12; i < 12; i++) {
    const w = 40 + hash(i + 50) * 40;
    const h = 14 + hash(i + 80) * 26;
    R(ctx, color, i * 60, base - h, w, h + 90);
  }
  // a blue dome and a minaret
  ctx.fillStyle = dome;
  ctx.beginPath();
  ctx.arc(120, base - 38, 20, Math.PI, 0);
  ctx.fill();
  R(ctx, color, 98, base - 38, 44, 60);
  R(ctx, color, 152, base - 80, 7, 110);
  R(ctx, dome, 151, base - 86, 9, 6);
  // chinar (plane tree) crowns
  for (const [x, y, r] of [[-170, base - 40, 30], [-145, base - 62, 22], [-118, base - 36, 24], [260, base - 36, 26]] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  R(ctx, color, -150, base - 26, 7, 60);
}

/** The courtyard's clay-brick wall with a darvoza (carved double gate). */
export function hovliWall(p: Paint, light: number) {
  p.world(1);
  const ctx = p.ctx;
  const brick = mixHex('#3a2c26', '#c69c72', light);
  const mortar = mixHex('#2a201c', '#a98260', light);
  R(ctx, brick, -700, -104, 1400, 104);
  for (let y = -104; y < 0; y += 6) {
    R(ctx, mortar, -700, y, 1400, 1);
    for (let x = -700 + ((y / 6) % 2 ? 0 : 6); x < 700; x += 12) R(ctx, mortar, x, y, 1, 6);
  }
  R(ctx, mixHex('#2a201c', '#8a6646', light), -700, -108, 1400, 5);
  // darvoza on the right
  const dx = 95;
  const wood = mixHex('#14303a', '#2f7d8c', light);
  const woodDark = mixHex('#0c1f26', '#215a66', light);
  const carve = mixHex('#2a4a52', '#7cc2c9', light);
  R(ctx, woodDark, dx - 4, -112, 78, 112);
  ctx.fillStyle = woodDark;
  ctx.beginPath();
  ctx.arc(dx + 35, -112, 39, Math.PI, 0);
  ctx.fill();
  R(ctx, wood, dx, -108, 34, 108);
  R(ctx, wood, dx + 36, -108, 34, 108);
  for (const x0 of [dx, dx + 36]) {
    for (let k = 0; k < 4; k++) {
      const y0 = -102 + k * 26;
      R(ctx, woodDark, x0 + 5, y0, 24, 20);
      R(ctx, carve, x0 + 9, y0 + 4, 16, 12);
      R(ctx, woodDark, x0 + 13, y0 + 7, 8, 6);
      R(ctx, carve, x0 + 16, y0 + 9, 2, 2);
    }
  }
  R(ctx, mixHex('#5a4a2a', '#d4a640', light), dx + 31, -60, 3, 6);
  R(ctx, mixHex('#5a4a2a', '#d4a640', light), dx + 37, -60, 3, 6);
}

/** Ishkom: wooden posts and a canopy of grape leaves with bunches. */
export function ishkom(p: Paint, light: number, x0 = -300, x1 = 60) {
  p.world(1);
  const ctx = p.ctx;
  const post = mixHex('#2a1c14', '#6e4a2e', light);
  for (let x = x0; x <= x1; x += 90) R(ctx, post, x, -175, 4, 175);
  R(ctx, post, x0, -178, x1 - x0 + 4, 3);
  for (let i = 0; i < 260; i++) {
    const x = x0 - 20 + hash(i * 7) * (x1 - x0 + 40);
    const y = -192 + hash(i * 7 + 1) * 26 + Math.sin(p.t / 900 + i) * 0.6;
    const g = hash(i * 7 + 2);
    R(ctx, mixHex(g < 0.5 ? '#0e2414' : '#163a1c', g < 0.5 ? '#3d8a2e' : '#5aa83a', light), x, y, 5, 4);
  }
  for (let i = 0; i < 9; i++) {
    const x = x0 + 20 + hash(i * 11) * (x1 - x0 - 40);
    const y = -170;
    const grape = mixHex('#1e1430', '#6a3f8a', light);
    for (let k = 0; k < 5; k++) R(ctx, grape, x + (k % 3) * 2, y + Math.floor(k / 2) * 2, 2, 2);
  }
}

/** So'ri (a raised wooden day-bed) with a red gilam and cushions. */
export function sori(p: Paint, x: number, light: number) {
  p.world(1);
  const ctx = p.ctx;
  const wood = mixHex('#2a1a10', '#7a5232', light);
  R(ctx, wood, x, -30, 120, 6);
  for (const lx of [x + 2, x + 114]) R(ctx, wood, lx, -24, 5, 24);
  R(ctx, wood, x, -54, 4, 24);
  R(ctx, wood, x + 116, -54, 4, 24);
  R(ctx, wood, x, -56, 120, 3);
  const red = mixHex('#3a1014', '#a8232e', light);
  const gold = mixHex('#4a3818', '#e2b850', light);
  R(ctx, red, x + 4, -36, 112, 6);
  for (let i = 0; i < 14; i++) R(ctx, gold, x + 8 + i * 8, -34, 4, 2);
  // ko'rpacha cushions
  R(ctx, mixHex('#24183a', '#5a3f8f', light), x + 10, -44, 40, 8);
  R(ctx, mixHex('#3a1c10', '#c4632e', light), x + 64, -44, 40, 8);
}

/** Packed earth of the courtyard, with a little shine near the light. */
export function yard(p: Paint, light: number) {
  p.world(1);
  R(p.ctx, mixHex('#1a1612', '#8a6e50', light), -700, 0, 1400, 200);
  for (let i = 0; i < 120; i++) R(p.ctx, mixHex('#120e0c', '#735a40', light), -700 + hash(i + 900) * 1400, 2 + hash(i + 950) * 70, 3, 1);
}

/** Old metal bucket that the hero uses as a target. */
export function bucket(p: Paint, x: number, light: number) {
  p.world(1);
  R(p.ctx, mixHex('#2a3036', '#8e9aa4', light), x, -16, 16, 16);
  R(p.ctx, mixHex('#3a4248', '#b8c4cc', light), x - 1, -17, 18, 2);
  R(p.ctx, mixHex('#1a1e22', '#5e6a72', light), x + 2, -12, 12, 1);
}

/** Chalk goal drawn on the wall. */
export function chalkGoal(p: Paint, x: number, light: number) {
  p.world(1);
  const c = mixHex('#7a7468', '#f4efe2', light);
  R(p.ctx, c, x, -62, 2, 62);
  R(p.ctx, c, x + 64, -62, 2, 62);
  R(p.ctx, c, x, -62, 66, 2);
}

// ---------------------------------------------------------------- home interior
export function room(p: Paint, warm: number) {
  p.world(1);
  const ctx = p.ctx;
  const wall = mixHex('#2e2a3a', '#e8d9bc', warm);
  R(ctx, wall, -700, -300, 1400, 300);
  R(ctx, mixHex('#24202c', '#cdb894', warm), -700, -36, 1400, 36);
  // gilam on the wall
  const gx = -150;
  R(ctx, mixHex('#3a1014', '#9c1f2a', warm), gx, -230, 130, 150);
  R(ctx, mixHex('#2a0c10', '#6e1420', warm), gx + 6, -224, 118, 138);
  for (let y = 0; y < 6; y++)
    for (let x = 0; x < 5; x++) {
      const cx = gx + 18 + x * 24;
      const cy = -212 + y * 23;
      R(ctx, mixHex('#3a3018', '#e2b850', warm), cx - 1, cy - 5, 3, 11);
      R(ctx, mixHex('#3a3018', '#e2b850', warm), cx - 5, cy - 1, 11, 3);
      R(ctx, mixHex('#10203a', '#2a4f9a', warm), cx, cy, 1, 1);
    }
  // tokcha niches with lagan plates (blue and white)
  for (const nx of [40, 110]) {
    R(ctx, mixHex('#201c28', '#c9b48e', warm), nx, -230, 46, 64);
    ctx.fillStyle = mixHex('#201c28', '#c9b48e', warm);
    ctx.beginPath();
    ctx.arc(nx + 23, -230, 23, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = mixHex('#1a2a4a', '#2f5fae', warm);
    ctx.beginPath();
    ctx.arc(nx + 23, -200, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mixHex('#3a3a44', '#f2efe6', warm);
    ctx.beginPath();
    ctx.arc(nx + 23, -200, 10, 0, Math.PI * 2);
    ctx.fill();
    R(ctx, mixHex('#1a2a4a', '#2f5fae', warm), nx + 21, -206, 4, 12);
    R(ctx, mixHex('#1a2a4a', '#2f5fae', warm), nx + 17, -202, 12, 4);
  }
  // window with the night outside
  R(ctx, mixHex('#1c1a24', '#7a5a3a', warm), 200, -240, 70, 90);
  R(ctx, '#0d1630', 205, -235, 60, 80);
  R(ctx, mixHex('#1c1a24', '#7a5a3a', warm), 233, -235, 3, 80);
  R(ctx, mixHex('#1c1a24', '#7a5a3a', warm), 205, -197, 60, 3);
  R(ctx, '#fbf1c4', 250, -222, 4, 4);
  // floor and ko'rpachalar
  R(ctx, mixHex('#1c1820', '#8a5a3a', warm), -700, 0, 1400, 200);
  for (let i = -8; i < 8; i++) R(ctx, mixHex('#2a1424', i % 2 ? '#8f2a3a' : '#2a5a8f', warm), i * 70, 2, 60, 6);
}

/** Xontaxta (low table) with a dastarxon, a choynak with the cotton pattern, piyolas and non. */
export function dastarxon(p: Paint, x: number, warm: number) {
  p.world(1);
  const ctx = p.ctx;
  R(ctx, mixHex('#2a1a12', '#6e4428', warm), x - 60, -14, 120, 5);
  R(ctx, mixHex('#2a1a12', '#5a3820', warm), x - 56, -9, 4, 9);
  R(ctx, mixHex('#2a1a12', '#5a3820', warm), x + 52, -9, 4, 9);
  R(ctx, mixHex('#3a1c22', '#c23a3a', warm), x - 64, -17, 128, 4);
  for (let i = 0; i < 16; i++) R(ctx, mixHex('#3a3018', '#f2d06a', warm), x - 62 + i * 8, -16, 3, 2);
  // non
  ctx.fillStyle = mixHex('#3a2a18', '#d9a04e', warm);
  ctx.beginPath();
  ctx.ellipse(x - 30, -20, 14, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = mixHex('#2a1e12', '#b07a34', warm);
  ctx.beginPath();
  ctx.ellipse(x - 30, -20, 6, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // choynak (white with the blue cotton-boll pattern)
  const white = mixHex('#3a3a44', '#f4f2ec', warm);
  const blue = mixHex('#14204a', '#2a4f9a', warm);
  R(ctx, white, x + 4, -34, 18, 16);
  R(ctx, white, x + 7, -37, 12, 3);
  R(ctx, blue, x + 11, -40, 4, 3);
  R(ctx, white, x + 22, -30, 6, 3);
  R(ctx, white, x + 26, -33, 3, 3);
  R(ctx, white, x - 2, -31, 6, 8);
  R(ctx, blue, x + 8, -30, 3, 3);
  R(ctx, blue, x + 15, -27, 3, 3);
  R(ctx, blue, x + 11, -24, 3, 3);
  // piyolas
  for (const px of [x + 34, x + 46]) {
    R(ctx, white, px, -22, 8, 5);
    R(ctx, blue, px + 1, -21, 6, 1);
  }
}

// ---------------------------------------------------------------- the academy
export function academy(p: Paint, signText: string) {
  const ctx = p.ctx;
  // pitch behind the fence
  p.world(0.6);
  for (let i = -10; i < 10; i++) R(ctx, i % 2 ? '#3f9a2e' : '#4aa835', i * 50, -60, 50, 60);
  R(ctx, '#f4f8f0', -500, -60, 1000, 1);
  // goal and floodlights
  R(ctx, '#f4f8f0', 140, -84, 2, 26);
  R(ctx, '#f4f8f0', 196, -84, 2, 26);
  R(ctx, '#f4f8f0', 140, -84, 58, 2);
  for (const fx of [-260, 320]) {
    R(ctx, '#7a8590', fx, -220, 4, 160);
    R(ctx, '#d8dee4', fx - 10, -232, 24, 12);
    for (let k = 0; k < 3; k++) R(ctx, '#fff6c4', fx - 8 + k * 8, -229, 5, 6);
  }
  // fence mesh
  p.world(0.85);
  for (let x = -600; x < 600; x += 6) R(ctx, 'rgba(40,52,60,0.35)', x, -110, 1, 110);
  for (let y = -110; y < 0; y += 6) R(ctx, 'rgba(40,52,60,0.35)', -600, y, 1200, 1);
  R(ctx, '#46525c', -600, -112, 1200, 3);
  // gate: two brick pillars and an arch with the sign
  p.world(1);
  for (const gx of [-110, 80]) {
    R(ctx, '#a4583e', gx, -170, 30, 170);
    for (let y = -170; y < 0; y += 6) R(ctx, '#8a4630', gx, y, 30, 1);
    R(ctx, '#c9c1b0', gx - 3, -176, 36, 7);
  }
  R(ctx, '#1d4f8a', -96, -166, 190, 26);
  R(ctx, '#f2c84b', -96, -166, 190, 2);
  R(ctx, '#f2c84b', -96, -142, 190, 2);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 12px "Pixelify Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(signText, -1, -153);
  // ground: pavement in front of the gate
  R(ctx, '#9aa0a2', -700, 0, 1400, 200);
  for (let x = -700; x < 700; x += 20) R(ctx, '#868c8e', x, 0, 1, 200);
  for (let y = 10; y < 200; y += 14) R(ctx, '#868c8e', -700, y, 1400, 1);
}

/** The ball (12 units) with a simple spin highlight. */
export function ball(p: Paint, x: number, y: number, spin = 0) {
  p.world(1);
  const ctx = p.ctx;
  ctx.fillStyle = '#1b1620';
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f6f4ee';
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  const a = spin;
  ctx.fillStyle = '#2a2630';
  R(ctx, '#2a2630', x - 1 + Math.cos(a) * 2, y - 1 + Math.sin(a) * 2, 3, 3);
  R(ctx, '#2a2630', x - 1 - Math.cos(a) * 3, y - 1 - Math.sin(a) * 3, 2, 2);
}

/** Soft shadow under a body or the ball. */
export function shadow(p: Paint, x: number, w: number, alpha = 0.3) {
  p.world(1);
  p.ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  p.ctx.beginPath();
  p.ctx.ellipse(x, 1, w, 3, 0, 0, Math.PI * 2);
  p.ctx.fill();
}

/** A phone in the hero's hand, its screen lighting the face. */
export function phone(p: Paint, x: number, y: number, glowAlpha: number) {
  p.world(1);
  const ctx = p.ctx;
  R(ctx, '#121418', x - 4, y - 7, 8, 13);
  R(ctx, '#3f8ad0', x - 3, y - 6, 6, 10);
  R(ctx, '#f2c84b', x - 2, y - 5, 4, 1);
  glow(p, x, y - 10, 46, '#5aa0e6', glowAlpha);
}
