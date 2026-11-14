/**
 * The player's account level (separate from the persona's OVR).
 *
 * Everyone starts at level 1. XP comes from playing (each training day, each
 * match, a win, a good rating), from making the persona stronger (OVR gains)
 * and from missions. Three missions are active at a time; finishing one pays
 * its XP and the next one in the list takes its place. The list never ends:
 * the same kinds of goals come back with bigger targets.
 *
 * The account survives a new career (the web app carries it over), so the
 * level keeps growing across personas.
 */
import type { Account, AccountCounters, MissionKind } from './types';

export const ACTIVE_MISSIONS = 3;

/** XP for everyday actions. */
export const XP = {
  training: 10,
  match: 15,
  win: 10,
  /** Per rating point above 6.0 (a 7.5 gives 15). */
  ratingPoint: 10,
  /** Per whole OVR point the persona gains. */
  ovrPoint: 30,
  season: 60,
  promotion: 100,
} as const;

/** XP needed to go from `level` to the next one. */
export const xpToNext = (level: number) => 100 + (level - 1) * 60;

export interface MissionDef {
  /** Position in the endless list (also its id). */
  index: number;
  kind: MissionKind;
  target: number;
  xp: number;
}

const ORDER: MissionKind[] = ['train', 'play', 'goodGame', 'win', 'contribute', 'ovr'];
const BASE_TARGET: Record<MissionKind, number> = { train: 2, play: 2, goodGame: 1, win: 1, contribute: 1, ovr: 1 };
const STEP_TARGET: Record<MissionKind, number> = { train: 2, play: 2, goodGame: 1, win: 1, contribute: 2, ovr: 1 };

/** The mission at a position in the endless list. */
export function missionAt(index: number): MissionDef {
  const kind = ORDER[index % ORDER.length];
  const round = Math.floor(index / ORDER.length);
  const target = BASE_TARGET[kind] + STEP_TARGET[kind] * round;
  return { index, kind, target, xp: 40 + 20 * round + (kind === 'win' || kind === 'ovr' ? 20 : 0) };
}

/** Which counter a mission kind follows. */
const COUNTER: Record<MissionKind, keyof AccountCounters> = {
  train: 'trainings',
  play: 'matches',
  goodGame: 'goodGames',
  win: 'wins',
  contribute: 'contributions',
  ovr: 'ovrGained',
};

const emptyCounters = (): AccountCounters => ({ trainings: 0, matches: 0, wins: 0, goodGames: 0, contributions: 0, ovrGained: 0, seasons: 0, promotions: 0 });

export function newAccount(): Account {
  const counters = emptyCounters();
  return {
    level: 1,
    xp: 0,
    totalXp: 0,
    counters,
    missions: Array.from({ length: ACTIVE_MISSIONS }, (_, i) => ({ index: i, base: 0 })),
    nextMission: ACTIVE_MISSIONS,
    missionsDone: 0,
  };
}

/** Fills in an account from an older save (or none). */
export function normalizeAccount(a: Partial<Account> | null | undefined): Account {
  const fresh = newAccount();
  if (!a || typeof a !== 'object') return fresh;
  return {
    ...fresh,
    ...a,
    counters: { ...fresh.counters, ...(a.counters ?? {}) },
    missions: Array.isArray(a.missions) && a.missions.length ? a.missions : fresh.missions,
  };
}

/** Progress of an active mission, 0…target. */
export function missionProgress(account: Account, m: { index: number; base: number }): { def: MissionDef; value: number; done: boolean } {
  const def = missionAt(m.index);
  const raw = account.counters[COUNTER[def.kind]] - m.base;
  const value = Math.max(0, Math.min(def.target, def.kind === 'ovr' ? Math.floor(raw) : raw));
  return { def, value, done: value >= def.target };
}

export type AccountEvent =
  | { type: 'training' }
  | { type: 'match'; played: boolean; won: boolean; rating: number | null; contributions: number }
  | { type: 'ovr'; delta: number }
  | { type: 'season'; promoted: boolean };

/** What one step earned: shown by the game as rewards. */
export interface AccountReward {
  xp: number;
  levelBefore: number;
  levelAfter: number;
  missionsDone: MissionDef[];
}

export function applyAccountEvents(account: Account, events: AccountEvent[]): { account: Account; reward: AccountReward } {
  const c = { ...account.counters };
  let xp = 0;
  for (const e of events) {
    if (e.type === 'training') {
      c.trainings += 1;
      xp += XP.training;
    } else if (e.type === 'match') {
      if (!e.played) continue;
      c.matches += 1;
      xp += XP.match;
      if (e.won) {
        c.wins += 1;
        xp += XP.win;
      }
      if (e.rating !== null && e.rating >= 7) c.goodGames += 1;
      if (e.rating !== null && e.rating > 6) xp += Math.round((e.rating - 6) * XP.ratingPoint);
      c.contributions += e.contributions;
    } else if (e.type === 'ovr') {
      if (e.delta <= 0) continue;
      const before = Math.floor(c.ovrGained);
      c.ovrGained += e.delta;
      xp += (Math.floor(c.ovrGained) - before) * XP.ovrPoint;
    } else {
      c.seasons += 1;
      xp += XP.season;
      if (e.promoted) {
        c.promotions += 1;
        xp += XP.promotion;
      }
    }
  }

  // finished missions pay out and make room for the next ones
  let acc: Account = { ...account, counters: c };
  const missionsDone: MissionDef[] = [];
  const missions = acc.missions.map((m) => {
    const p = missionProgress(acc, m);
    if (!p.done) return m;
    missionsDone.push(p.def);
    xp += p.def.xp;
    const next = { index: acc.nextMission, base: c[COUNTER[missionAt(acc.nextMission).kind]] };
    acc = { ...acc, nextMission: acc.nextMission + 1 };
    return next;
  });
  acc = { ...acc, missions, missionsDone: acc.missionsDone + missionsDone.length };

  // level up
  let level = acc.level;
  let cur = acc.xp + xp;
  while (cur >= xpToNext(level)) {
    cur -= xpToNext(level);
    level += 1;
  }
  const next: Account = { ...acc, level, xp: cur, totalXp: acc.totalXp + xp };
  return { account: next, reward: { xp, levelBefore: account.level, levelAfter: level, missionsDone } };
}
