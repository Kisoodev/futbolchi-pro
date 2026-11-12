/**
 * Shareable season card rendered to a 1080×1350 PNG (portrait, social-friendly).
 * No recording feature here — video highlights are admin-only, later.
 */
import { TIER_NAMES, type SeasonFacts } from '@futbolchi/engine';
import { uz } from '../i18n/uz';

const W = 1080;
const H = 1350;

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

export function renderShareCard(f: SeasonFacts, story: string, clubColor: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0d3b24');
  g.addColorStop(1, '#06170e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Pitch lines motif
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(W / 2, H * 0.36, 260, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = clubColor;
  ctx.fillRect(0, 0, W, 18);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd23f';
  ctx.font = '700 36px system-ui, sans-serif';
  ctx.fillText(uz.appName.toUpperCase(), 80, 110);

  ctx.fillStyle = '#fff';
  ctx.font = '800 96px system-ui, sans-serif';
  ctx.fillText(f.personaName, 80, 230);
  ctx.font = '500 40px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(`${uz.positions[f.position]} · ${f.clubName}`, 80, 295);
  ctx.fillText(`${uz.summaryTitle(f.seasonIndex)} · ${TIER_NAMES[f.tier]}`, 80, 350);

  // Outcome badge
  const badge = `${uz.finalPosition(f.finalPosition)} · ${uz.outcomes[f.outcome]}`;
  ctx.font = '700 44px system-ui, sans-serif';
  const bw = ctx.measureText(badge).width + 60;
  ctx.fillStyle = f.outcome === 'promoted' ? '#ffd23f' : f.outcome === 'relegated' ? '#e05d5d' : '#3fa66a';
  ctx.beginPath();
  ctx.roundRect(80, 400, bw, 80, 40);
  ctx.fill();
  ctx.fillStyle = '#0b1f14';
  ctx.fillText(badge, 110, 456);

  // Stat tiles
  const tiles: [string, string][] = [
    [uz.sumApps, String(f.apps)],
    f.position === 'GK' ? [uz.sumSaves, String(f.saves)] : [uz.sumGoals, String(f.goals)],
    [uz.sumAssists, String(f.assists)],
    [uz.sumRating, f.avgRating !== null ? f.avgRating.toFixed(1) : '—'],
  ];
  const tw = (W - 160 - 3 * 24) / 4;
  tiles.forEach(([label, value], i) => {
    const x = 80 + i * (tw + 24);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.roundRect(x, 540, tw, 190, 24);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '800 80px system-ui, sans-serif';
    ctx.fillText(value, x + tw / 2, 650);
    ctx.font = '500 26px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(label, x + tw / 2, 700);
  });

  // Story
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.font = '500 38px system-ui, sans-serif';
  const lines = wrapText(ctx, story, W - 160).slice(0, 11);
  lines.forEach((l, i) => ctx.fillText(l, 80, 810 + i * 52));

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '500 28px system-ui, sans-serif';
  ctx.fillText(uz.tagline, 80, H - 70);
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
