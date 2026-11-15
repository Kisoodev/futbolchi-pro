/**
 * Progression & rating system — implements docs/PROGRESSION_SYSTEM.md (v1).
 *
 * Every number comes from PROGRESSION_CONFIG below (section 10 of the spec).
 * A few keys the spec does not define are marked "not in spec"; they are kept
 * here too so nothing is hard-coded elsewhere.
 */
import type { Persona, Position, Stats, StatKey, Tier } from './types';
import { STAT_KEYS } from './types';

export const PROGRESSION_CONFIG = {
  START_OVR: 52,
  CREATION_POINTS: 12,
  CREATION_MAX_PER_ATTR: 5,
  CREATION_MAX_OVR: 55,
  MAX_ATTR: 100,
  MAX_ATTR_ABOVE_OVR: 15,

  COST: { base: 200, growth: 1.065, wallStart: 85, wallGrowth: 1.13, attrFactor: 0.3 },

  MATCH_XP: {
    base: 60, ratingPivot: 6.0, perRatingPoint: 40, minRatingBonus: -40,
    goal: 25, assist: 20, cleanSheet: 30, motm: 50, win: 20, draw: 10, minXP: 15,
    opponentModPerOvr: 0.02, opponentModMin: 0.8, opponentModMax: 1.3,
  },
  TRAINING: { sessionsPerDay: 3, xpPerSession: 30 },

  TIERS: {
    academy: { regular: [55, 58], good: [57, 60], strong: [60, 62], xpMult: 1.0 },
    league2: { regular: [60, 65], good: [64, 69], strong: [68, 72], xpMult: 1.3 },
    league1: { regular: [65, 72], good: [70, 77], strong: [76, 82], xpMult: 1.6 },
    elite: { regular: [74, 80], good: [79, 86], strong: [85, 92], xpMult: 2.0 },
  },
  SQUAD_MIX: { regular: 0.60, good: 0.28, strong: 0.12 },

  PROMOTION: { ovrAboveNextRegularMin: 2, minAvgRatingLast10: 6.8 },
  OVERLEVEL: [{ above: 0, mod: 1.0 }, { above: 1, mod: 0.75 }, { above: 4, mod: 0.5 }],

  CARD_TIERS: [
    { min: 0, name: 'Bronza' }, { min: 65, name: 'Kumush' }, { min: 75, name: 'Oltin' },
    { min: 85, name: 'Elit' }, { min: 90, name: 'Afsona' }, { min: 99, name: 'Ikona' },
  ],
  MILESTONES: [60, 65, 70, 75, 80, 85, 90, 95, 99, 100],

  // ---- not in spec (decided with the owner) ----
  /** Section 2 weights. GK is not in v1 of the spec: provisional weights until GK attributes exist. */
  WEIGHTS: {
    ST: { pace: 0.2, shooting: 0.3, passing: 0.1, dribbling: 0.2, defending: 0.05, physical: 0.15 },
    W: { pace: 0.25, shooting: 0.2, passing: 0.15, dribbling: 0.25, defending: 0.05, physical: 0.1 },
    CAM: { pace: 0.1, shooting: 0.2, passing: 0.3, dribbling: 0.25, defending: 0.05, physical: 0.1 },
    CM: { pace: 0.1, shooting: 0.1, passing: 0.3, dribbling: 0.2, defending: 0.15, physical: 0.15 },
    CDM: { pace: 0.1, shooting: 0.05, passing: 0.2, dribbling: 0.1, defending: 0.3, physical: 0.25 },
    FB: { pace: 0.25, shooting: 0.05, passing: 0.15, dribbling: 0.1, defending: 0.25, physical: 0.2 },
    CB: { pace: 0.1, shooting: 0.0, passing: 0.1, dribbling: 0.05, defending: 0.4, physical: 0.35 },
    GK: { pace: 0.05, shooting: 0.0, passing: 0.15, dribbling: 0.0, defending: 0.45, physical: 0.35 },
  } satisfies Record<Position, Stats>,
  /** Section 3: starting values before the OVR=52 shift (primary ~55, secondary ~45–50). */
  START_SHAPE: { primaryWeight: 0.2, primary: 55, secondaryWeight: 0.1, secondary: 49, minor: 45 },
  /** The engine has no man-of-the-match vote yet: a rating this high counts as MOTM. */
  MOTM_RATING: 8.5,
  /** Positions that earn the clean-sheet bonus ("himoyachi"). */
  CLEAN_SHEET_POSITIONS: ['GK', 'CB', 'FB', 'CDM'] as Position[],
  /** Section 7.2: squad size, players per position, strong clubs ±2, NPC season change. */
  SQUAD: {
    size: 18,
    positions: ['GK', 'GK', 'CB', 'CB', 'CB', 'FB', 'FB', 'FB', 'CDM', 'CDM', 'CM', 'CM', 'CAM', 'CAM', 'W', 'W', 'ST', 'ST'] as Position[],
    clubStrength: 2,
    seasonDrift: [-2, 3],
  },
  /** Section 7.3: offers from this many clubs of the next tier. */
  OFFERS: 2,
} as const;

const P = PROGRESSION_CONFIG;

export type TierKey = keyof typeof P.TIERS;
/** Our tiers 4…1 are the spec's Akademiya, 2-liga, 1-liga, Elit. */
export const TIER_KEY: Record<Tier, TierKey> = { 4: 'academy', 3: 'league2', 2: 'league1', 1: 'elite' };
export const tierConfig = (tier: Tier) => P.TIERS[TIER_KEY[tier]];

// ---------------------------------------------------------------- OVR (section 2)
/** Exact weighted sum (used inside the simulation). */
export function rawOvr(stats: Stats, position: Position): number {
  const w = P.WEIGHTS[position];
  let sum = 0;
  for (const k of STAT_KEYS) sum += w[k] * (stats[k] ?? 0);
  return sum;
}
/** The OVR players see: always rounded down (99.9 → 99). Tiny float noise is ignored. */
export const ovr = (stats: Stats, position: Position): number => Math.floor(rawOvr(stats, position) + 1e-9);
export const personaLevel = (p: Pick<Persona, 'stats' | 'position'>): number => ovr(p.stats, p.position);

// ---------------------------------------------------------------- creation (section 3)
/** Starting attributes of a position: OVR exactly START_OVR (floor), primary ≈55, secondary ≈45–50. */
export function startStats(position: Position): Stats {
  const w = P.WEIGHTS[position];
  const s = P.START_SHAPE;
  const shape = {} as Stats;
  for (const k of STAT_KEYS) shape[k] = w[k] >= s.primaryWeight ? s.primary : w[k] >= s.secondaryWeight ? s.secondary : s.minor;
  const shift = P.START_OVR - ovr(shape, position);
  for (const k of STAT_KEYS) shape[k] += shift;
  return shape;
}

export type CreationError = 'points_total' | 'points_per_attr' | 'points_negative' | 'ovr_cap';

/** Checks creation points: total, per attribute and the OVR cap. */
export function validateCreationPoints(position: Position, points: Partial<Record<StatKey, number>>): CreationError | null {
  let total = 0;
  for (const k of STAT_KEYS) {
    const v = points[k] ?? 0;
    if (!Number.isInteger(v) || v < 0) return 'points_negative';
    if (v > P.CREATION_MAX_PER_ATTR) return 'points_per_attr';
    total += v;
  }
  if (total > P.CREATION_POINTS) return 'points_total';
  const stats = startStats(position);
  for (const k of STAT_KEYS) stats[k] += points[k] ?? 0;
  if (ovr(stats, position) > P.CREATION_MAX_OVR) return 'ovr_cap';
  return null;
}

/** Whether one more point on `key` is allowed (the creator greys the + button out otherwise). */
export function canAddCreationPoint(position: Position, points: Partial<Record<StatKey, number>>, key: StatKey): boolean {
  return validateCreationPoints(position, { ...points, [key]: (points[key] ?? 0) + 1 }) === null;
}

// ---------------------------------------------------------------- costs (section 5)
export function baseCost(v: number): number {
  const c = P.COST;
  let cost = c.base * Math.pow(c.growth, v - P.START_OVR);
  if (v >= c.wallStart) cost *= Math.pow(c.wallGrowth, v - (c.wallStart - 1));
  return cost;
}
/** XP to raise an attribute from its current value v to v+1. */
export const attrCost = (v: number): number => Math.round((baseCost(Math.floor(v)) * P.COST.attrFactor) / 10) * 10;

export type UpgradeBlock = 'max' | 'above_ovr' | 'xp';

/** Why an attribute cannot be raised right now (null = it can). */
export function upgradeBlock(p: Pick<Persona, 'stats' | 'position' | 'xp'>, key: StatKey): UpgradeBlock | null {
  const v = Math.floor(p.stats[key]);
  if (v + 1 > P.MAX_ATTR) return 'max';
  if (v + 1 > personaLevel(p) + P.MAX_ATTR_ABOVE_OVR) return 'above_ovr';
  if ((p.xp ?? 0) < attrCost(v)) return 'xp';
  return null;
}

/** Spends XP on +1 of an attribute. Throws if not allowed. */
export function upgradeAttribute<T extends Pick<Persona, 'stats' | 'position' | 'xp'>>(p: T, key: StatKey): T {
  const block = upgradeBlock(p, key);
  if (block) throw new Error(`cannot upgrade ${key}: ${block}`);
  const v = Math.floor(p.stats[key]);
  return { ...p, xp: (p.xp ?? 0) - attrCost(v), stats: { ...p.stats, [key]: v + 1 } };
}

/** The upgrade that adds the most OVR per XP right now (for "auto" and simulations). */
export function bestUpgrade(p: Pick<Persona, 'stats' | 'position' | 'xp'>, ignoreXp = false): StatKey | null {
  const w = P.WEIGHTS[p.position];
  let best: StatKey | null = null;
  let bestValue = 0;
  for (const k of STAT_KEYS) {
    if (w[k] <= 0) continue;
    const block = upgradeBlock(ignoreXp ? { ...p, xp: Infinity } : p, k);
    if (block) continue;
    const value = w[k] / attrCost(p.stats[k]);
    if (value > bestValue) {
      bestValue = value;
      best = k;
    }
  }
  return best;
}

/** Spends XP greedily on the best-value attributes until nothing is affordable. */
export function autoSpend<T extends Pick<Persona, 'stats' | 'position' | 'xp'>>(p: T): T {
  let out = p;
  for (let guard = 0; guard < 10000; guard++) {
    const k = bestUpgrade(out);
    if (!k) break;
    out = upgradeAttribute(out, k);
  }
  return out;
}

/** About how much XP the next OVR level costs (greedy plan), for the progress bar. */
export function xpToNextLevel(p: Pick<Persona, 'stats' | 'position' | 'xp'>): number {
  const target = personaLevel(p) + 1;
  let s = { ...p, xp: Infinity };
  let spent = 0;
  for (let guard = 0; guard < 200 && personaLevel(s) < target; guard++) {
    const k = bestUpgrade(s, true);
    if (!k) return Infinity;
    spent += attrCost(s.stats[k]);
    s = upgradeAttribute(s, k);
  }
  return spent;
}

// ---------------------------------------------------------------- XP (section 4)
export interface MatchXpInput {
  rating: number;
  minutes: number;
  goals: number;
  assists: number;
  cleanSheet: boolean;
  position: Position;
  result: 'win' | 'draw' | 'loss';
  tier: Tier;
  /** Average OVR of the opponent club's squad. */
  opponentOvr: number;
  personaOvr: number;
}

export function opponentMod(opponentOvr: number, personaOvr: number): number {
  const m = P.MATCH_XP;
  return Math.max(m.opponentModMin, Math.min(m.opponentModMax, 1 + (opponentOvr - personaOvr) * m.opponentModPerOvr));
}

/** Section 7.4: less XP when the persona has outgrown the tier's strongest players. */
export function overlevelMod(personaOvr: number, tier: Tier): number {
  const above = personaOvr - tierConfig(tier).strong[1];
  let mod = 1;
  for (const step of P.OVERLEVEL) if (above >= step.above) mod = step.mod;
  return above <= 0 ? P.OVERLEVEL[0].mod : mod;
}

export function matchXp(i: MatchXpInput): number {
  const m = P.MATCH_XP;
  const raw =
    m.base +
    Math.max(m.minRatingBonus, (i.rating - m.ratingPivot) * m.perRatingPoint) +
    i.goals * m.goal +
    i.assists * m.assist +
    (i.cleanSheet && P.CLEAN_SHEET_POSITIONS.includes(i.position) ? m.cleanSheet : 0) +
    (i.rating >= P.MOTM_RATING ? m.motm : 0) +
    (i.result === 'win' ? m.win : i.result === 'draw' ? m.draw : 0);
  const xp = raw * (i.minutes / 90) * tierConfig(i.tier).xpMult * opponentMod(i.opponentOvr, i.personaOvr) * overlevelMod(i.personaOvr, i.tier);
  return Math.round(Math.max(xp, m.minXP));
}

/** XP for a training day of `sessions` sessions (section 4.2). */
export const trainingXp = (sessions: number, tier: Tier): number => Math.round(sessions * P.TRAINING.xpPerSession * tierConfig(tier).xpMult);

// ---------------------------------------------------------------- feedback (section 8)
export const cardTier = (level: number): string => {
  let name: string = P.CARD_TIERS[0].name;
  for (const t of P.CARD_TIERS) if (level >= t.min) name = t.name;
  return name;
};
/** Milestones passed when OVR went from `before` to `after`. */
export const milestonesBetween = (before: number, after: number): number[] => P.MILESTONES.filter((m) => m > before && m <= after);

// ---------------------------------------------------------------- automatic growth
/**
 * Puts XP into one attribute, paying attrCost for every point (a point can be
 * filled in parts, so attributes hold fractions; the shown value is rounded
 * down). Stops at MAX_ATTR and at OVR + MAX_ATTR_ABOVE_OVR. Returns the XP
 * that could not be used.
 */
export function feedAttribute<T extends Pick<Persona, 'stats' | 'position'>>(p: T, key: StatKey, xp: number): { persona: T; left: number } {
  let v = p.stats[key];
  let left = xp;
  for (let guard = 0; guard < 1000 && left > 1e-9; guard++) {
    const cap = Math.min(P.MAX_ATTR, ovr({ ...p.stats, [key]: v }, p.position) + P.MAX_ATTR_ABOVE_OVR);
    if (v >= cap) break;
    const cost = attrCost(v);
    const room = Math.min(Math.floor(v) + 1, cap) - v;
    const step = Math.min(room, left / cost);
    v += step;
    left -= step * cost;
    if (step <= 1e-12) break;
  }
  return { persona: { ...p, stats: { ...p.stats, [key]: v } }, left };
}

/**
 * Grows the persona with XP: shared out over `keys` by `share` (default equal);
 * XP an attribute cannot take (it hit a cap) goes to the next best one.
 */
export function applyXp<T extends Pick<Persona, 'stats' | 'position'>>(p: T, keys: StatKey[], xp: number, share?: number[]): T {
  if (!keys.length || xp <= 0) return p;
  const w = share ?? keys.map(() => 1);
  const total = w.reduce((a, b) => a + b, 0);
  let out = p;
  let spare = 0;
  keys.forEach((k, i) => {
    const r = feedAttribute(out, k, (xp * w[i]) / total);
    out = r.persona;
    spare += r.left;
  });
  // leftovers go to the position's most important attributes
  const weights = P.WEIGHTS[p.position];
  for (const k of [...STAT_KEYS].sort((a, b) => weights[b] - weights[a])) {
    if (spare <= 1e-9) break;
    const r = feedAttribute(out, k, spare);
    out = r.persona;
    spare = r.left;
  }
  return out;
}

/** Match XP grows the attributes that matter for the position, by their weight. */
export function applyMatchGrowth<T extends Pick<Persona, 'stats' | 'position'>>(p: T, xp: number): T {
  const w = P.WEIGHTS[p.position];
  const keys = STAT_KEYS.filter((k) => w[k] >= P.START_SHAPE.primaryWeight);
  return applyXp(p, keys, xp, keys.map((k) => w[k]));
}
