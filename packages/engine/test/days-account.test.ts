import { describe, expect, it } from 'vitest';
import {
  applyAccountEvents,
  currentSeason,
  dayOf,
  getTrainingOption,
  missionAt,
  missionProgress,
  newAccount,
  newGame,
  normalizeAccount,
  personaOvr,
  playMatchDay,
  playWeek,
  trainDay,
  trainingOffer,
  xpToNext,
  type GameState,
} from '../src';

const start = (seed = 3): GameState =>
  newGame({ seed, persona: { id: 'p1', name: 'Aziz', position: 'ST', bonus: { shooting: 5, pace: 5 } } });

const nonRest = (s: GameState) => trainingOffer(s).find((o) => o !== 'rest') ?? trainingOffer(s)[0];

describe('training day and match day', () => {
  it('alternates: train, then play, then the next week', () => {
    const s0 = start();
    expect(dayOf(s0)).toBe('training');
    expect(() => playMatchDay(s0)).toThrow();
    const t = trainDay(s0, nonRest(s0));
    expect(dayOf(t.state)).toBe('match');
    expect(currentSeason(t.state).week).toBe(1);
    expect(() => trainDay(t.state, nonRest(t.state))).toThrow();
    const m = playMatchDay(t.state);
    expect(dayOf(m.state)).toBe('training');
    expect(currentSeason(m.state).week).toBe(2);
    expect(m.matchId).not.toBe('');
  });

  it('one training grows the attributes it works on, and only those', () => {
    const s0 = start();
    const opt = nonRest(s0);
    const t = trainDay(s0, opt);
    expect(t.xp).toBeGreaterThan(0);
    const grown = Object.keys(t.deltas);
    expect(grown.length).toBeGreaterThan(0);
    for (const k of grown) expect(getTrainingOption(opt).focus).toContain(k);
    expect(personaOvr(t.state.persona)).toBeGreaterThan(personaOvr(s0.persona));
  });

  it('a whole week is the same as the two days played separately', () => {
    const s0 = start(9);
    const opt = nonRest(s0);
    const whole = playWeek(s0, opt).state;
    const split = playMatchDay(trainDay(s0, opt).state).state;
    expect(split.persona).toEqual(whole.persona);
    expect(currentSeason(split).table).toEqual(currentSeason(whole).table);
  });

  it('a match played earns XP that grows the main attributes', () => {
    const s0 = start(5);
    const day2 = trainDay(s0, nonRest(s0)).state;
    const m = playMatchDay(day2);
    const ps = m.state.matches[m.matchId].personaStats!;
    if (ps.minutes > 0) {
      expect(m.xp).toBeGreaterThanOrEqual(15);
      expect(Object.keys(m.deltas).length).toBeGreaterThan(0);
    } else expect(m.xp).toBe(0);
  });
});

describe('account level and missions', () => {
  it('starts at level 1 with three missions', () => {
    const a = newAccount();
    expect(a.level).toBe(1);
    expect(a.missions).toHaveLength(3);
    expect(normalizeAccount(undefined)).toEqual(a);
  });

  it('levels up when XP passes the threshold, carrying the rest', () => {
    const many = Array.from({ length: 12 }, () => ({ type: 'training' as const }));
    const { account, reward } = applyAccountEvents(newAccount(), many);
    expect(reward.xp).toBeGreaterThanOrEqual(120);
    expect(account.level).toBeGreaterThan(1);
    expect(account.xp).toBeLessThan(xpToNext(account.level));
  });

  it('pays a finished mission and replaces it with the next one', () => {
    const first = missionAt(0);
    expect(first.kind).toBe('train');
    const { account, reward } = applyAccountEvents(newAccount(), Array.from({ length: first.target }, () => ({ type: 'training' as const })));
    expect(reward.missionsDone.map((m) => m.index)).toContain(0);
    expect(account.missions.map((m) => m.index)).not.toContain(0);
    expect(account.missions.map((m) => m.index)).toContain(3);
    // the new mission starts from zero
    const fresh = account.missions.find((m) => m.index === 3)!;
    expect(missionProgress(account, fresh).value).toBe(0);
  });

  it('missions get bigger in later rounds', () => {
    expect(missionAt(6).target).toBeGreaterThan(missionAt(0).target);
    expect(missionAt(6).xp).toBeGreaterThan(missionAt(0).xp);
  });

  it('a season of play earns levels and keeps the account in the save', () => {
    let s = start(11);
    while (s.phase === 'training') {
      s = dayOf(s) === 'training' ? trainDay(s, nonRest(s)).state : playMatchDay(s).state;
    }
    expect(s.account!.level).toBeGreaterThan(2);
    expect(s.account!.counters.seasons).toBe(1);
    expect(s.account!.counters.matches).toBeGreaterThan(0);
  });
});
