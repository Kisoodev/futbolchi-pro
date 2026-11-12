import { describe, expect, it } from 'vitest';
import { createRng, hashSeed, simulateMatch, type MatchInput, type PersonaMatchInput } from '../src';
import { STAT_TEMPLATES } from '../src/constants';

const team = (id: string, r: number) => ({ id, ratings: { att: r, mid: r, def: r, gk: r } });

const persona = (over: Partial<PersonaMatchInput> = {}): PersonaMatchInput => ({
  side: 'home',
  position: 'ST',
  stats: { ...STAT_TEMPLATES.ST },
  fatigue: 0,
  role: 'start',
  injuryRiskBonus: 0,
  ...over,
});

const input = (seed: number, over: Partial<MatchInput> = {}): MatchInput => ({
  matchId: `m${seed}`,
  seed,
  home: team('a', 50),
  away: team('b', 50),
  persona: persona(),
  ...over,
});

describe('rng', () => {
  it('is deterministic per seed and differs across seeds', () => {
    const a = createRng(42), b = createRng(42), c = createRng(43);
    const sa = [a.next(), a.next(), a.next()];
    expect([b.next(), b.next(), b.next()]).toEqual(sa);
    expect(c.next()).not.toEqual(sa[0]);
  });
  it('int stays in range', () => {
    const r = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });
  it('hashSeed is stable', () => {
    expect(hashSeed('season', 1, 'week', 2)).toBe(hashSeed('season', 1, 'week', 2));
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
  });
});

describe('simulateMatch', () => {
  it('same input and seed produce identical results', () => {
    const r1 = simulateMatch(input(123));
    const r2 = simulateMatch(input(123));
    expect(r2).toEqual(r1);
    expect(JSON.parse(JSON.stringify(r1))).toEqual(r1); // plain serializable
  });

  it('different seeds produce different matches', () => {
    const results = new Set<string>();
    for (let s = 0; s < 20; s++) results.add(JSON.stringify(simulateMatch(input(s)).events));
    expect(results.size).toBeGreaterThan(15);
  });

  it('events are ordered by minute with unique ids and goals match the score', () => {
    for (let s = 0; s < 200; s++) {
      const r = simulateMatch(input(s));
      for (let i = 1; i < r.events.length; i++) expect(r.events[i].minute).toBeGreaterThanOrEqual(r.events[i - 1].minute);
      expect(new Set(r.events.map((e) => e.id)).size).toBe(r.events.length);
      const hg = r.events.filter((e) => e.type === 'goal' && e.team === 'home').length;
      const ag = r.events.filter((e) => e.type === 'goal' && e.team === 'away').length;
      expect([hg, ag]).toEqual(r.score);
      for (const e of r.events) {
        expect(e.minute).toBeGreaterThanOrEqual(0);
        expect(e.minute).toBeLessThanOrEqual(90);
        expect(e.path.length).toBeGreaterThan(0);
      }
    }
  });

  it('equal teams average roughly 2–3.5 goals per match', () => {
    let goals = 0;
    const N = 2000;
    for (let s = 0; s < N; s++) {
      const r = simulateMatch(input(s, { persona: null }));
      goals += r.score[0] + r.score[1];
    }
    const avg = goals / N;
    expect(avg).toBeGreaterThan(2);
    expect(avg).toBeLessThan(3.5);
  });

  it('a stronger team wins far more often', () => {
    let strongWins = 0, weakWins = 0;
    for (let s = 0; s < 1000; s++) {
      const r = simulateMatch(input(s, { home: team('s', 70), away: team('w', 45), persona: null }));
      if (r.score[0] > r.score[1]) strongWins++;
      if (r.score[1] > r.score[0]) weakWins++;
    }
    expect(strongWins).toBeGreaterThan(weakWins * 3);
  });

  it('a striker scores more than a centre-back on average', () => {
    let st = 0, cb = 0;
    for (let s = 0; s < 500; s++) {
      st += simulateMatch(input(s, { persona: persona({ position: 'ST' }) })).personaStats!.goals;
      cb += simulateMatch(input(s, { persona: persona({ position: 'CB', stats: { ...STAT_TEMPLATES.CB } }) })).personaStats!.goals;
    }
    expect(st).toBeGreaterThan(cb * 3);
  });

  it('a better shooter scores more', () => {
    let low = 0, high = 0;
    for (let s = 0; s < 500; s++) {
      low += simulateMatch(input(s)).personaStats!.goals;
      high += simulateMatch(input(s, { persona: persona({ stats: { ...STAT_TEMPLATES.ST, shooting: 80 } }) })).personaStats!.goals;
    }
    expect(high).toBeGreaterThan(low);
  });

  it('bench persona plays 0 minutes and has no persona events', () => {
    const r = simulateMatch(input(5, { persona: persona({ role: 'bench' }) }));
    expect(r.personaStats!.minutes).toBe(0);
    expect(r.personaStats!.rating).toBeNull();
    expect(r.events.some((e) => e.actor === 'persona')).toBe(false);
  });

  it('a sub comes on between 60 and 75 and only acts afterwards', () => {
    for (let s = 0; s < 100; s++) {
      const r = simulateMatch(input(s, { persona: persona({ role: 'sub' }) }));
      const on = r.events.find((e) => e.type === 'substitution' && e.detail?.personaIn === true)!;
      expect(on.minute).toBeGreaterThanOrEqual(60);
      expect(on.minute).toBeLessThanOrEqual(75);
      for (const e of r.events) if (e.actor === 'persona') expect(e.minute).toBeGreaterThanOrEqual(on.minute);
    }
  });

  it('a very tired starter is subbed off at 65', () => {
    const r = simulateMatch(input(9, { persona: persona({ fatigue: 90 }) }));
    const ps = r.personaStats!;
    expect(ps.minutes).toBeLessThanOrEqual(65);
    expect(r.events.some((e) => e.type === 'substitution' && e.detail?.personaIn === false)).toBe(true);
  });

  it('higher fatigue and training risk raise injury rate', () => {
    let fresh = 0, risky = 0;
    for (let s = 0; s < 2000; s++) {
      if (simulateMatch(input(s)).personaStats!.injuryWeeks > 0) fresh++;
      if (simulateMatch(input(s, { persona: persona({ fatigue: 60, injuryRiskBonus: 0.03 }) })).personaStats!.injuryWeeks > 0) risky++;
    }
    expect(risky).toBeGreaterThan(fresh * 1.5);
  });

  it('goalkeeper persona records saves and conceded goals, never scores', () => {
    let saves = 0, goals = 0;
    for (let s = 0; s < 300; s++) {
      const ps = simulateMatch(input(s, { persona: persona({ position: 'GK', stats: { ...STAT_TEMPLATES.GK } }) })).personaStats!;
      saves += ps.saves;
      goals += ps.goals;
    }
    expect(saves).toBeGreaterThan(0);
    expect(goals).toBe(0);
  });

  it('ratings stay within 3–10', () => {
    for (let s = 0; s < 300; s++) {
      const r = simulateMatch(input(s)).personaStats!.rating;
      if (r !== null) {
        expect(r).toBeGreaterThanOrEqual(3);
        expect(r).toBeLessThanOrEqual(10);
      }
    }
  });
});
