/**
 * Shareable season card rendered to a 1080×1350 PNG (portrait, social-friendly).
 * Same look as the game: sky, pixel clouds, grass strip.
 * No recording feature here — video highlights are admin-only, later.
 */
import { TIER_NAMES, type Appearance, type SeasonFacts } from '@futbolchi/engine';
import { drawAvatar } from '../art/avatarRects';
import { uz } from '../i18n/uz';
import { BALL, CLOUD, GRASS, drawSprite, spriteSize } from '../art/sprites';

const W = 1080;
const H = 1350;
const PIXEL = "'Pixelify Sans', system-ui, sans-serif";
const BODY = "'Nunito', system-ui, sans-serif";
const C = {
  skyTop: '#4a95dc',
  sky: '#6cabdd',
  skyLight: '#a9d3f0',
  skyPale: '#eaf5fd',
  skyDeep: '#2f78b7',
  ink: '#12324f',
  muted: '#4d6b86',
  cardShadow: '#9cc6e8',
  grass: '#348a18',
  danger: '#c8382b',
};

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Text with a hard pixel drop-shadow. */
function shadowText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string, offset: number) {
  ctx.fillStyle = C.ink;
  ctx.fillText(text, x + offset, y + offset);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

export async function renderShareCard(
  f: SeasonFacts,
  story: string,
  clubColor: string,
  appearance?: Appearance,
): Promise<HTMLCanvasElement> {
  // Canvas text only uses web fonts that are already loaded.
  await Promise.all([
    document.fonts.load(`700 100px ${PIXEL}`),
    document.fonts.load(`700 38px ${BODY}`),
    document.fonts.load(`600 36px ${BODY}`),
  ]).catch(() => undefined);

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Sky
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C.skyTop);
  g.addColorStop(0.45, C.sky);
  g.addColorStop(1, C.skyLight);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  drawSprite(ctx, CLOUD, 560, 40, 12);
  drawSprite(ctx, CLOUD, -40, 380, 9);
  // The player's avatar stands on the white panel, top right.
  if (appearance) drawAvatar(ctx, appearance, clubColor, 760, 540 - 46 * 8, 8);
  else drawSprite(ctx, CLOUD, 820, 420, 8);

  // Brand
  drawSprite(ctx, BALL, 80, 64, 5);
  ctx.textAlign = 'left';
  ctx.font = `700 40px ${PIXEL}`;
  shadowText(ctx, uz.appName.toUpperCase(), 152, 108, '#fff', 3);

  // Name & context
  ctx.font = `700 104px ${PIXEL}`;
  shadowText(ctx, f.personaName, 80, 250, '#fff', 6);
  ctx.font = `800 38px ${BODY}`;
  ctx.fillStyle = C.ink;
  ctx.fillText(`${uz.positions[f.position]} · ${f.clubName}`, 80, 312);
  ctx.font = `700 34px ${BODY}`;
  ctx.fillText(`${uz.summaryTitle(f.seasonIndex)} · ${TIER_NAMES[f.tier]}`, 80, 362);

  // Outcome badge
  const badge = `${uz.finalPosition(f.finalPosition)} · ${uz.outcomes[f.outcome]}`;
  ctx.font = `700 44px ${PIXEL}`;
  const bw = ctx.measureText(badge).width + 64;
  const badgeColor = f.outcome === 'promoted' ? C.grass : f.outcome === 'relegated' ? C.danger : C.skyDeep;
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.roundRect(80, 412, bw, 84, 12);
  ctx.fill();
  ctx.fillStyle = badgeColor;
  ctx.beginPath();
  ctx.roundRect(80, 404, bw, 84, 12);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(badge, 112, 462);

  // White panel
  const px = 60, py = 540, pw = W - 120, ph = 610;
  ctx.fillStyle = C.cardShadow;
  ctx.beginPath();
  ctx.roundRect(px, py + 12, pw, ph, 28);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 28);
  ctx.fill();
  ctx.fillStyle = clubColor;
  ctx.fillRect(px + 28, py, pw - 56, 10);

  // Stat tiles
  const tiles: [string, string][] = [
    [uz.sumApps, String(f.apps)],
    f.position === 'GK' ? [uz.sumSaves, String(f.saves)] : [uz.sumGoals, String(f.goals)],
    [uz.sumAssists, String(f.assists)],
    [uz.sumRating, f.avgRating !== null ? f.avgRating.toFixed(1) : '—'],
  ];
  const gap = 20;
  const tw = (pw - 64 - 3 * gap) / 4;
  tiles.forEach(([label, value], i) => {
    const x = px + 32 + i * (tw + gap);
    ctx.fillStyle = C.skyPale;
    ctx.beginPath();
    ctx.roundRect(x, py + 40, tw, 180, 18);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = C.ink;
    ctx.font = `700 84px ${PIXEL}`;
    ctx.fillText(value, x + tw / 2, py + 150);
    ctx.font = `700 26px ${BODY}`;
    ctx.fillStyle = C.muted;
    ctx.fillText(label, x + tw / 2, py + 196);
  });

  // Story
  ctx.textAlign = 'left';
  ctx.fillStyle = C.ink;
  ctx.font = `600 34px ${BODY}`;
  const maxLines = 7;
  const all = wrapText(ctx, story, pw - 80);
  const lines = all.slice(0, maxLines);
  if (all.length > maxLines) lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[.,!]?$/, '')}…`;
  lines.forEach((l, i) => ctx.fillText(l, px + 40, py + 284 + i * 46));

  // Tagline + grass
  ctx.textAlign = 'center';
  ctx.font = `800 28px ${BODY}`;
  ctx.fillStyle = C.ink;
  ctx.fillText(uz.tagline, W / 2, H - 112);
  const scale = 6;
  const tile = spriteSize(GRASS);
  for (let x = 0; x < W; x += tile.w * scale) drawSprite(ctx, GRASS, x, H - tile.h * scale, scale);
  return c;
}

export async function shareOrDownload(canvas: HTMLCanvasElement, fileName: string, title: string): Promise<void> {
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) return;
  const file = new File([blob], fileName, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch {
      /* cancelled → fall back to download */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
