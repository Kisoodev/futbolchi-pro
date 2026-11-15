/**
 * Team shape (docs/MATCH_ENGINE.md §7): where each player stands for a given
 * ball position, in possession or not. Used by the engine (pressure, who is
 * open) and by the 2D replay (drawing the 22 players), so both agree.
 *
 * Coordinates: x 0–100 along the pitch (home attacks towards 100), y 0–100
 * across it. A team's "attack frame" turns x so that it always attacks towards
 * 100.
 *
 *  - In possession the team pushes up: defenders step up to about halfway, the
 *    full-backs overlap, the wide players stretch the pitch.
 *  - Out of possession it drops into a compact block behind the ball: the
 *    forwards come back towards their own half, the lines get closer, the
 *    block slides towards the ball's side.
 *  - Lines keep their order and a minimum gap, so players never bunch.
 */
import type { Side, SlotId } from '../types';

export interface Point {
  x: number;
  y: number;
}

/** 4-3-3 base positions in the attack frame (own goal at x = 0). */
export const BASE: Record<SlotId, Point> = {
  GK: { x: 5, y: 50 },
  LB: { x: 24, y: 14 },
  LCB: { x: 19, y: 37 },
  RCB: { x: 19, y: 63 },
  RB: { x: 24, y: 86 },
  CDM: { x: 34, y: 50 },
  CM: { x: 45, y: 33 },
  CAM: { x: 52, y: 63 },
  LW: { x: 66, y: 15 },
  ST: { x: 70, y: 50 },
  RW: { x: 66, y: 85 },
};

type Line = 'gk' | 'def' | 'mid' | 'att';
const LINE: Record<SlotId, Line> = { GK: 'gk', LB: 'def', LCB: 'def', RCB: 'def', RB: 'def', CDM: 'mid', CM: 'mid', CAM: 'mid', LW: 'att', ST: 'att', RW: 'att' };
/** How strongly each line follows the ball up and down the pitch. */
const FOLLOW: Record<Line, { inPos: number; outPos: number }> = {
  gk: { inPos: 0.12, outPos: 0.08 },
  def: { inPos: 0.55, outPos: 0.45 },
  mid: { inPos: 0.6, outPos: 0.55 },
  att: { inPos: 0.45, outPos: 0.5 },
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const toAttack = (side: Side, x: number) => (side === 'home' ? x : 100 - x);
export const fromAttack = toAttack;

/**
 * A player's spot for the ball at (bx, by) in pitch coordinates.
 * `inPossession`: this player's team has the ball.
 */
export function shapeSpot(side: Side, slot: SlotId, ball: Point, inPossession: boolean): Point {
  const base = BASE[slot];
  const line = LINE[slot];
  const ax = toAttack(side, ball.x);
  const f = FOLLOW[line][inPossession ? 'inPos' : 'outPos'];
  // up/down: follow the ball around the middle of the pitch; push up more in possession
  let x = base.x + (ax - 50) * f + (inPossession ? 8 : -6) * (line === 'gk' ? 0.3 : 1);
  if (line === 'def') x = clamp(x, inPossession ? 14 : 8, inPossession ? 52 : 40);
  if (line === 'mid') x = clamp(x, 20, inPossession ? 72 : 58);
  if (line === 'att') x = clamp(x, inPossession ? 40 : 34, inPossession ? 90 : 72);
  if (line === 'gk') x = clamp(x, 2, 16);
  // across: slide towards the ball; compact without the ball, wide with it
  const lateral = (ball.y - 50) * (inPossession ? 0.2 : 0.32);
  const spread = inPossession ? 1.12 : 0.82;
  let y = 50 + (base.y - 50) * spread + lateral;
  if (line === 'gk') y = 50 + (ball.y - 50) * 0.12;
  // full-backs overlap when the ball is up and on their side
  if ((slot === 'LB' || slot === 'RB') && inPossession && ax > 55) {
    const ownSide = slot === 'LB' ? ball.y < 50 : ball.y > 50;
    if (ownSide) x = Math.min(x + 12, 70);
  }
  return { x: clamp(toAttack(side, x), 2, 98), y: clamp(y, 4, 96) };
}

export const dist = (a: Point, b: Point) => {
  const dx = a.x - b.x;
  const dy = (a.y - b.y) * 0.68;
  return Math.sqrt(dx * dx + dy * dy);
};
