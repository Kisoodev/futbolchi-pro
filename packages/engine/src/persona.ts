import * as C from './constants';
import { computeOvr } from './positions';
import { startStats, validateCreationPoints } from './progression';
import { clamp } from './rng';
import {
  ACCESSORIES,
  BOOT_COLORS,
  BROWS,
  CELEBRATIONS,
  EYE_COLORS,
  FACIAL_HAIR,
  NOSES,
  SLEEVES,
  FEET,
  HAIR_COLORS,
  HAIR_STYLES,
  GENDERS,
  HAIR_STYLES_BY_GENDER,
  HEAD_SHAPES,
  POSITIONS,
  SKIN_TONES,
  STAT_KEYS,
  type Appearance,
  type Persona,
  type PersonaView,
  type Position,
  type StatKey,
  type Stats,
} from './types';

export interface CreatePersonaInput {
  id: string;
  name: string;
  position: Position;
  /** Creation points per attribute, on top of the position's start (OVR 52). */
  bonus: Partial<Stats>;
  seed: number;
  clubId: string;
  /** Cosmetic. Defaults to DEFAULT_APPEARANCE. */
  appearance?: Appearance;
}

export type PersonaError =
  | 'name_length'
  | 'bad_position'
  | 'bonus_negative'
  | 'bonus_per_stat'
  | 'bonus_total'
  | 'ovr_cap'
  | 'bad_appearance';

export function isValidAppearance(a: Appearance): boolean {
  const int = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
  return (
    !!a &&
    GENDERS.includes(a.gender) &&
    HAIR_STYLES_BY_GENDER[a.gender].includes(a.hairStyle) &&
    (a.gender === 'male' || a.facialHair === 'none') &&
    HEAD_SHAPES.includes(a.headShape) &&
    SKIN_TONES.includes(a.skinTone) &&
    HAIR_STYLES.includes(a.hairStyle) &&
    HAIR_COLORS.includes(a.hairColor) &&
    FEET.includes(a.foot) &&
    EYE_COLORS.includes(a.eyeColor) &&
    BROWS.includes(a.brows) &&
    NOSES.includes(a.nose) &&
    FACIAL_HAIR.includes(a.facialHair) &&
    BOOT_COLORS.includes(a.boots) &&
    SLEEVES.includes(a.sleeves) &&
    ACCESSORIES.includes(a.accessory) &&
    CELEBRATIONS.includes(a.celebration) &&
    int(a.heightCm, C.HEIGHT_MIN_CM, C.HEIGHT_MAX_CM) &&
    int(a.weightKg, C.WEIGHT_MIN_KG, C.WEIGHT_MAX_KG)
  );
}

/**
 * Fills fields missing from older saves (and drops unknown values) so an old
 * persona always renders. Each field falls back to DEFAULT_APPEARANCE.
 */
export function normalizeAppearance(a: Partial<Appearance> | null | undefined): Appearance {
  const out: Appearance = { ...C.DEFAULT_APPEARANCE };
  if (!a || typeof a !== 'object') return out;
  for (const key of Object.keys(out) as (keyof Appearance)[]) {
    const candidate = { ...out, [key]: a[key] } as Appearance;
    if (a[key] !== undefined && isValidAppearance(candidate)) (out as unknown as Record<string, unknown>)[key] = a[key];
  }
  return out;
}

export const NAME_MIN = 2;
export const NAME_MAX = 24;

export function validatePersonaInput(
  input: Pick<CreatePersonaInput, 'name' | 'position' | 'bonus' | 'appearance'>,
): PersonaError | null {
  const name = input.name.trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) return 'name_length';
  if (!POSITIONS.includes(input.position)) return 'bad_position';
  // creation points: per attribute, total and the OVR cap (docs/PROGRESSION_SYSTEM.md §3)
  const points = validateCreationPoints(input.position, input.bonus);
  if (points === 'points_negative') return 'bonus_negative';
  if (points === 'points_per_attr') return 'bonus_per_stat';
  if (points === 'points_total') return 'bonus_total';
  if (points === 'ovr_cap') return 'ovr_cap';
  if (input.appearance !== undefined && !isValidAppearance(input.appearance)) return 'bad_appearance';
  return null;
}

export function createPersona(input: CreatePersonaInput): Persona {
  const err = validatePersonaInput(input);
  if (err) throw new Error(`invalid persona: ${err}`);
  const stats = startStats(input.position);
  for (const k of STAT_KEYS) stats[k] += input.bonus[k] ?? 0;
  return {
    id: input.id,
    name: input.name.trim(),
    position: input.position,
    age: C.START_AGE,
    appearance: { ...(input.appearance ?? C.DEFAULT_APPEARANCE) },
    stats,
    xp: 0,
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

/** Exact (unrounded) OVR, used by the simulation. Players see personaLevel() (rounded down). */
export const personaOvr = (p: Pick<Persona, 'stats' | 'position'>): number => computeOvr(p.stats, p.position);

/** Stat changes between two versions of a persona (for the growth animation). */
export function statDeltas(before: Persona, after: Persona): Partial<Record<StatKey, number>> {
  const out: Partial<Record<StatKey, number>> = {};
  for (const k of Object.keys(after.stats) as StatKey[]) {
    const d = after.stats[k] - before.stats[k];
    if (Math.abs(d) > 1e-9) out[k] = d;
  }
  return out;
}

export function addFatigue(p: Persona, amount: number): Persona {
  return { ...p, fatigue: clamp(p.fatigue + amount, 0, C.FATIGUE_MAX) };
}
