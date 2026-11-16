/**
 * The possession-chain match engine (docs/MATCH_ENGINE.md §12).
 */
import { describe, expect, it } from 'vitest';
import {
  actionShares,
  dribbleProbability,
  MATCH_CONFIG as MC,
  newGame,
  pickLineup,
  type PersonaOrder,
  passProbability,
  runMatch,
  shapeSpot,
  shotProbabilities,
  SLOTS,
  tackleProbability,
  type ActionType,
  type Attrs,
  type MatchLineup,
  type Position,
  type SimPlayer,
  type Situation,
  type SlotId,
} from '../src';
import { team } from '../scripts/calibrate-team';

const attrs = (over: Partial<Attrs> = {}): Attrs => ({
  PAC: 60, SHO: 60, PAS: 60, DRI: 60, DEF: 60, PHY: 60, VIS: 60, COM: 60, STA: 60, HEA: 60, GK_REF: 60, GK_HAN: 60, GK_POS: 60, GK_KIC: 60,
  ...over,
});
const player = (slot: SlotId, position: Position, a: Attrs = attrs()): SimPlayer => ({ id: slot, name: slot, position, slot, ovr: 60, attrs: a, persona: false });

/** A hand-made situation in the attack frame. */
function situation(o: { holder: SimPlayer; ball: { x: number; y: number }; pressure: 0 | 1 | 2; pressers?: Attrs[]; spaceBehind?: boolean; mates?: { slot: SlotId; pos: Position; x: number; y: number; markers?: number }[] }): Situation {
  const pressers = (o.pressers ?? Array.from({ length: o.pressure }, () => attrs())).map((a, i) => ({ id: `d${i}`, attrs: a }));
  const mates = (o.mates ?? [
    { slot: 'CM' as SlotId, pos: 'CM' as Position, x: o.ball.x - 12, y: 40, markers: 0 },
    { slot: 'CAM' as SlotId, pos: 'CAM' as Position, x: o.ball.x + 6, y: 55, markers: 1 },
    { slot: 'ST' as SlotId, pos: 'ST' as Position, x: Math.min(92, o.ball.x + 14), y: 50, markers: 1 },
    { slot: 'RB' as SlotId, pos: 'FB' as Position, x: o.ball.x - 15, y: 85, markers: 0 },
  ]).map((m) => ({ player: player(m.slot, m.pos), attrs: attrs(), spot: { x: m.x, y: m.y }, markers: m.markers ?? 0, markerDEF: 60 }));
  return { holder: o.holder, attrs: o.holder.attrs, ball: o.ball, pressure: o.pressure, pressers, mates, lastLine: 85, spaceBehind: o.spaceBehind ?? true, gk: attrs(), riskMul: 1 };
}
const PASSES: ActionType[] = ['SHORT_PASS', 'LONG_PASS', 'BACK_PASS', 'THROUGH_BALL', 'CROSS'];
const share = (s: Partial<Record<ActionType, number>>, types: ActionType[]) => types.reduce((t, k) => t + (s[k] ?? 0), 0);

const academy = (seed: number): Record<'home' | 'away', MatchLineup> => ({ home: team('h', 58 + (seed % 5), seed * 3 + 1), away: team('a', 58 + ((seed * 7) % 5), seed * 3 + 2) });
const MARKERS = new Set(['SUB', 'KICK_OFF', 'CORNER', 'FREE_KICK', 'GOAL_KICK', 'FOUL']);

describe('nothing is 100%', () => {
  it('every resolved probability stays inside [P_MIN, P_MAX]', () => {
    const extremes = [1, 30, 60, 99];
    for (const x of extremes)
      for (const y of extremes) {
        for (const p of [
          passProbability('short', attrs({ PAS: x, VIS: x }), y, 0, 0),
          passProbability('through', attrs({ PAS: x, VIS: x }), y, 2, 2),
          dribbleProbability(attrs({ DRI: x, PAC: x }), [attrs({ DEF: y, PAC: y })]),
          dribbleProbability(attrs({ DRI: x, PAC: x }), [attrs({ DEF: y }), attrs({ DEF: y })], true, false),
          tackleProbability(attrs({ DEF: x }), attrs({ DRI: y })),
          shotProbabilities(attrs({ SHO: x }), 'sixYard', 0, attrs({ GK_REF: y, GK_POS: y, GK_HAN: y })).onTarget,
          shotProbabilities(attrs({ SHO: x }), 'long', 2, attrs({ GK_REF: y, GK_POS: y, GK_HAN: y })).goalIfOn,
        ]) {
          expect(p).toBeGreaterThanOrEqual(MC.P_MIN);
          expect(p).toBeLessThanOrEqual(MC.P_MAX);
        }
      }
    for (let seed = 1; seed <= 20; seed++)
      for (const e of runMatch({ matchId: `b${seed}`, seed, lineups: academy(seed) }).log) {
        if (MARKERS.has(e.type)) continue;
        expect(e.probability).toBeGreaterThanOrEqual(MC.P_MIN - 1e-9);
        expect(e.probability).toBeLessThanOrEqual(MC.P_MAX + 1e-9);
      }
  });
});

describe('monotonic', () => {
  // never goes the wrong way, and clearly moves over the range (it may touch P_MIN / P_MAX at the ends)
  const up = (f: (v: number) => number) => {
    for (let v = 30; v < 90; v += 10) expect(f(v + 10)).toBeGreaterThanOrEqual(f(v));
    expect(f(70)).toBeGreaterThan(f(50));
  };
  const down = (f: (v: number) => number) => up((v) => -f(v));
  it('more DRI → more dribbles won, more DEF → fewer', () => {
    up((v) => dribbleProbability(attrs({ DRI: v }), [attrs()]));
    down((v) => dribbleProbability(attrs(), [attrs({ DEF: v })]));
    up((v) => dribbleProbability(attrs({ PAC: v }), [attrs()], true));
  });
  it('passes, shots and tackles follow the attributes too', () => {
    up((v) => passProbability('short', attrs({ PAS: v }), 60, 1, 0));
    down((v) => passProbability('long', attrs(), v, 0, 0, 40));
    up((v) => shotProbabilities(attrs({ SHO: v }), 'boxCentre', 0, attrs()).onTarget);
    up((v) => shotProbabilities(attrs({ SHO: v }), 'boxCentre', 0, attrs()).goalIfOn);
    down((v) => shotProbabilities(attrs(), 'boxCentre', 0, attrs({ GK_REF: v, GK_POS: v, GK_HAN: v })).goalIfOn);
    up((v) => tackleProbability(attrs({ DEF: v }), attrs()));
    down((v) => tackleProbability(attrs(), attrs({ DRI: v })));
  });
  it('the spec table: a free short pass between equals ~90%, under pressure ~83%, double-teamed ~73%', () => {
    // the absolute-technique term is zero at the reference level
    const a = attrs({ PAS: MC.skillAbs.ref, VIS: MC.skillAbs.ref });
    expect(passProbability('short', a, MC.skillAbs.ref, 0, 0)).toBeCloseTo(0.9, 1);
    expect(passProbability('short', a, MC.skillAbs.ref, 1, 0)).toBeCloseTo(0.83, 1);
    expect(passProbability('short', a, MC.skillAbs.ref, 2, 0)).toBeCloseTo(0.73, 1);
  });
});

describe('two defenders on one attacker', () => {
  it('a 2v1 dribble is much harder than a 1v1', () => {
    for (const d of [-15, -5, 0, 5, 15]) {
      const att = attrs({ DRI: 60 + d, PAC: 60 + d });
      const one = dribbleProbability(att, [attrs()]);
      const two = dribbleProbability(att, [attrs(), attrs()]);
      expect(two).toBeLessThan(one * 0.75);
    }
  });
  it('and makes passing (to the teammate left open) more likely', () => {
    const w = player('RW', 'W', attrs({ DRI: 62 }));
    const one = actionShares(situation({ holder: w, ball: { x: 70, y: 80 }, pressure: 1 }));
    const two = actionShares(situation({ holder: w, ball: { x: 70, y: 80 }, pressure: 2 }));
    expect(share(two, PASSES)).toBeGreaterThan(share(one, PASSES));
    expect(two.DRIBBLE ?? 0).toBeLessThan(one.DRIBBLE ?? 0);
  });
});

describe('players use their strengths', () => {
  const wingerShares = (a: Partial<Attrs>, space = true) =>
    actionShares(situation({ holder: player('RW', 'W', attrs(a)), ball: { x: 68, y: 82 }, pressure: 1, pressers: [attrs()], spaceBehind: space }));
  it('a tricky winger dribbles, a fast one knocks it past, a weak one passes', () => {
    const tricky = wingerShares({ DRI: 85, PAC: 55 });
    const fast = wingerShares({ DRI: 55, PAC: 88 });
    const weak = wingerShares({ DRI: 45, PAC: 45 });
    expect(tricky.DRIBBLE!).toBeGreaterThan(tricky.KNOCK_AND_RUN!);
    expect(fast.KNOCK_AND_RUN!).toBeGreaterThan(fast.DRIBBLE!);
    expect(share(weak, PASSES)).toBeGreaterThan((weak.DRIBBLE ?? 0) + (weak.KNOCK_AND_RUN ?? 0));
    expect(share(weak, PASSES)).toBeGreaterThan(share(tricky, PASSES));
  });
  it('a pressed centre-back in his own box clears rather than dribbles', () => {
    const cb = player('LCB', 'CB', attrs({ DRI: 60 }));
    const s = actionShares(situation({ holder: cb, ball: { x: 9, y: 45 }, pressure: 1, mates: [{ slot: 'GK', pos: 'GK', x: 3, y: 50, markers: 1 }, { slot: 'CDM', pos: 'CDM', x: 25, y: 50, markers: 1 }] }));
    expect(s.CLEAR ?? 0).toBeGreaterThan(5 * (s.DRIBBLE ?? 0));
    expect(s.CLEAR ?? 0).toBeGreaterThan(0.3);
  });
  it('a striker free in the box shoots', () => {
    const st = player('ST', 'ST', attrs({ SHO: 65 }));
    const s = actionShares(situation({ holder: st, ball: { x: 89, y: 50 }, pressure: 0 }));
    expect(s.SHOOT ?? 0).toBeGreaterThan(0.5);
  });
});

describe('team shape', () => {
  const spots = (inPossession: boolean, ballX: number, ballY = 50) => Object.fromEntries(SLOTS.map((s) => [s, shapeSpot('home', s, { x: ballX, y: ballY }, inPossession)]));
  it('defenders push up to about halfway in attack and forwards drop back in defence', () => {
    const attacking = spots(true, 80);
    for (const s of ['LCB', 'RCB'] as const) expect(attacking[s].x).toBeGreaterThan(40);
    for (const s of ['LCB', 'RCB'] as const) expect(attacking[s].x).toBeLessThanOrEqual(53);
    const defending = spots(false, 20);
    for (const s of ['LW', 'ST', 'RW'] as const) expect(defending[s].x).toBeLessThan(55);
    for (const s of ['LW', 'ST', 'RW'] as const) expect(defending[s].x).toBeGreaterThan(30);
    for (const s of ['LCB', 'RCB'] as const) expect(defending[s].x).toBeLessThan(20);
  });
  it('players never bunch up', () => {
    for (const inPos of [true, false])
      for (const bx of [10, 30, 50, 70, 90])
        for (const by of [10, 50, 90]) {
          const ps = Object.values(spots(inPos, bx, by));
          for (let i = 0; i < ps.length; i++)
            for (let j = i + 1; j < ps.length; j++) expect(Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y)).toBeGreaterThan(5);
        }
  });
  it('the away side mirrors the home side', () => {
    const h = shapeSpot('home', 'ST', { x: 30, y: 40 }, true);
    const a = shapeSpot('away', 'ST', { x: 70, y: 40 }, true);
    expect(a.x).toBeCloseTo(100 - h.x, 5);
    expect(a.y).toBeCloseTo(h.y, 5);
  });
});

describe('matches', () => {
  it('same seed → same match (replay and recording)', () => {
    const a = runMatch({ matchId: 'd', seed: 77, lineups: academy(3) });
    const b = runMatch({ matchId: 'd', seed: 77, lineups: academy(3) });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    const c = runMatch({ matchId: 'd', seed: 78, lineups: academy(3) });
    expect(JSON.stringify(c.log)).not.toBe(JSON.stringify(a.log));
  });

  it('the summary matches the log: goals, cards and changes', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const r = runMatch({ matchId: `s${seed}`, seed, lineups: academy(seed) });
      const goals = r.log.filter((e) => e.outcome === 'GOAL');
      expect(goals.length).toBe(r.score[0] + r.score[1]);
      expect(r.events.filter((e) => e.type === 'goal').length).toBe(goals.length);
      for (const e of r.events) if (e.seq !== undefined) expect(r.log[e.seq]).toBeTruthy();
      for (const side of ['home', 'away'] as const) expect(r.log.filter((e) => e.type === 'SUB' && e.side === side).length).toBeLessThanOrEqual(MC.subs.max);
      expect(r.log.every((e, i) => i === 0 || e.t >= r.log[i - 1].t)).toBe(true);
    }
  });

  it('calibration (§9, academy level): the averages land in the target ranges', () => {
    const n = 300;
    let goals = 0, shots = 0, onTarget = 0, passes = 0, passesDone = 0, dribbles = 0, dribblesWon = 0, corners = 0, fouls = 0, yellows = 0;
    for (let seed = 1; seed <= n; seed++) {
      const r = runMatch({ matchId: `c${seed}`, seed, lineups: academy(seed) });
      for (const t of [r.stats.home, r.stats.away]) {
        goals += t.goals; shots += t.shots; onTarget += t.onTarget; passes += t.passes; passesDone += t.passesDone;
        dribbles += t.dribbles; dribblesWon += t.dribblesWon; corners += t.corners; fouls += t.fouls; yellows += t.yellows;
      }
    }
    const per = (x: number) => x / (2 * n);
    // a little slack on each side for the smaller sample (the 1000-match table is in docs/MATCH_ENGINE_CALIBRATION.md)
    expect(goals / n).toBeGreaterThan(2.4);
    expect(goals / n).toBeLessThan(3.4);
    expect(per(shots)).toBeGreaterThan(9.5);
    expect(per(shots)).toBeLessThan(14.5);
    expect(per(onTarget)).toBeGreaterThan(3.3);
    expect(per(onTarget)).toBeLessThan(5.2);
    expect(goals / shots).toBeGreaterThan(0.085);
    expect(goals / shots).toBeLessThan(0.135);
    expect(passesDone / passes).toBeGreaterThan(0.69);
    expect(passesDone / passes).toBeLessThan(0.79);
    expect(dribblesWon / dribbles).toBeGreaterThan(0.38);
    expect(dribblesWon / dribbles).toBeLessThan(0.52);
    expect(per(corners)).toBeGreaterThan(3.6);
    expect(per(corners)).toBeLessThan(6.2);
    expect(per(fouls)).toBeGreaterThan(10.5);
    expect(per(fouls)).toBeLessThan(15.5);
    expect(per(yellows)).toBeGreaterThan(1.4);
    expect(per(yellows)).toBeLessThan(2.6);
  }, 60_000);

  it('the stronger team wins more often, but not always', () => {
    let wins = 0, losses = 0;
    const n = 300;
    for (let seed = 1; seed <= n; seed++) {
      const strongHome = seed % 2 === 0;
      const strong = team('s', 70, seed), weak = team('w', 55, seed + 9);
      const r = runMatch({ matchId: `w${seed}`, seed, lineups: strongHome ? { home: strong, away: weak } : { home: weak, away: strong } });
      const [s, w] = strongHome ? r.score : [r.score[1], r.score[0]];
      if (s > w) wins++;
      else if (s < w) losses++;
    }
    expect(wins / n).toBeGreaterThan(0.72);
    expect(wins / n).toBeLessThan(0.92);
    expect(losses).toBeGreaterThan(0);
  }, 60_000);

  it('is fast: a match takes well under 50 ms', () => {
    const lineups = academy(1);
    runMatch({ matchId: 'warm', seed: 1, lineups });
    const t0 = performance.now();
    for (let seed = 1; seed <= 40; seed++) runMatch({ matchId: `f${seed}`, seed, lineups });
    expect((performance.now() - t0) / 40).toBeLessThan(50);
  });
});

describe("the persona's orders during the match", () => {
  const setup = (seed: number) => {
    const s = newGame({ seed, persona: { id: 'me', name: 'Aziz', position: 'W', bonus: {} } });
    const club = s.clubs[s.persona.clubId];
    const other = Object.values(s.clubs).find((c) => c.id !== club.id && c.tier === club.tier)!;
    const me = { id: 'me', name: 'Aziz', position: 'W' as const, injuryWeeksLeft: 0, ovr: 55 };
    return { s, lineups: { home: pickLineup(club, { seed, persona: me }), away: pickLineup(other, { seed }) } };
  };
  const persona = (s: ReturnType<typeof setup>['s'], orders?: PersonaOrder[]) => ({ side: 'home' as const, position: 'W' as const, stats: s.persona.stats, fatigue: 10, role: 'start' as const, injuryRiskBonus: 0, ...(orders ? { orders } : {}) });

  it('nothing before the minute of an order changes (the replay can switch to the new match)', () => {
    for (const seed of [2, 5, 9]) {
      const { s, lineups } = setup(seed);
      const a = runMatch({ matchId: 'o', seed, lineups, persona: persona(s) });
      const b = runMatch({ matchId: 'o', seed, lineups, persona: persona(s, [{ from: 50, effort: 2, mentality: 2, confidence: 2 }]) });
      const before = (r: typeof a) => JSON.stringify(r.log.filter((e) => e.minute < 50));
      expect(before(b)).toBe(before(a));
    }
  });

  it('confident and attacking: more take-ons and shots; high effort: a heavier load', () => {
    let calm = 0, bold = 0;
    let loadHigh = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const { s, lineups } = setup(seed);
      const count = (orders?: PersonaOrder[]) => {
        const r = runMatch({ matchId: 'c', seed, lineups, persona: persona(s, orders) });
        if (orders?.[0].effort === 2) loadHigh += r.personaStats!.load ?? 1;
        return r.log.filter((e) => e.playerId === 'me' && ['DRIBBLE', 'KNOCK_AND_RUN', 'SHOOT'].includes(e.type)).length;
      };
      calm += count([{ from: 0, effort: 1, mentality: 0, confidence: 0 }]);
      bold += count([{ from: 0, effort: 2, mentality: 2, confidence: 2 }]);
    }
    expect(bold).toBeGreaterThan(calm * 1.3);
    expect(loadHigh / 25).toBeGreaterThan(1.3);
  }, 60_000);
});
