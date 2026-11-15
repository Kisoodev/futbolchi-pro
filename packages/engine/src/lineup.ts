/**
 * Picks a club's starting XI and bench for a match (4-3-3: GK, LB, LCB, RCB,
 * RB, CDM, CM, CAM, LW, ST, RW).
 *
 * Rules (docs/CHARACTERS.md and the owner):
 *  - the persona always starts in their position's slot, unless injured;
 *  - the core characters (Odil, Abu) always start when the persona's club has
 *    them: Odil plays RW, or LW when the persona takes RW (he stays the rival
 *    for that wing); Abu keeps goal, unless the persona is the goalkeeper —
 *    then Abu sits on the bench;
 *  - every other slot gets the best fit (OVR + how well the position fits,
 *    with a little week-to-week rotation);
 *  - the bench has BENCH_SIZE players, always with a reserve goalkeeper.
 */
import { createRng, hashSeed } from './rng';
import { ACADEMY_ROSTER } from './roster';
import type { Club, LineupPlayer, MatchLineup, NpcPlayer, Persona, Position, SlotId } from './types';

export const BENCH_SIZE = 7;

/** Which positions can fill a slot, best first (index = fit penalty step). */
const SLOT_FIT: Record<SlotId, Position[]> = {
  GK: ['GK'],
  LB: ['FB', 'CB', 'CDM'],
  LCB: ['CB', 'CDM', 'FB'],
  RCB: ['CB', 'CDM', 'FB'],
  RB: ['FB', 'CB', 'CDM'],
  CDM: ['CDM', 'CM', 'CB'],
  CM: ['CM', 'CDM', 'CAM'],
  CAM: ['CAM', 'CM', 'W'],
  LW: ['W', 'CAM', 'ST'],
  ST: ['ST', 'W', 'CAM'],
  RW: ['W', 'CAM', 'ST'],
};
const SLOT_SIDE: Partial<Record<SlotId, 'L' | 'R'>> = { LB: 'L', RB: 'R', LW: 'L', RW: 'R' };
/** Fill the hardest slots first. */
const FILL_ORDER: SlotId[] = ['GK', 'LB', 'RB', 'LW', 'RW', 'CDM', 'CAM', 'ST', 'CM', 'LCB', 'RCB'];

/** Where the persona plays for each position (a full-back plays left, a winger right). */
export const PERSONA_SLOT: Record<Position, SlotId> = { GK: 'GK', CB: 'LCB', FB: 'LB', CDM: 'CDM', CM: 'CM', CAM: 'CAM', W: 'RW', ST: 'ST' };

const isCore = (p: NpcPlayer) => !!ACADEMY_ROSTER.find((r) => r.key === p.characterKey)?.core;

function fitScore(p: NpcPlayer, slot: SlotId): number {
  const step = SLOT_FIT[slot].indexOf(p.position);
  if (step < 0) return -Infinity;
  const side = SLOT_SIDE[slot];
  const sidePenalty = side && p.side && p.side !== side ? 1.5 : 0;
  return p.ovr - step * 6 - sidePenalty;
}

const toLineup = (p: NpcPlayer, slot?: SlotId): LineupPlayer => ({ id: p.id, name: p.name, position: p.position, ovr: p.ovr, slot, characterKey: p.characterKey });

export interface LineupOptions {
  /** The persona, when this is their club (null for other clubs). */
  persona?: Pick<Persona, 'id' | 'name' | 'position' | 'injuryWeeksLeft'> & { ovr: number };
  /** NPC ids that cannot play (injured). */
  unavailable?: string[];
  seed: number;
}

export function pickLineup(club: Club, opts: LineupOptions): MatchLineup {
  const rng = createRng(hashSeed(opts.seed, 'lineup', club.id));
  const out = new Set(opts.unavailable ?? []);
  const pool = (club.squad ?? []).filter((p) => !out.has(p.id));
  const taken = new Map<SlotId, LineupPlayer>();
  const used = new Set<string>();
  const place = (slot: SlotId, p: NpcPlayer) => {
    taken.set(slot, toLineup(p, slot));
    used.add(p.id);
  };

  // the persona
  const persona = opts.persona && opts.persona.injuryWeeksLeft === 0 ? opts.persona : null;
  if (persona) {
    const slot = PERSONA_SLOT[persona.position];
    taken.set(slot, { id: persona.id, name: persona.name, position: persona.position, ovr: persona.ovr, slot, persona: true });
  }

  // the core characters
  const odil = pool.find((p) => p.characterKey === 'odil');
  if (odil) {
    const slot: SlotId = taken.has('RW') ? 'LW' : 'RW';
    if (!taken.has(slot)) place(slot, odil);
  }
  const abu = pool.find((p) => p.characterKey === 'abu');
  if (abu && !taken.has('GK')) place('GK', abu);

  // the other slots: best fit, with a little rotation
  for (const slot of FILL_ORDER) {
    if (taken.has(slot)) continue;
    let best: NpcPlayer | null = null;
    let bestScore = -Infinity;
    for (const p of pool) {
      if (used.has(p.id)) continue;
      const score = fitScore(p, slot) + rng.range(-1.5, 1.5);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best) place(slot, best);
  }

  // the bench: core characters who are not starting (Abu when the persona keeps goal),
  // a reserve goalkeeper, then the best of the rest
  const rest = pool.filter((p) => !used.has(p.id));
  const bench: NpcPlayer[] = rest.filter(isCore);
  if (!bench.some((p) => p.position === 'GK')) {
    const gk = rest.filter((p) => p.position === 'GK').sort((a, b) => b.ovr - a.ovr)[0];
    if (gk) bench.push(gk);
  }
  for (const p of rest.filter((x) => !bench.includes(x)).sort((a, b) => b.ovr - a.ovr || a.id.localeCompare(b.id))) {
    if (bench.length >= BENCH_SIZE) break;
    bench.push(p);
  }
  const starters = (['GK', 'LB', 'LCB', 'RCB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'ST', 'RW'] as SlotId[]).map((s) => taken.get(s)).filter((x): x is LineupPlayer => !!x);
  return { starters, bench: bench.map((p) => toLineup(p)), ...(club.style ? { style: club.style } : {}) };
}

export { isCore };
