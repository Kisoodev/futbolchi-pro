import * as C from './constants';
import { computeOvr, topStats } from './positions';
import { clamp, createRng, hashSeed, triangular } from './rng';
import { POSITIONS, STAT_KEYS, type Persona, type PersonaView, type Position, type StatKey, type Stats } from './types';

export interface CreatePersonaInput {
  id: string;
  name: string;
  position: Position;
  /** Bonus points per stat, spent on top of the position template. */
  bonus: Partial<Stats>;
  seed: number;
  clubId: string;
}

export type PersonaError = 'name_length' | 'bad_position' | 'bonus_negative' | 'bonus_per_stat' | 'bonus_total';

export const NAME_MIN = 2;
export const NAME_MAX = 24;

export function validatePersonaInput(input: Pick<CreatePersonaInput, 'name' | 'position' | 'bonus'>): PersonaError | null {
  const name = input.name.trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) return 'name_length';
  if (!POSITIONS.includes(input.position)) return 'bad_position';
  let total = 0;
  for (const k of STAT_KEYS) {
    const v = input.bonus[k] ?? 0;
    if (!Number.isInteger(v) || v < 0) return 'bonus_negative';
    if (v > C.BONUS_POINTS_PER_STAT_MAX) return 'bonus_per_stat';
    total += v;
  }
  if (total > C.BONUS_POINTS_TOTAL) return 'bonus_total';
  return null;
}

export function createPersona(input: CreatePersonaInput): Persona {
  const err = validatePersonaInput(input);
  if (err) throw new Error(`invalid persona: ${err}`);
  const rng = createRng(hashSeed(input.seed, 'potential'));
  const stats = { ...C.STAT_TEMPLATES[input.position] };
  for (const k of STAT_KEYS) stats[k] += input.bonus[k] ?? 0;
  return {
    id: input.id,
    name: input.name.trim(),
    position: input.position,
    age: C.START_AGE,
    stats,
    potential: Math.round(triangular(rng, C.POTENTIAL_MIN, C.POTENTIAL_MODE, C.POTENTIAL_MAX)),
    fatigue: 0,
    injuryWeeksLeft: 0,
    clubId: input.clubId,
    seed: input.seed,
    career: { seasons: 0, apps: 0, goals: 0, assists: 0, saves: 0 },
  };
}

/** Strip hidden fields before anything reaches the UI. */
export function personaView(p: Persona): PersonaView {
  const { potential: _hidden, ...view } = p;
  return view;
}

export const personaOvr = (p: Pick<Persona, 'stats' | 'position'>): number => computeOvr(p.stats, p.position);

/** 1 when far below potential, falling to 0 at potential. */
export function growthRoom(p: Persona): number {
  return clamp((p.potential - personaOvr(p)) / C.GROWTH_ROOM_SPAN, 0, 1);
}

/** Actual gain for a positive base on one stat, given position and growth room. */
export function growthGain(p: Persona, stat: StatKey, base: number): number {
  const w = C.POSITION_WEIGHTS[p.position][stat];
  return base * (C.GROWTH_POS_BASE + C.GROWTH_POS_FACTOR * w) * growthRoom(p);
}

/** Apply a stat change. Positive deltas go through the growth formula; negative apply directly. */
export function changeStat(p: Persona, stat: StatKey, base: number): Persona {
  const delta = base > 0 ? growthGain(p, stat, base) : base;
  const value = clamp(p.stats[stat] + delta, C.STAT_MIN, C.STAT_MAX);
  return { ...p, stats: { ...p.stats, [stat]: value } };
}

/** Small growth from playing a match: the position's most important stats. */
export function applyMatchXp(p: Persona): Persona {
  let out = p;
  for (const s of topStats(p.position, C.MATCH_XP_TOP_STATS)) out = changeStat(out, s, C.MATCH_XP_BASE);
  return out;
}

export function addFatigue(p: Persona, amount: number): Persona {
  return { ...p, fatigue: clamp(p.fatigue + amount, 0, C.FATIGUE_MAX) };
}
