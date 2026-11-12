import { FATIGUE_STAT_PENALTY, POSITION_WEIGHTS } from './constants';
import { STAT_KEYS, type Position, type StatKey, type Stats } from './types';

/** Overall rating: weighted sum of stats by position. */
export function computeOvr(stats: Stats, position: Position): number {
  const w = POSITION_WEIGHTS[position];
  let sum = 0;
  for (const k of STAT_KEYS) sum += w[k] * stats[k];
  return sum;
}

/** The N stats that matter most for a position, highest weight first. */
export function topStats(position: Position, n: number): StatKey[] {
  const w = POSITION_WEIGHTS[position];
  return [...STAT_KEYS].sort((a, b) => w[b] - w[a]).slice(0, n);
}

/** Stats after the fatigue penalty, used during a match. */
export function effectiveStats(stats: Stats, fatigue: number): Stats {
  const mult = 1 - FATIGUE_STAT_PENALTY * (fatigue / 100);
  const out = {} as Stats;
  for (const k of STAT_KEYS) out[k] = stats[k] * mult;
  return out;
}
