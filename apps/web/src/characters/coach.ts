/**
 * Coach Usmoxan Kapadze (docs/CHARACTERS.md §1) at double resolution
 * (128×256, feet on row 244). The sprites are pixelated from his character
 * sheets (art-ref/, see art-ref/pixelate.mjs) rather than drawn by hand, so he
 * looks like the reference: the lean, hard face, the low furrowed brows, the
 * goatee, real adult proportions.
 *
 * Two outfits: training (navy tracksuit zipped up, the silver watch) and match
 * day (long black puffer with the COACH patch and the crest, white shirt and
 * black tie, the tablet in his hand).
 */
import { COACH_MATCH, COACH_TRAINING, type SpriteData } from './coachSprites';
import type { Painter } from './painters';

/** Paints run-length sprite data (see coachSprites.ts). */
export function paintSprite(ctx: CanvasRenderingContext2D, s: SpriteData) {
  s.rows.forEach((row, i) => {
    const y = s.top + i;
    let x = 0;
    for (const run of row.split(',')) {
      const [sym, count] = run.split('*');
      const n = count ? Number(count) : 1;
      if (sym !== '.') {
        ctx.fillStyle = s.palette[parseInt(sym, 36)];
        ctx.fillRect(x, y, n, 1);
      }
      x += n;
    }
  });
}

export const paintCoachTraining: Painter = (ctx) => paintSprite(ctx, COACH_TRAINING);
export const paintCoachMatch: Painter = (ctx) => paintSprite(ctx, COACH_MATCH);
