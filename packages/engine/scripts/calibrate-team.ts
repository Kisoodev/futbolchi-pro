import { createRng } from '../src/rng';
import { SLOTS, type LineupPlayer, type MatchLineup, type Position, type SlotId } from '../src/types';
const SLOT_POS: Record<SlotId, Position> = { GK: 'GK', LB: 'FB', RB: 'FB', LCB: 'CB', RCB: 'CB', CDM: 'CDM', CM: 'CM', CAM: 'CAM', LW: 'W', RW: 'W', ST: 'ST' };
const BENCH: Position[] = ['GK', 'CB', 'FB', 'CM', 'W', 'ST', 'CAM'];
/** A test team built per slot around an average OVR (±3) with a 7-player bench. */
export function team(tag: string, avg: number, seed: number): MatchLineup {
  const rng = createRng(seed);
  const starters: LineupPlayer[] = SLOTS.map((slot, i) => ({ id: `${tag}${i}`, name: `${tag}${i}`, position: SLOT_POS[slot], slot, ovr: Math.round(avg + rng.range(-3, 3)) }));
  const bench: LineupPlayer[] = BENCH.map((position, i) => ({ id: `${tag}b${i}`, name: `${tag}b${i}`, position, ovr: Math.round(avg - 2 + rng.range(-3, 3)) }));
  return { starters, bench };
}
