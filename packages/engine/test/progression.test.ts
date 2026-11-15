/**
 * Acceptance checks from docs/PROGRESSION_SYSTEM.md, section 11.
 */
import { describe, expect, it } from 'vitest';
import {
  applyMatchGrowth,
  applyXp,
  attrCost,
  constants as C,
  canAddCreationPoint,
  generateSquad,
  generateWorld,
  matchXp,
  migrateGame,
  newGame,
  ovr,
  overlevelMod,
  personaLevel,
  PROGRESSION_CONFIG as P,
  squadCounts,
  startStats,
  tierConfig,
  trainingXp,
  upgradeBlock,
  validateCreationPoints,
  POSITIONS,
  STAT_KEYS,
  type GameState,
  type Position,
  type StatKey,
  type Tier,
} from '../src';

/** Spends creation points on the most important attributes first, as long as the rules allow. */
function spendOnMain(position: Position): Partial<Record<StatKey, number>> {
  const w = P.WEIGHTS[position];
  const order = [...STAT_KEYS].sort((a, b) => w[b] - w[a]);
  const points: Partial<Record<StatKey, number>> = {};
  let left = P.CREATION_POINTS;
  for (const k of order) {
    while (left > 0 && canAddCreationPoint(position, points, k)) {
      points[k] = (points[k] ?? 0) + 1;
      left--;
    }
  }
  return points;
}

/**
 * An average player (rating 6.5, full matches, mixed results) through `seasons`
 * seasons: each training day picks the most useful of three offered trainings,
 * and its XP and the match XP grow the attributes automatically.
 */
function simulate(seasons: number, position: Position = 'ST'): number[] {
  let p = { stats: startStats(position), position };
  const w = P.WEIGHTS[position];
  const options = C.TRAINING_OPTIONS.filter((o) => o.focus.length);
  let tier: Tier = 4;
  const levels: number[] = [];
  for (let s = 0; s < seasons; s++) {
    for (let m = 0; m < 30; m++) {
      const offer = [options[m % options.length], options[(m + 2) % options.length], options[(m + 4) % options.length]];
      const best = offer.sort((a, b) => Math.max(...b.focus.map((k) => w[k])) - Math.max(...a.focus.map((k) => w[k])))[0];
      p = applyXp(p, best.focus, trainingXp(P.TRAINING.sessionsPerDay, tier));
      const t = tierConfig(tier);
      p = applyMatchGrowth(p, matchXp({
        rating: 6.5,
        minutes: 90,
        goals: 0,
        assists: 0,
        cleanSheet: false,
        position,
        result: (['win', 'draw', 'loss'] as const)[m % 3],
        tier,
        opponentOvr: (t.regular[0] + t.strong[1]) / 2,
        personaOvr: personaLevel(p),
      }));
    }
    levels.push(personaLevel(p));
    // a move up when strong enough for the next tier (§7.3)
    if (tier > 1 && personaLevel(p) >= tierConfig((tier - 1) as Tier).regular[0] + P.PROMOTION.ovrAboveNextRegularMin) tier = (tier - 1) as Tier;
  }
  return levels;
}

describe('progression spec — section 11', () => {
  it('a new persona without points is OVR 52', () => {
    for (const pos of POSITIONS) expect(ovr(startStats(pos), pos)).toBe(P.START_OVR);
    const g = newGame({ seed: 1, persona: { id: 'p', name: 'Aziz', position: 'CB', bonus: {} } });
    expect(personaLevel(g.persona)).toBe(52);
  });

  it('all 12 points on the main attributes still give OVR ≤ 55', () => {
    for (const pos of POSITIONS) {
      const points = spendOnMain(pos);
      expect(validateCreationPoints(pos, points)).toBeNull();
      const stats = startStats(pos);
      for (const k of STAT_KEYS) stats[k] += points[k] ?? 0;
      expect(ovr(stats, pos)).toBeLessThanOrEqual(P.CREATION_MAX_OVR);
    }
    // forcing past the cap is rejected (CB: 5 defending + 5 physical + 2 pace)
    expect(validateCreationPoints('CB', { defending: 5, physical: 5, pace: 2 })).toBe('ovr_cap');
    expect(validateCreationPoints('ST', { shooting: 6 })).toBe('points_per_attr');
    expect(validateCreationPoints('ST', { passing: 5, defending: 5, physical: 3 })).toBe('points_total');
  });

  it('attribute costs: about 60 XP at 52, 450 at 85, 6000 at 99', () => {
    // The spec's examples are the price of reaching that value (from one below),
    // matching the table in §5.1; attrCost(v) is the price of v → v+1.
    expect(attrCost(51)).toBe(60);
    expect(attrCost(52)).toBe(60);
    expect(attrCost(84)).toBeCloseTo(450, -1);
    expect(attrCost(98)).toBeGreaterThan(5900);
    expect(attrCost(98)).toBeLessThan(6100);
  });

  it('simulation: an average player reaches 62–65 in one season and about 80 after four', () => {
    const levels = simulate(4);
    expect(levels[0]).toBeGreaterThanOrEqual(62);
    expect(levels[0]).toBeLessThanOrEqual(65);
    expect(levels[3]).toBeGreaterThanOrEqual(77);
    expect(levels[3]).toBeLessThanOrEqual(84);
  });

  it('academy squads: no NPC above 62 and every club has a strong captain', () => {
    const world = generateWorld(7);
    for (const c of Object.values(world).filter((x) => x.tier === 4)) {
      expect(c.squad).toHaveLength(P.SQUAD.size);
      expect(Math.max(...c.squad.map((p) => p.ovr))).toBeLessThanOrEqual(62);
      expect(Math.min(...c.squad.map((p) => p.ovr))).toBeGreaterThanOrEqual(55);
      const captains = c.squad.filter((p) => p.captain);
      expect(captains).toHaveLength(1);
      expect(captains[0].role).toBe('strong');
    }
    const counts = squadCounts();
    expect(counts.strong + counts.good + counts.regular).toBe(P.SQUAD.size);
    expect(generateSquad('x', 1, 3)).toEqual(generateSquad('x', 1, 3));
  });

  it('an OVR 66 persona in the academy gets half the match XP', () => {
    expect(overlevelMod(66, 4)).toBe(0.5);
    expect(overlevelMod(62, 4)).toBe(1);
    expect(overlevelMod(64, 4)).toBe(0.75);
    const base = { rating: 7, minutes: 90, goals: 0, assists: 0, cleanSheet: false, position: 'ST' as const, result: 'win' as const, tier: 4 as Tier, opponentOvr: 66 };
    expect(matchXp({ ...base, personaOvr: 66 })).toBe(Math.round(matchXp({ ...base, personaOvr: 62, opponentOvr: 62 }) * 0.5));
  });

  it('OVR 99.9 shows as 99', () => {
    const stats = Object.fromEntries(STAT_KEYS.map((k) => [k, 99.9])) as Record<StatKey, number>;
    expect(ovr(stats, 'ST')).toBe(99);
  });
});

describe('progression rules', () => {
  it('match XP never drops below the minimum and grows with the rating', () => {
    const base = { minutes: 90, goals: 0, assists: 0, cleanSheet: false, position: 'ST' as const, result: 'loss' as const, tier: 4 as Tier, opponentOvr: 57, personaOvr: 52 };
    expect(matchXp({ ...base, rating: 3, minutes: 5 })).toBe(P.MATCH_XP.minXP);
    expect(matchXp({ ...base, rating: 8 })).toBeGreaterThan(matchXp({ ...base, rating: 6.5 }));
  });

  it('an attribute cannot go above OVR + 15 or 100', () => {
    const p = { stats: { ...startStats('ST'), shooting: 80 }, position: 'ST' as const, xp: 1e9 };
    expect(upgradeBlock(p, 'shooting')).toBe('above_ovr');
    expect(upgradeBlock({ ...p, stats: { ...p.stats, pace: 100 } }, 'pace')).toBe('max');
    expect(upgradeBlock({ ...p, xp: 0 }, 'pace')).toBe('xp');
  });

  it('old saves move to the new scale without losing their place', () => {
    const fresh = newGame({ seed: 2, persona: { id: 'p', name: 'Aziz', position: 'ST', bonus: {} } });
    // a version-1 save: 7 stats around OVR 40, no squads, 8 clubs per tier
    const oldStats = { pace: 42, shooting: 42, passing: 35, dribbling: 40, defending: 25, physical: 40, mentality: 38 };
    const clubs = Object.fromEntries(
      Object.values(fresh.clubs)
        .slice(0, 32)
        .map((c, i) => [c.id, { ...c, tier: ((i % 4) + 1) as Tier, squad: undefined as never }]),
    );
    const old = { ...fresh, version: 1, persona: { ...fresh.persona, stats: oldStats, xp: undefined as never, potential: 75 }, clubs } as unknown as GameState;
    const m = migrateGame(old);
    expect(m.version).toBe(2);
    expect('mentality' in m.persona.stats).toBe(false);
    expect(m.persona.xp).toBe(0);
    expect(personaLevel(m.persona)).toBeGreaterThanOrEqual(50);
    for (const c of Object.values(m.clubs)) expect(c.squad.length).toBe(P.SQUAD.size);
    expect(migrateGame(m)).toBe(m);
  });
});

describe('automatic growth', () => {
  it('pays the attribute prices: cheap at the start, slower later', () => {
    const p = { stats: startStats('ST'), position: 'ST' as const };
    const low = applyXp(p, ['shooting'], 120).stats.shooting - p.stats.shooting;
    const high = applyXp({ ...p, stats: { ...p.stats, shooting: 66 } }, ['shooting'], 120).stats.shooting - 66;
    expect(low).toBeGreaterThan(high);
    expect(low).toBeGreaterThan(1);
  });

  it('never pushes an attribute past OVR + 15; the rest goes to other important attributes', () => {
    const p = { stats: { ...startStats('ST'), shooting: 66 }, position: 'ST' as const };
    const out = applyXp(p, ['shooting'], 5000);
    expect(Math.floor(out.stats.shooting)).toBeLessThanOrEqual(personaLevel(out) + P.MAX_ATTR_ABOVE_OVR);
    expect(out.stats.pace + out.stats.dribbling).toBeGreaterThan(p.stats.pace + p.stats.dribbling);
  });

  it('match XP goes to the position\'s main attributes', () => {
    const p = { stats: startStats('CB'), position: 'CB' as const };
    const out = applyMatchGrowth(p, 200);
    expect(out.stats.defending).toBeGreaterThan(p.stats.defending);
    expect(out.stats.physical).toBeGreaterThan(p.stats.physical);
    expect(out.stats.shooting).toBe(p.stats.shooting);
  });
});
