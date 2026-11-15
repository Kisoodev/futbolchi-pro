/**
 * Match engine v2 — the possession-chain model of docs/MATCH_ENGINE.md.
 *
 * The player on the ball reads the situation (zone, pressure, who is open),
 * scores each possible action (role × skill × expected success × reward ×
 * risk), picks one with a softmax, and the action is resolved against the
 * defender with p = clamp(sigmoid(base + (A − D)/S + mods)). Every action is
 * written to a detailed log (for the 2D replay, highlights and stats); the
 * match's summary events (goals, chances, cards, changes) are built from it.
 *
 * Pure and deterministic: two lineups + seed (+ the persona's stats) → the
 * same log every time, so the replay can rebuild it instead of storing it.
 */
import * as C from '../constants';
import { effectiveStats } from '../positions';
import { clamp, createRng, hashSeed, type Rng } from '../rng';
import { REPLACE } from '../squadplay';
import type { MatchEvent, MatchLineup, MatchPersonaInput, PersonaMatchStats, PlayerMatchLine, Position, Side, SlotId } from '../types';
import { MATCH_CONFIG as MC } from './config';
import { toSimPlayer, type Attrs, type SimPlayer } from './players';
import { dist, shapeSpot, toAttack, type Point } from './shape';

// ------------------------------------------------------------------ types

export type ActionType =
  | 'SHORT_PASS'
  | 'LONG_PASS'
  | 'THROUGH_BALL'
  | 'CROSS'
  | 'DRIBBLE'
  | 'KNOCK_AND_RUN'
  | 'CARRY'
  | 'SHOOT'
  | 'HOLD_UP'
  | 'CLEAR'
  | 'BACK_PASS';

export type EventType = ActionType | 'TACKLE' | 'HEADER' | 'LOOSE_BALL' | 'KICK_OFF' | 'THROW_IN' | 'CORNER' | 'FREE_KICK' | 'PENALTY' | 'GOAL_KICK' | 'FOUL' | 'SUB' | 'GK_CLAIM';

export type Outcome =
  | 'COMPLETE'
  | 'LOOSE_KEPT'
  | 'LOOSE_LOST'
  | 'INTERCEPTED'
  | 'OUT'
  | 'BEAT'
  | 'LOST'
  | 'FOUL_WON'
  | 'PUSHED_WIDE'
  | 'GOAL'
  | 'SAVED_CAUGHT'
  | 'SAVED_PARRIED'
  | 'BLOCKED'
  | 'OFF_TARGET'
  | 'WOODWORK'
  | 'WON'
  | 'HELD'
  | 'CLEARED'
  | 'MISKICK'
  | 'YELLOW'
  | 'RED'
  | 'CLAIMED'
  | 'DONE';

/** A zone in the acting team's frame: row 1 (own box) … 6 (opponent box), lane L / C / R. */
export interface Zone {
  row: number;
  lane: 'L' | 'C' | 'R';
}

/** One entry of the action log (docs/MATCH_ENGINE.md §10). Points are pitch coordinates (home attacks to x = 100). */
export interface SimEvent {
  /** Match time in seconds. */
  t: number;
  minute: number;
  type: EventType;
  side: Side;
  playerId: string;
  /** Pass receiver / player coming on / who won the ball. */
  targetId?: string;
  opponentIds: string[];
  from: Point;
  to?: Point;
  fromZone: Zone;
  toZone?: Zone;
  pressure: 0 | 1 | 2;
  probability: number;
  /** Shots: chance of a goal (on target × beats the keeper). */
  xg?: number;
  outcome: Outcome;
  highlight?: boolean;
}

export interface TeamMatchStats {
  goals: number;
  shots: number;
  onTarget: number;
  passes: number;
  passesDone: number;
  dribbles: number;
  dribblesWon: number;
  corners: number;
  fouls: number;
  yellows: number;
  reds: number;
  tackles: number;
  possession: number;
  penalties: number;
}

export type PersonaSimInput = MatchPersonaInput;

export interface SimInput {
  matchId: string;
  seed: number;
  lineups: Record<Side, MatchLineup>;
  persona?: PersonaSimInput | null;
}

export interface SimResult {
  score: [number, number];
  events: MatchEvent[];
  log: SimEvent[];
  personaStats: PersonaMatchStats | null;
  players: PlayerMatchLine[];
  stats: Record<Side, TeamMatchStats>;
}

// ------------------------------------------------------------------ resolution (§5)

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const gauss = (rng: Rng) => Math.sqrt(-2 * Math.log(Math.max(1e-9, rng.next()))) * Math.cos(2 * Math.PI * rng.next());
/** p = clamp(sigmoid(base + (A − D)/S + mods), P_MIN, P_MAX) */
export const resolveP = (base: number, A: number, D: number, mods = 0) => clamp(sigmoid(base + (A - D) / MC.S + mods), MC.P_MIN, MC.P_MAX);
const bounded = (p: number) => clamp(p, MC.P_MIN, MC.P_MAX);

export type PassKind = 'short' | 'back' | 'long' | 'through' | 'cross';
const PASS_BASE: Record<PassKind, number> = { short: MC.pass.short, back: MC.pass.short, long: MC.pass.long, through: MC.pass.through, cross: MC.pass.cross };

/** §5.2: A = 0.75·PAS + 0.25·VIS against the nearest opponent's DEF. */
export function passProbability(kind: PassKind, passer: Attrs, defenderDEF: number, pressure: number, markers: number, length = 0): number {
  const pd = MC.passDetail;
  const scale = pd.pressureScale[kind];
  const pressureMod = pressure >= 2 ? MC.pass.pressure2 * scale : pressure === 1 ? MC.pass.pressure1 * scale : 0;
  const markMod = markers >= 2 ? pd.marked2 : markers === 1 ? pd.marked1 : 0;
  const absMod = (0.75 * passer.PAS + 0.25 * passer.VIS - MC.skillAbs.ref) / MC.skillAbs.scale;
  const lengthMod = kind === 'long' ? -pd.lengthPenalty * Math.max(0, length - pd.lengthFree) : 0;
  return resolveP(PASS_BASE[kind], 0.75 * passer.PAS + 0.25 * passer.VIS, defenderDEF, pressureMod + (kind === 'cross' ? 0 : markMod) + lengthMod + absMod);
}

/** §5.3: dribble (technique) or knock-and-run (pace), 1v1 or against two defenders. */
export function dribbleProbability(att: Attrs, defenders: Attrs[], knock = false, space = true): number {
  const A = knock ? 0.8 * att.PAC + 0.2 * att.DRI : 0.8 * att.DRI + 0.2 * att.PAC;
  const ds = defenders.map((d) => (knock ? 0.6 * d.PAC + 0.4 * d.DEF : 0.7 * d.DEF + 0.3 * d.PAC));
  let base = MC.dribble.base + (knock && !space ? MC.dribble.knockNoSpace : 0);
  let D = ds[0] ?? 40;
  if (ds.length >= 2) {
    D = Math.max(ds[0], ds[1]) + (MC.dribble.DOUBLE_TEAM_FACTOR * Math.min(ds[0], ds[1])) / 10;
    base += MC.dribble.DOUBLE_TEAM_PENALTY;
  }
  return resolveP(base, A, D, (A - MC.skillAbs.dribbleRef) / MC.skillAbs.dribbleScale);
}

export type ShotZone = keyof typeof MC.shot.zones;

/** The shot zone of an attack-frame point. */
export function shotZone(p: Point): ShotZone {
  const off = Math.abs(p.y - 50);
  if (p.x >= 94 && off <= 10) return 'sixYard';
  if (p.x >= 83 && off <= 11) return 'boxCentre';
  if (p.x >= 83 && off <= 22) return 'boxWide';
  if (p.x >= 78 && off <= 26) return 'boxEdge';
  return 'long';
}

export const gkEff = (gk: Attrs) => 0.5 * gk.GK_REF + 0.3 * gk.GK_POS + 0.2 * gk.GK_HAN;

/** §5.4: p(on target) and p(goal | on target). Headers use HEA and ×0.75 quality. */
export function shotProbabilities(shooter: Attrs, zone: ShotZone, pressure: number, gk: Attrs, header = false, oneOnOne = false, ref = 60): { onTarget: number; goalIfOn: number } {
  const z = MC.shot.zones[zone];
  const sho = header ? shooter.HEA : shooter.SHO;
  const onTarget = bounded(sigmoid(z.base + (oneOnOne ? 0.3 : 0) + (sho - ref) / 15 - MC.shot.pressurePenalty * pressure));
  const quality = z.quality * (header ? MC.shot.headerQuality : 1);
  const goalIfOn = bounded(quality + (sho - gkEff(gk)) / 200 + (MC.keeperAbs.ref - gkEff(gk)) / MC.keeperAbs.scale + (oneOnOne ? (60 - gk.GK_POS) / 300 : 0));
  return { onTarget, goalIfOn };
}

/** §5.5: tackle A = DEF vs D = DRI. */
export const tackleProbability = (defender: Attrs, holder: Attrs) => resolveP(MC.tackle.base, defender.DEF, holder.DRI);

// ------------------------------------------------------------------ decision (§4)

/** What the player on the ball sees. All points in the attack frame (attacking towards x = 100). */
export interface Situation {
  holder: SimPlayer;
  attrs: Attrs;
  ball: Point;
  pressure: 0 | 1 | 2;
  pressers: { id: string; attrs: Attrs }[];
  mates: { player: SimPlayer; attrs: Attrs; spot: Point; markers: number; markerDEF: number }[];
  /** Highest x of an opposing outfield player (their last line). */
  lastLine: number;
  /** Free space behind the nearest defender. */
  spaceBehind: boolean;
  gk: Attrs;
  /** League reference for shooting (60 at academy level, higher in stronger leagues). */
  shotRef?: number;
  /** Late-game risk multiplier (leading < 1 < trailing). */
  riskMul: number;
}

export interface Option {
  type: ActionType;
  p: number;
  utility: number;
  target?: Point;
  receiver?: SimPlayer;
  kind?: PassKind;
  zone?: ShotZone;
}

export const rowOf = (x: number) => clamp(Math.floor(x / (100 / 6)) + 1, 1, 6);
export const laneOf = (y: number): Zone['lane'] => (y < 100 / 3 ? 'L' : y > 200 / 3 ? 'R' : 'C');

/** Value of having the ball at an attack-frame point. */
export function valueAt(p: Point): number {
  const v = MC.value;
  let val = v.lo + (v.hi - v.lo) * Math.pow(clamp(p.x, 0, 100) / 100, v.pow);
  if (p.x > 66 && Math.abs(p.y - 50) > 25) val -= v.wideCut;
  return val;
}

const SLOT_POS: Record<SlotId, Position> = { GK: 'GK', LB: 'FB', RB: 'FB', LCB: 'CB', RCB: 'CB', CDM: 'CDM', CM: 'CM', CAM: 'CAM', LW: 'W', RW: 'W', ST: 'ST' };
const ATT_SLOTS: SlotId[] = ['LW', 'ST', 'RW', 'CAM'];
/** The role the player is playing (their slot). */
const roleOf = (p: SimPlayer): Position => SLOT_POS[p.slot];

/** Every possible action for the situation, with its utility (§4.2). */
export function evaluateOptions(s: Situation): Option[] {
  const out: Option[] = [];
  const { attrs: a, ball } = s;
  const role = roleOf(s.holder);
  const rw = MC.roleWeight[role];
  const row = rowOf(ball.x);
  const risk = (t: ActionType) => {
    const e = MC.riskExp[t];
    return Math.pow(MC.riskByRow[row - 1], e) * (e > 0 ? Math.pow(s.riskMul, e) : 1);
  };
  const add = (o: Omit<Option, 'utility'>, fit: number, reward: number) => {
    const u = rw[o.type] * fit * o.p * reward * risk(o.type) * MC.UTILITY_SCALE;
    if (u > 0) out.push({ ...o, utility: u });
  };
  const pd = MC.passDetail;

  // passes to each teammate
  for (const m of s.mates) {
    const d = dist(ball, m.spot);
    if (d < 4) continue;
    const back = m.spot.x < ball.x - 8 && (roleOf(m.player) === 'CB' || roleOf(m.player) === 'GK' || roleOf(m.player) === 'CDM');
    if (roleOf(m.player) === 'GK' && ball.x > 40) continue;
    const kind: PassKind | null = back && d <= pd.longMax ? 'back' : d <= pd.shortMax ? 'short' : d <= pd.longMax ? 'long' : null;
    if (!kind) continue;
    const p = passProbability(kind, a, m.markerDEF, s.pressure, m.markers, d);
    let reward = valueAt(m.spot) * (kind === 'back' ? 0.85 : 1);
    if (m.markers === 0) reward *= s.pressure >= 2 ? MC.OPEN_TEAMMATE_BONUS : s.pressure === 1 ? 1 + (MC.OPEN_TEAMMATE_BONUS - 1) / 2 : 1;
    const type: ActionType = kind === 'back' ? 'BACK_PASS' : kind === 'short' ? 'SHORT_PASS' : 'LONG_PASS';
    const fit = kind === 'long' ? (0.6 * a.PAS + 0.4 * a.VIS) / 100 : a.PAS / 100;
    add({ type, p, target: m.spot, receiver: m.player, kind }, fit, reward);

    // through balls into the space behind the last line
    if (ATT_SLOTS.includes(m.player.slot) && ball.x >= 35 && m.spot.x > ball.x + 4 && m.spot.x > s.lastLine - 12 && s.lastLine < 90) {
      const target = { x: clamp(s.lastLine + 8, 0, 95), y: clamp(m.spot.y + (50 - m.spot.y) * 0.25, 5, 95) };
      const tp = passProbability('through', a, m.markerDEF, s.pressure, 0);
      add({ type: 'THROUGH_BALL', p: tp, target, receiver: m.player, kind: 'through' }, a.VIS / 100, valueAt(target) + MC.value.throughBonus);
    }
  }

  // cross from wide in the last third
  if (ball.x >= 68 && Math.abs(ball.y - 50) >= 18) {
    const target = { x: 91, y: 50 };
    const p = passProbability('cross', a, 55, s.pressure, 0);
    add({ type: 'CROSS', p, target, kind: 'cross' }, a.PAS / 100, valueAt(target) * MC.crossReward);
  }

  // take on the defender
  if (s.pressure >= 1) {
    const defs = s.pressers.map((x) => x.attrs);
    const ahead = { x: clamp(ball.x + 10, 0, 97), y: ball.y };
    add({ type: 'DRIBBLE', p: dribbleProbability(a, defs, false), target: ahead }, a.DRI / 100, valueAt(ahead) + MC.value.beatBonus);
    const run = { x: clamp(ball.x + 16, 0, 97), y: ball.y };
    const kp = dribbleProbability(a, defs, true, s.spaceBehind);
    add({ type: 'KNOCK_AND_RUN', p: kp, target: run }, clamp((a.PAC - (defs[0]?.PAC ?? 50) + 50) / 100, 0.05, 1), valueAt(run) + MC.value.beatBonus);
  } else {
    const ahead = { x: clamp(ball.x + 10, 0, 96), y: ball.y + (50 - ball.y) * (ball.x > 70 ? 0.25 : 0) };
    add({ type: 'CARRY', p: resolveP(MC.carryBase, a.DRI, 50), target: ahead }, (0.5 * a.DRI + 0.5 * a.PAC) / 100, valueAt(ahead));
  }

  // shoot: rows 5–6, or row 4 with a strong shot
  if (role !== 'GK' && (ball.x >= 66 || (ball.x >= 55 && a.SHO >= 70))) {
    const zone = shotZone(ball);
    const pr = shotProbabilities(a, zone, s.pressure, s.gk, false, false, s.shotRef);
    add({ type: 'SHOOT', p: pr.onTarget, zone }, a.SHO / 100, MC.value.goal * pr.goalIfOn);
  }

  // hold the ball up for support
  if (s.pressure >= 1 && ball.x >= 50 && role !== 'GK') {
    const D = s.pressers[0] ? 0.5 * s.pressers[0].attrs.DEF + 0.5 * s.pressers[0].attrs.PHY : 50;
    add({ type: 'HOLD_UP', p: resolveP(MC.holdUp.base, 0.6 * a.PHY + 0.4 * a.DRI, D) }, a.PHY / 100, valueAt(ball) * 0.95);
  }

  // clear the danger
  if (row <= 2 && s.pressure >= 1) {
    add({ type: 'CLEAR', p: resolveP(MC.clear.base - 0.4 * s.pressure, 0.5 * a.PAS + 0.5 * a.COM, 60) }, (0.5 * a.PHY + 0.5 * a.PAS) / 100, 0.5);
  }
  return out;
}

/** T = T_BASE × (1.4 − COM/100) */
export const temperature = (a: Attrs) => MC.T_BASE * (1.4 - a.COM / 100);

/** Softmax probabilities of the options. */
export function choiceProbabilities(options: Option[], a: Attrs): number[] {
  const T = temperature(a);
  const max = Math.max(...options.map((o) => o.utility));
  const ws = options.map((o) => Math.exp((o.utility - max) / T));
  const total = ws.reduce((x, y) => x + y, 0);
  return ws.map((w) => w / total);
}

/** Share of each action type for a situation (sums the softmax over the options). */
export function actionShares(s: Situation): Partial<Record<ActionType, number>> {
  const opts = evaluateOptions(s);
  const ps = choiceProbabilities(opts, s.attrs);
  const out: Partial<Record<ActionType, number>> = {};
  opts.forEach((o, i) => (out[o.type] = (out[o.type] ?? 0) + ps[i]));
  return out;
}

// ------------------------------------------------------------------ match state

interface Entry {
  p: SimPlayer;
  side: Side;
  from: number;
  to: number | null;
  /** Pre-rolled injury minute (NPCs). */
  hurtAt: number | null;
  /** Can't be changed for tiredness (persona, Odil, Abu, goalkeepers). */
  keep: boolean;
}

interface Line {
  id: string;
  name: string;
  position: Position;
  side: Side;
  persona: boolean;
  from: number;
  to: number | null;
  goals: number;
  assists: number;
  keyPasses: number;
  shots: number;
  shotsOn: number;
  passes: number;
  passesDone: number;
  dribbles: number;
  dribblesWon: number;
  tackles: number;
  tacklesWon: number;
  interceptions: number;
  fouls: number;
  yellow: number;
  red: number;
  saves: number;
  conceded: number;
}

const other = (s: Side): Side => (s === 'home' ? 'away' : 'home');
const emptyTeamStats = (): TeamMatchStats => ({ goals: 0, shots: 0, onTarget: 0, passes: 0, passesDone: 0, dribbles: 0, dribblesWon: 0, corners: 0, fouls: 0, yellows: 0, reds: 0, tackles: 0, possession: 0, penalties: 0 });

function blankPersonaStats(role: import('../types').PersonaRole): PersonaMatchStats {
  return { role, minutes: 0, goals: 0, assists: 0, keyChances: 0, duelsWon: 0, duelsLost: 0, saves: 0, conceded: 0, yellow: 0, red: 0, injuryWeeks: 0, rating: null };
}

/** Plays a match with the possession-chain engine. */
export function runMatch(input: SimInput): SimResult {
  const rng: Rng = createRng(hashSeed(input.seed, 'v2'));
  const persona = input.persona ?? null;
  const personaStats = persona ? blankPersonaStats(persona.role) : null;
  const personaAttrsStats = persona ? effectiveStats(persona.stats, persona.fatigue) : undefined;

  // ---- squads
  const pitch: Record<Side, Map<SlotId, Entry>> = { home: new Map(), away: new Map() };
  const bench: Record<Side, SimPlayer[]> = { home: [], away: [] };
  const subsUsed: Record<Side, number> = { home: 0, away: 0 };
  const lines = new Map<string, Line>();
  const stats: Record<Side, TeamMatchStats> = { home: emptyTeamStats(), away: emptyTeamStats() };
  const lineOf = (p: SimPlayer, side: Side, from: number): Line => {
    let l = lines.get(p.id);
    if (!l) {
      l = { id: p.id, name: p.name, position: p.position, side, persona: p.persona, from, to: null, goals: 0, assists: 0, keyPasses: 0, shots: 0, shotsOn: 0, passes: 0, passesDone: 0, dribbles: 0, dribblesWon: 0, tackles: 0, tacklesWon: 0, interceptions: 0, fouls: 0, yellow: 0, red: 0, saves: 0, conceded: 0 };
      lines.set(p.id, l);
    }
    return l;
  };
  for (const side of ['home', 'away'] as Side[]) {
    const lu = input.lineups[side];
    for (const lp of lu.starters) {
      const p = toSimPlayer(lp, lp.persona ? personaAttrsStats : undefined);
      const keep = p.persona || p.slot === 'GK' || p.characterKey === 'odil' || p.characterKey === 'abu';
      pitch[side].set(p.slot, { p, side, from: 0, to: null, keep, hurtAt: !p.persona && rng.chance(C.NPC_INJURY_CHANCE) ? rng.int(8, 88) : null });
      lineOf(p, side, 0);
    }
    bench[side] = lu.bench.map((lp) => toSimPlayer(lp));
  }
  const allStarters = [...input.lineups.home.starters, ...input.lineups.away.starters];
  const matchLevel = allStarters.reduce((s, p) => s + p.ovr, 0) / Math.max(1, allStarters.length);
  const shotRef = 60 + MC.skillAbs.shotLeague * Math.max(0, matchLevel - 60);
  // match-day form of each team (a good or a bad day)
  const form: Record<Side, number> = { home: gauss(rng) * MC.strength.formSd, away: gauss(rng) * MC.strength.formSd };
  const personaEntry = () => {
    if (!persona) return null;
    for (const e of pitch[persona.side].values()) if (e.p.persona) return e;
    return null;
  };

  // ---- persona's own match plan: tiredness and a pre-rolled injury (as before)
  let personaOffAt: number | null = null;
  let personaOffReason: 'fatigue' | 'injury' | null = null;
  if (persona && personaEntry()) {
    if (persona.fatigue > C.FATIGUE_SUB_THRESHOLD) {
      personaOffAt = C.FATIGUE_SUB_MINUTE;
      personaOffReason = 'fatigue';
    }
    // the persona is hurt less often than an ordinary player (MATCH_CONFIG.persona)
    const pInjury = (C.INJURY_BASE + C.INJURY_FATIGUE_FACTOR * (persona.fatigue / 100) + persona.injuryRiskBonus) * MC.persona.injuryMul;
    if (rng.chance(pInjury)) {
      const minute = rng.int(1, personaOffAt ?? 90);
      personaOffAt = minute;
      personaOffReason = 'injury';
      personaStats!.injuryWeeks = rng.int(C.INJURY_WEEKS_MIN, C.INJURY_WEEKS_MAX);
    }
  }

  // ---- log + clock
  const log: SimEvent[] = [];
  const summary: (Omit<MatchEvent, 'id' | 'highlight'> & { highlight?: boolean; seq: number })[] = [];
  let tk = 0;
  const minuteNow = () => clamp(Math.floor((tk / MC.TICKS_PER_MATCH) * 90) + 1, 1, 90);
  const score: [number, number] = [0, 0];
  const goalsOf = (side: Side) => (side === 'home' ? score[0] : score[1]);
  const actorFor = (side: Side, isPersona: boolean): MatchEvent['actor'] => {
    if (isPersona) return 'persona';
    if (!persona) return side === 'home' ? 'teammate' : 'opponent';
    return side === persona.side ? 'teammate' : 'opponent';
  };
  const pitchPoint = (side: Side, a: Point): Point => ({ x: toAttack(side, a.x), y: a.y });
  const zoneOf = (side: Side, pitchP: Point): Zone => {
    const ax = toAttack(side, pitchP.x);
    return { row: rowOf(ax), lane: laneOf(pitchP.y) };
  };
  const record = (e: Omit<SimEvent, 't' | 'minute' | 'fromZone' | 'toZone'>): number => {
    log.push({
      ...e,
      probability: Math.round(e.probability * 1000) / 1000,
      ...(e.xg !== undefined ? { xg: Math.round(e.xg * 1000) / 1000 } : {}),
      t: Math.round(tk * MC.SECONDS_PER_TICK),
      minute: minuteNow(),
      fromZone: zoneOf(e.side, e.from),
      ...(e.to ? { toZone: zoneOf(e.side, e.to) } : {}),
    });
    return log.length - 1;
  };

  // ---- effective attributes (§3, §8)
  const fatigueFactor = (e: Entry) => {
    const m = minuteNow() - e.from;
    return 1 - (Math.max(0, m - MC.FATIGUE_START_MIN) / 35) * (1 - e.p.attrs.STA / 100) * MC.FATIGUE_MAX;
  };
  const effCache = new Map<Entry, { at: number; a: Attrs }>();
  let effMinute = -1;
  let effTk = -1;
  const eff = (e: Entry): Attrs => {
    if (effTk !== tk) {
      effTk = tk;
      // attributes change slowly: recomputed every three minutes
      effMinute = Math.floor(minuteNow() / 3);
    }
    const at = effMinute;
    const cached = effCache.get(e);
    if (cached && cached.at === at) return cached.a;
    const f = fatigueFactor(e) * (e.side === 'home' ? MC.homeMorale : 1);
    const k = MC.strength.compression;
    const kp = MC.strength.passCompression;
    const lift = form[e.side];
    const oop = SLOT_POS[e.p.slot] !== e.p.position && e.p.position !== 'GK' && e.p.slot !== 'GK' ? MC.OUT_OF_POSITION_PENALTY : 0;
    const c = MC.strength.saturation;
    const r = e.p.attrs;
    // pulled towards the match level (big gaps saturate: a star still cannot beat a team alone), form, tiredness
    const m = (raw: number, kk: number) => (matchLevel + c * Math.tanh((raw - matchLevel) / c) * kk + lift) * f - oop;
    const gk = (raw: number) => (e.p.slot === 'GK' ? (matchLevel + c * Math.tanh((raw - matchLevel) / c) * k + lift) * f : raw);
    const a: Attrs = {
      PAC: m(r.PAC, k), SHO: m(r.SHO, k), PAS: m(r.PAS, kp), DRI: m(r.DRI, k), DEF: m(r.DEF, k), PHY: m(r.PHY, k),
      VIS: m(r.VIS, kp), COM: m(r.COM, k), STA: m(r.STA, k), HEA: m(r.HEA, k),
      GK_REF: gk(r.GK_REF), GK_HAN: gk(r.GK_HAN), GK_POS: gk(r.GK_POS), GK_KIC: gk(r.GK_KIC),
    };
    effCache.set(e, { at, a });
    return a;
  };
  const players = (side: Side) => [...pitch[side].values()];
  const keeperOf = (side: Side): Entry | null => pitch[side].get('GK') ?? null;
  const NO_GK: Attrs = { PAC: 30, SHO: 20, PAS: 30, DRI: 20, DEF: 30, PHY: 40, VIS: 20, COM: 30, STA: 50, HEA: 30, GK_REF: 25, GK_HAN: 25, GK_POS: 25, GK_KIC: 25 };

  // ---- changes
  const replacement = (side: Side, slot: SlotId, prefer?: Position[]): SimPlayer | null => {
    const order = prefer ?? REPLACE[slot];
    let best: SimPlayer | null = null;
    let bestScore = -Infinity;
    for (const b of bench[side]) {
      const step = order.indexOf(b.position);
      if (step < 0) continue;
      const sc = b.ovr - step * 6;
      if (sc > bestScore) {
        bestScore = sc;
        best = b;
      }
    }
    return best;
  };
  const swap = (out: Entry, minute: number, prefer?: Position[], injured = false): boolean => {
    const side = out.side;
    if (subsUsed[side] >= MC.subs.max) return false;
    const inP = replacement(side, out.p.slot, prefer);
    if (!inP) return false;
    subsUsed[side]++;
    bench[side] = bench[side].filter((b) => b !== inP);
    out.to = minute;
    lineOf(out.p, side, out.from).to = minute;
    const slot = out.p.slot;
    const fresh: SimPlayer = { ...inP, slot, attrs: inP.attrs };
    pitch[side].set(slot, { p: fresh, side, from: minute, to: null, keep: false, hurtAt: null });
    lineOf(fresh, side, minute);
    const seq = record({ type: 'SUB', side, playerId: out.p.id, targetId: fresh.id, opponentIds: [], from: { x: 50, y: 100 }, pressure: 0, probability: 1, outcome: 'DONE' });
    summary.push({
      minute,
      type: 'substitution',
      team: side,
      actor: out.p.persona ? 'persona' : actorFor(side, false),
      detail: { out: out.p.name, in: fresh.name, ...(out.p.persona ? { personaIn: false } : {}) },
      path: [{ x: 50, y: 100 }],
      seq,
    });
    if (injured) summary.push({ minute, type: 'injury', team: side, actor: actorFor(side, out.p.persona), detail: out.p.persona ? { injuryWeeks: personaStats!.injuryWeeks } : { player: out.p.name }, path: [{ x: 50, y: 50 }], seq });
    return true;
  };
  const windowsDone: Record<Side, Set<number>> = { home: new Set(), away: new Set() };
  let personaGone = false;
  const coach = () => {
    const minute = minuteNow();
    // the persona leaves tired or hurt
    const me = personaEntry();
    if (me && !personaGone && personaOffAt !== null && minute >= personaOffAt) {
      personaGone = true;
      if (!swap(me, personaOffAt, undefined, personaOffReason === 'injury')) {
        // nobody can come on: off without a replacement
        me.to = personaOffAt;
        lineOf(me.p, me.side, me.from).to = personaOffAt;
        pitch[me.side].delete(me.p.slot);
        if (personaOffReason === 'injury') summary.push({ minute: personaOffAt, type: 'injury', team: me.side, actor: 'persona', detail: { injuryWeeks: personaStats!.injuryWeeks }, path: [{ x: 50, y: 50 }], seq: log.length - 1 });
      }
    }
    for (const side of ['home', 'away'] as Side[]) {
      for (const e of players(side)) {
        if (e.hurtAt !== null && e.hurtAt <= minute) {
          e.hurtAt = null;
          swap(e, minute, undefined, true);
        }
      }
      for (const w of MC.subs.windows) {
        if (w > minute || windowsDone[side].has(w)) continue;
        windowsDone[side].add(w);
        let changes = 0;
        const diff = goalsOf(side) - goalsOf(other(side));
        if (diff < 0 && w >= 68) {
          const def = players(side)
            .filter((e) => !e.keep && ['LCB', 'RCB', 'CDM', 'LB', 'RB'].includes(e.p.slot))
            .sort((x, y) => x.p.ovr - y.p.ovr)[0];
          if (def && swap(def, minute, ['ST', 'W', 'CAM'])) changes++;
        }
        // the most tired players go first (less stamina, longer on the pitch); the coach makes one or two changes
        const tired = players(side)
          .filter((e) => !e.keep && e.from === 0)
          .map((e) => ({ e, tired: (1 - e.p.attrs.STA / 100) * (minute - e.from) + rng.range(0, 12) }))
          .sort((x, y) => y.tired - x.tired);
        const want = rng.chance(0.75) ? MC.subs.perWindow : 1;
        for (const { e } of tired) {
          if (changes >= want) break;
          if (swap(e, minute)) changes++;
        }
      }
    }
  };

  // ---- possession state
  let poss: Side = 'home';
  let holder: Entry = pitch.home.get('CM') ?? players('home')[0];
  let ball: Point = { x: 50, y: 50 };
  let receivedFrom: Entry | null = null;
  let freeNext = false;
  /** Actions left in which the side that just lost the ball is still out of shape (a counter-attack). */
  let counter = 0;
  let supportNext = false;
  let chain: Point[] = [];

  const setHolder = (e: Entry, at: Point, from: Entry | null = null) => {
    if (e.side !== poss) {
      chain = [];
      counter = MC.counter.actions;
    }
    poss = e.side;
    holder = e;
    ball = { x: clamp(at.x, 1, 99), y: clamp(at.y, 1, 99) };
    receivedFrom = from;
    chain.push(ball);
    if (chain.length > 8) chain.shift();
  };
  /** The player of `side` closest to a pitch point (by their shape spot). */
  const nearest = (side: Side, p: Point, exclude?: Entry, inPossession = side === poss): Entry => {
    let best: Entry | null = null;
    let bd = Infinity;
    for (const e of players(side)) {
      if (e === exclude) continue;
      const d = dist(shapeSpot(side, e.p.slot, p, inPossession), p) + (e.p.slot === 'GK' ? 25 : 0);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best ?? players(side)[0];
  };

  const kickOff = (side: Side): void => {
    const taker = pitch[side].get('ST') ?? nearest(side, { x: 50, y: 50 }, undefined, true);
    const recv = pitch[side].get('CM') ?? pitch[side].get('CDM') ?? taker;
    poss = side;
    chain = [];
    const to = { x: toAttack(side, 44), y: 52 };
    record({ type: 'KICK_OFF', side, playerId: taker.p.id, targetId: recv.p.id, opponentIds: [], from: { x: 50, y: 50 }, to, pressure: 0, probability: 1, outcome: 'COMPLETE' });
    setHolder(recv, to);
    freeNext = true;
  };

  /** A contested ball at a pitch point: the nearest player of each side races for it. */
  const looseBall = (at: Point, favoured: Side, mod = 0): void => {
    const atk = nearest(favoured, at, undefined, true);
    const def = nearest(other(favoured), at, undefined, false);
    const dA = dist(shapeSpot(favoured, atk.p.slot, at, true), at);
    const dD = dist(shapeSpot(other(favoured), def.p.slot, at, false), at);
    const aA = eff(atk);
    const aD = eff(def);
    const p = resolveP(mod + (dD - dA) / MC.looseDistanceScale, 0.5 * aA.PAC + 0.5 * aA.PHY, 0.5 * aD.PAC + 0.5 * aD.PHY);
    const won = rng.chance(p);
    const winner = won ? atk : def;
    record({ type: 'LOOSE_BALL', side: favoured, playerId: atk.p.id, targetId: winner.p.id, opponentIds: [def.p.id], from: at, pressure: 1, probability: p, outcome: won ? 'WON' : 'LOST' });
    if (!won) lineOf(def.p, def.side, def.from).interceptions++;
    setHolder(winner, at);
  };

  const throwIn = (side: Side, at: Point): void => {
    const spot = { x: clamp(at.x, 3, 97), y: at.y < 50 ? 2 : 98 };
    const taker = nearest(side, spot, undefined, true);
    const keep = rng.chance(MC.setPiece.throwInKeep);
    const inField = { x: spot.x, y: spot.y < 50 ? 8 : 92 };
    const recv = keep ? nearest(side, inField, taker, true) : nearest(other(side), inField, undefined, false);
    record({ type: 'THROW_IN', side, playerId: taker.p.id, targetId: recv.p.id, opponentIds: [], from: spot, to: inField, pressure: 0, probability: MC.setPiece.throwInKeep, outcome: keep ? 'COMPLETE' : 'INTERCEPTED' });
    setHolder(recv, inField);
    counter = 0;
  };

  const goalKick = (side: Side): void => {
    const gk = keeperOf(side) ?? nearest(side, { x: toAttack(side, 6), y: 50 }, undefined, true);
    const at = { x: toAttack(side, 6), y: 50 };
    record({ type: 'GOAL_KICK', side, playerId: gk.p.id, opponentIds: [], from: at, pressure: 0, probability: 1, outcome: 'DONE' });
    setHolder(gk, at);
    freeNext = true;
    counter = 0;
  };

  // ---- shots
  const shoot = (shooter: Entry, a: Attrs, at: Point, pressure: number, opts: { header?: boolean; oneOnOne?: boolean; assister?: Entry | null; setPiece?: boolean; opponents?: string[] }): void => {
    const side = shooter.side;
    const def = other(side);
    const ax = { x: toAttack(side, at.x), y: at.y };
    const zone = shotZone(ax);
    const gkE = keeperOf(def);
    const gk = gkE ? eff(gkE) : NO_GK;
    const pr = shotProbabilities(a, zone, pressure, gk, opts.header, opts.oneOnOne, shotRef);
    const line = lineOf(shooter.p, side, shooter.from);
    line.shots++;
    stats[side].shots++;
    const assister = opts.assister && opts.assister !== shooter ? opts.assister : null;
    if (assister) lineOf(assister.p, side, assister.from).keyPasses++;
    const goalPt = { x: toAttack(side, 100), y: clamp(at.y + rng.range(-6, 6), 45, 55) };
    const base = { side, playerId: shooter.p.id, opponentIds: opts.opponents ?? [], from: at, pressure: Math.min(2, pressure) as 0 | 1 | 2 };
    const type: EventType = opts.header ? 'HEADER' : 'SHOOT';
    const isPersonaShot = shooter.p.persona;
    const personaAssist = !!assister?.p.persona;
    const big = zone === 'sixYard' || zone === 'boxCentre';
    const named = () => ({ player: shooter.p.name, ...(assister ? { assist: assister.p.name } : {}), ...(personaAssist ? { assistByPersona: true } : {}) });

    // blocked before it gets anywhere
    const pBlock = opts.header || opts.setPiece ? 0 : bounded(MC.shotOutcome.blockBase + MC.shotOutcome.blockPerPressure * pressure);
    if (pressure > 0 && rng.chance(pBlock)) {
      const seq = record({ ...base, type, to: { x: toAttack(side, ax.x + 3), y: at.y }, probability: pr.onTarget, xg: pr.onTarget * pr.goalIfOn, outcome: 'BLOCKED' });
      if (isPersonaShot || personaAssist) personaStats!.keyChances++;
      void seq;
      if (rng.chance(MC.shotOutcome.blockCornerShare)) return corner(side, at.y < 50 ? 'L' : 'R');
      return looseBall({ x: toAttack(side, ax.x - 12), y: at.y }, def);
    }
    if (rng.chance(pr.onTarget)) {
      line.shotsOn++;
      stats[side].onTarget++;
      if (rng.chance(pr.goalIfOn)) {
        // GOAL
        const seq = record({ ...base, type, to: goalPt, probability: pr.onTarget, xg: pr.onTarget * pr.goalIfOn, outcome: 'GOAL', highlight: true });
        score[side === 'home' ? 0 : 1]++;
        stats[side].goals++;
        line.goals++;
        if (assister) lineOf(assister.p, side, assister.from).assists++;
        if (gkE) lineOf(gkE.p, def, gkE.from).conceded++;
        if (personaStats) {
          if (isPersonaShot) personaStats.goals++;
          if (personaAssist) personaStats.assists++;
          if (gkE?.p.persona) personaStats.conceded++;
        }
        summary.push({ minute: minuteNow(), type: 'goal', team: side, actor: actorFor(side, isPersonaShot), detail: named(), path: [...chain.slice(-5), goalPt], seq, highlight: true });
        tk += MC.restartTicks;
        return kickOff(def);
      }
      // saved
      const catchP = clamp(MC.shotOutcome.catchBase + (gk.GK_HAN - 60) / 100, 0.1, 0.9);
      const caught = rng.chance(catchP);
      const savePt = { x: toAttack(side, 97), y: clamp(at.y, 42, 58) };
      const seq = record({ ...base, type, to: savePt, probability: pr.onTarget, xg: pr.onTarget * pr.goalIfOn, outcome: caught ? 'SAVED_CAUGHT' : 'SAVED_PARRIED', highlight: big });
      if (gkE) lineOf(gkE.p, def, gkE.from).saves++;
      if (isPersonaShot || personaAssist) personaStats!.keyChances++;
      if (gkE?.p.persona) {
        personaStats!.saves++;
        summary.push({ minute: minuteNow(), type: 'save', team: def, actor: 'persona', detail: { saved: true, player: shooter.p.name }, path: [...chain.slice(-4), savePt], seq });
      } else {
        summary.push({ minute: minuteNow(), type: 'keyChance', team: side, actor: actorFor(side, isPersonaShot), detail: { saved: true, ...named(), ...(gkE ? { keeper: gkE.p.name } : {}) }, path: [...chain.slice(-4), savePt], seq, highlight: big });
      }
      if (caught) {
        if (gkE) setHolder(gkE, { x: toAttack(side, 95), y: 50 });
        freeNext = true;
        return;
      }
      if (rng.chance(MC.shotOutcome.parryCornerShare)) return corner(side, at.y < 50 ? 'L' : 'R');
      if (rng.chance(MC.shotOutcome.reboundShare)) return rebound(side, at);
      return looseBall({ x: toAttack(side, 82), y: at.y < 50 ? 30 : 70 }, def);
    }
    // off target (sometimes the woodwork)
    if (rng.chance(MC.shot.woodworkShare)) {
      const post = { x: toAttack(side, 100), y: rng.chance(0.5) ? 44 : 56 };
      const seq = record({ ...base, type, to: post, probability: pr.onTarget, xg: pr.onTarget * pr.goalIfOn, outcome: 'WOODWORK', highlight: true });
      if (isPersonaShot || personaAssist) personaStats!.keyChances++;
      summary.push({ minute: minuteNow(), type: 'keyChance', team: side, actor: actorFor(side, isPersonaShot), detail: { saved: false, ...named() }, path: [...chain.slice(-4), post], seq, highlight: true });
      return rebound(side, at);
    }
    const wide = { x: toAttack(side, 100), y: rng.chance(0.5) ? rng.range(30, 42) : rng.range(58, 70) };
    const seq = record({ ...base, type, to: wide, probability: pr.onTarget, xg: pr.onTarget * pr.goalIfOn, outcome: 'OFF_TARGET' });
    if (big && !opts.setPiece) {
      if (isPersonaShot || personaAssist) personaStats!.keyChances++;
      summary.push({ minute: minuteNow(), type: 'keyChance', team: side, actor: actorFor(side, isPersonaShot), detail: { saved: false, ...named() }, path: [...chain.slice(-4), wide], seq });
    }
    return goalKick(def);
  };

  /** A rebound in the six-yard area: first to it shoots again or clears. */
  const rebound = (side: Side, at: Point): void => {
    const spot = { x: toAttack(side, 92), y: clamp(at.y + rng.range(-8, 8), 38, 62) };
    const atk = nearest(side, spot, undefined, true);
    const def = nearest(other(side), spot, undefined, false);
    const aA = eff(atk);
    const aD = eff(def);
    const p = resolveP(-0.3, 0.5 * aA.PAC + 0.5 * aA.DRI, 0.5 * aD.PAC + 0.5 * aD.DEF);
    const won = rng.chance(p);
    record({ type: 'LOOSE_BALL', side, playerId: atk.p.id, targetId: (won ? atk : def).p.id, opponentIds: [def.p.id], from: spot, pressure: 1, probability: p, outcome: won ? 'WON' : 'LOST' });
    if (won) {
      setHolder(atk, spot);
      return shoot(atk, aA, spot, 1, { opponents: [def.p.id] });
    }
    setHolder(def, spot);
  };

  /** A cross or corner into the box: keeper claim, header duel, or cleared. */
  const aerial = (side: Side, crosser: Entry, from: Point, isCorner: boolean): void => {
    const def = other(side);
    const target = { x: toAttack(side, rng.range(86, 95)), y: rng.range(40, 60) };
    const gkE = keeperOf(def);
    const cA = eff(crosser);
    if (gkE) {
      const g = eff(gkE);
      const pClaim = resolveP(MC.gkClaimBase, 0.5 * g.GK_HAN + 0.5 * g.PHY, cA.PAS);
      if (rng.chance(pClaim)) {
        record({ type: 'GK_CLAIM', side: def, playerId: gkE.p.id, opponentIds: [crosser.p.id], from: target, pressure: 0, probability: pClaim, outcome: 'CLAIMED' });
        setHolder(gkE, target);
        freeNext = true;
        return;
      }
    }
    // best headers among the attackers in the box, the nearest centre-back marks
    const attackers = players(side).filter((e) => e !== crosser && e.p.slot !== 'GK' && (isCorner ? true : ['ST', 'LW', 'RW', 'CAM', 'CM'].includes(e.p.slot)));
    const ws = attackers.map((e) => Math.pow(eff(e).HEA / 50, 3) * (['ST', 'LCB', 'RCB'].includes(e.p.slot) ? 1.6 : 1));
    let u = rng.next() * ws.reduce((x, y) => x + y, 0);
    let header = attackers[0];
    for (let i = 0; i < attackers.length; i++) if ((u -= ws[i]) <= 0) {
      header = attackers[i];
      break;
    }
    if (!header) return looseBall(target, def);
    const markers = players(def).filter((e) => e.p.slot !== 'GK').sort((x, y) => eff(y).HEA * (['LCB', 'RCB'].includes(y.p.slot) ? 1.2 : 1) - eff(x).HEA * (['LCB', 'RCB'].includes(x.p.slot) ? 1.2 : 1));
    const marker = markers[rng.int(0, Math.min(2, markers.length - 1))];
    const hA = eff(header);
    const pWin = resolveP(MC.aerialBase, hA.HEA, marker ? eff(marker).HEA : 40);
    if (rng.chance(pWin)) {
      setHolder(header, target, crosser);
      return shoot(header, hA, target, 1, { header: true, assister: crosser, opponents: marker ? [marker.p.id] : [] });
    }
    record({ type: 'HEADER', side: def, playerId: (marker ?? header).p.id, opponentIds: [header.p.id], from: target, to: { x: toAttack(side, 62), y: target.y }, pressure: 1, probability: 1 - pWin, outcome: 'CLEARED' });
    if (rng.chance(isCorner ? 0.25 : 0.18)) return corner(side, from.y < 50 ? 'L' : 'R');
    return looseBall({ x: toAttack(side, rng.range(58, 72)), y: rng.range(25, 75) }, def, 0.2);
  };

  const corner = (side: Side, lane: 'L' | 'R'): void => {
    stats[side].corners++;
    const spot = { x: toAttack(side, 99), y: lane === 'L' ? 1 : 99 };
    const takers = players(side).filter((e) => ['LW', 'RW', 'CAM', 'CM', 'LB', 'RB'].includes(e.p.slot));
    const taker = takers.sort((a, b) => eff(b).PAS - eff(a).PAS)[0] ?? holder;
    record({ type: 'CORNER', side, playerId: taker.p.id, opponentIds: [], from: spot, pressure: 0, probability: 1, outcome: 'DONE' });
    chain = [spot];
    poss = side;
    holder = taker;
    ball = spot;
    if (rng.chance(MC.setPiece.cornerHeaderShare)) return aerial(side, taker, spot, true);
    // short corner: played into the box edge, normal play goes on
    const recv = nearest(side, { x: toAttack(side, 84), y: lane === 'L' ? 20 : 80 }, taker, true);
    setHolder(recv, { x: toAttack(side, 86), y: lane === 'L' ? 18 : 82 }, taker);
    freeNext = true;
  };

  const penalty = (side: Side, fouled: Entry): void => {
    stats[side].penalties++;
    const takers = players(side).filter((e) => e.p.slot !== 'GK');
    const taker = takers.find((e) => e.p.persona && ['ST', 'W', 'CAM'].includes(e.p.position)) ?? takers.sort((a, b) => eff(b).SHO - eff(a).SHO)[0] ?? fouled;
    const a = eff(taker);
    const gkE = keeperOf(other(side));
    const g = gkE ? eff(gkE) : NO_GK;
    const logit = Math.log(MC.penaltyConversion / (1 - MC.penaltyConversion));
    const p = bounded(sigmoid(logit + (0.6 * a.SHO + 0.4 * a.COM - g.GK_REF) / MC.penaltySpread));
    const spot = { x: toAttack(side, 89), y: 50 };
    const goal = rng.chance(p);
    const line = lineOf(taker.p, side, taker.from);
    line.shots++;
    stats[side].shots++;
    const to = { x: toAttack(side, 100), y: rng.chance(0.5) ? 46 : 54 };
    chain = [spot];
    if (goal) {
      line.shotsOn++;
      stats[side].onTarget++;
      const seq = record({ type: 'PENALTY', side, playerId: taker.p.id, opponentIds: gkE ? [gkE.p.id] : [], from: spot, to, pressure: 0, probability: p, outcome: 'GOAL', highlight: true });
      score[side === 'home' ? 0 : 1]++;
      stats[side].goals++;
      line.goals++;
      if (gkE) lineOf(gkE.p, other(side), gkE.from).conceded++;
      if (personaStats && taker.p.persona) personaStats.goals++;
      if (personaStats && gkE?.p.persona) personaStats.conceded++;
      summary.push({ minute: minuteNow(), type: 'goal', team: side, actor: actorFor(side, taker.p.persona), detail: { player: taker.p.name }, path: [spot, to], seq, highlight: true });
      tk += MC.restartTicks;
      return kickOff(other(side));
    }
    const saved = rng.chance(0.67);
    if (saved) {
      line.shotsOn++;
      stats[side].onTarget++;
      if (gkE) lineOf(gkE.p, other(side), gkE.from).saves++;
    }
    const seq = record({ type: 'PENALTY', side, playerId: taker.p.id, opponentIds: gkE ? [gkE.p.id] : [], from: spot, to, pressure: 0, probability: p, outcome: saved ? 'SAVED_PARRIED' : 'OFF_TARGET', highlight: true });
    if (personaStats && taker.p.persona) personaStats.keyChances++;
    if (saved && gkE?.p.persona) {
      personaStats!.saves++;
      summary.push({ minute: minuteNow(), type: 'save', team: other(side), actor: 'persona', detail: { saved: true, player: taker.p.name }, path: [spot, to], seq, highlight: true });
    } else summary.push({ minute: minuteNow(), type: 'keyChance', team: side, actor: actorFor(side, taker.p.persona), detail: { saved, player: taker.p.name, ...(saved && gkE ? { keeper: gkE.p.name } : {}) }, path: [spot, to], seq, highlight: true });
    if (saved && rng.chance(0.4)) return rebound(side, spot);
    if (saved || !gkE) return looseBall({ x: toAttack(side, 88), y: 50 }, other(side));
    return goalKick(other(side));
  };

  /** A foul by `offender` on `victim` at a pitch point. Card, then free kick or penalty. */
  const foul = (offender: Entry, victim: Entry, at: Point): void => {
    const side = victim.side;
    stats[offender.side].fouls++;
    lineOf(offender.p, offender.side, offender.from).fouls++;
    const oa = offender.p.attrs;
    // rough players get booked more (high PHY, low DEF)
    // the persona is booked less often (MATCH_CONFIG.persona)
    const cardMul = offender.p.persona ? MC.persona.cardMul : 1;
    const yellowP = clamp(MC.cards.yellowShare * (1 + (oa.PHY - oa.DEF) / 60), 0.03, 0.4) * cardMul;
    let outcome: Outcome = 'DONE';
    if (rng.chance(yellowP)) {
      const ol = lineOf(offender.p, offender.side, offender.from);
      const red = ol.yellow >= 1 || rng.chance(MC.cards.straightRedShare * cardMul);
      outcome = red ? 'RED' : 'YELLOW';
      if (red) {
        ol.red++;
        stats[offender.side].reds++;
      } else {
        ol.yellow++;
        stats[offender.side].yellows++;
      }
      if (offender.p.persona && personaStats) red ? personaStats.red++ : personaStats.yellow++;
    }
    const seq = record({ type: 'FOUL', side: offender.side, playerId: offender.p.id, targetId: victim.p.id, opponentIds: [victim.p.id], from: at, pressure: 0, probability: 1, outcome });
    if (outcome !== 'DONE') {
      summary.push({ minute: minuteNow(), type: 'card', team: offender.side, actor: actorFor(offender.side, offender.p.persona), detail: { card: outcome === 'RED' ? 'red' : 'yellow', player: offender.p.name }, path: [at], seq });
      if (outcome === 'RED') sendOff(offender);
    }
    const ax = { x: toAttack(side, at.x), y: at.y };
    const inBox = ax.x >= 83 && Math.abs(ax.y - 50) <= 22;
    if (inBox) return penalty(side, victim);
    record({ type: 'FREE_KICK', side, playerId: victim.p.id, opponentIds: [], from: at, pressure: 0, probability: 1, outcome: 'DONE' });
    chain = [at];
    if (rowOf(ax.x) >= MC.setPiece.freeKickDangerRow) {
      const takers = players(side).filter((e) => e.p.slot !== 'GK');
      const taker = takers.sort((a, b) => eff(b).SHO + eff(b).PAS - eff(a).SHO - eff(a).PAS)[0] ?? victim;
      poss = side;
      holder = taker;
      ball = at;
      if (Math.abs(ax.y - 50) < 25 && rng.chance(MC.setPiece.freeKickShotShare)) return shoot(taker, eff(taker), at, 1, { setPiece: true });
      if (rng.chance(0.6)) return aerial(side, taker, at, false);
    }
    setHolder(victim.side === side && pitch[side].get(victim.p.slot) === victim ? victim : nearest(side, at, undefined, true), at);
    counter = 0;
    freeNext = true;
  };

  const sendOff = (e: Entry): void => {
    const minute = minuteNow();
    e.to = minute;
    lineOf(e.p, e.side, e.from).to = minute;
    pitch[e.side].delete(e.p.slot);
    if (e.p.persona) personaGone = true;
    if (e.p.slot === 'GK') {
      // a keeper must stand in goal: a bench keeper for an attacker, or an outfielder goes in
      const benchGk = bench[e.side].find((b) => b.position === 'GK');
      const victimSlot = (['LW', 'RW', 'ST', 'CAM'] as SlotId[]).find((s) => pitch[e.side].has(s) && !pitch[e.side].get(s)!.p.persona);
      if (benchGk && victimSlot && subsUsed[e.side] < MC.subs.max) {
        const out = pitch[e.side].get(victimSlot)!;
        pitch[e.side].delete(victimSlot);
        out.p = { ...out.p, slot: 'GK' };
        pitch[e.side].set('GK', out);
        swap(out, minute, ['GK']);
      } else if (victimSlot) {
        const mover = pitch[e.side].get(victimSlot)!;
        pitch[e.side].delete(victimSlot);
        mover.p = { ...mover.p, slot: 'GK' };
        pitch[e.side].set('GK', mover);
      }
    }
  };

  /** Builds what the player on the ball sees (shape spots, pressure, open teammates). */
  const read = (): { sit: Situation; opps: Entry[] } => {
    const side = poss;
    const opp = other(side);
    const a = eff(holder);
    const axBall = { x: toAttack(side, ball.x), y: ball.y };
    // defenders: shape spot + jitter; the nearest closes down
    const defs = players(opp).map((e) => {
      const set = shapeSpot(opp, e.p.slot, ball, false);
      const s = counter > 0 ? (() => {
        const caught = shapeSpot(opp, e.p.slot, ball, true);
        const w = MC.counter.disorder;
        return { x: set.x + (caught.x - set.x) * w, y: set.y + (caught.y - set.y) * w };
      })() : set;
      const spot = { x: toAttack(side, s.x) + rng.range(-5, 5), y: s.y + rng.range(-5, 5) };
      return { e, spot, d: dist(spot, axBall), a: eff(e) };
    });
    const outfield = defs.filter((d) => d.e.p.slot !== 'GK').sort((x, y) => x.d - y.d);
    let pressure: 0 | 1 | 2 = 0;
    const pressers: typeof outfield = [];
    if (!freeNext && outfield[0] && outfield[0].d * (1 - MC.pressure.closeDown) <= MC.pressure.radius1) {
      pressure = 1;
      pressers.push(outfield[0]);
      if (outfield[1] && outfield[1].d * (1 - MC.pressure.closeDown * 0.5) <= MC.pressure.radius2) {
        pressure = 2;
        pressers.push(outfield[1]);
      }
    }
    if (supportNext && pressure > 0) {
      pressure = (pressure - 1) as 0 | 1;
      pressers.pop();
    }
    const markersPool = defs.filter((d) => !pressers.includes(d));
    const mates = players(side)
      .filter((e) => e !== holder)
      .map((e) => {
        const s = shapeSpot(side, e.p.slot, ball, true);
        const spot = { x: toAttack(side, s.x) + (supportNext ? 4 : 0), y: s.y };
        let markers = 0;
        let markerDEF = 45;
        let best = Infinity;
        for (const d of markersPool) {
          const dd = dist(d.spot, spot);
          if (dd <= MC.OPEN_RADIUS) markers++;
          if (dd < best) {
            best = dd;
            markerDEF = d.a.DEF;
          }
        }
        return { player: e.p, attrs: eff(e), spot, markers, markerDEF };
      });
    const lastLine = Math.max(...outfield.map((d) => d.spot.x), 0);
    const p0 = pressers[0];
    const spaceBehind = !outfield.some((d) => d !== p0 && d.spot.x > axBall.x && d.spot.x < axBall.x + 18 && Math.abs(d.spot.y - axBall.y) < 12) && axBall.x < 90;
    const gkE = keeperOf(opp);
    const diff = goalsOf(side) - goalsOf(opp);
    const late = minuteNow() >= MC.scoreRisk.lateMinute;
    const riskMul = late && diff > 0 ? MC.scoreRisk.leading : late && diff < 0 ? MC.scoreRisk.trailing : 1;
    freeNext = false;
    supportNext = false;
    if (counter > 0) counter--;
    return {
      sit: { holder: holder.p, attrs: a, ball: axBall, pressure, pressers: pressers.map((d) => ({ id: d.e.p.id, attrs: eff(d.e) })), mates, lastLine, spaceBehind, gk: gkE ? eff(gkE) : NO_GK, riskMul, shotRef },
      opps: pressers.map((d) => d.e),
    };
  };

  const entryOf = (side: Side, id: string) => players(side).find((e) => e.p.id === id) ?? null;

  /** One decision of the player on the ball (plus a possible tackle before it). */
  const step = () => {
    const side = poss;
    const opp = other(side);
    const { sit, opps } = read();
    const hl = lineOf(holder.p, side, holder.from);
    const fromPitch = { ...ball };
    let pressure = sit.pressure;

    // the defender may go in first (§5.5)
    if (pressure >= 1 && opps[0]) {
      const chance = pressure >= 2 ? MC.tackle.chanceP2 : MC.tackle.chanceP1;
      if (rng.chance(chance)) {
        const tackler = opps[0];
        const p = tackleProbability(eff(tackler), sit.attrs);
        const tl = lineOf(tackler.p, opp, tackler.from);
        tl.tackles++;
        stats[opp].tackles++;
        if (rng.chance(p)) {
          tl.tacklesWon++;
          record({ type: 'TACKLE', side: opp, playerId: tackler.p.id, targetId: holder.p.id, opponentIds: [holder.p.id], from: fromPitch, pressure, probability: p, outcome: 'WON' });
          if (holder.p.persona) personaStats!.duelsLost++;
          if (tackler.p.persona) personaStats!.duelsWon++;
          tk += MC.tickCost.normal;
          if (sit.ball.x >= 83 && rng.chance(MC.boxTackleCorner)) return corner(side, ball.y < 50 ? 'L' : 'R');
          return setHolder(tackler, fromPitch);
        }
        if (holder.p.persona) personaStats!.duelsWon++;
        if (tackler.p.persona) personaStats!.duelsLost++;
        const inBox = sit.ball.x >= 83 && Math.abs(sit.ball.y - 50) <= 22;
        if (rng.chance(MC.tackle.foulShare * (inBox ? 0.4 : 1))) {
          record({ type: 'TACKLE', side: opp, playerId: tackler.p.id, targetId: holder.p.id, opponentIds: [holder.p.id], from: fromPitch, pressure, probability: p, outcome: 'FOUL_WON' });
          tk += MC.tickCost.normal;
          return foul(tackler, holder, fromPitch);
        }
        record({ type: 'TACKLE', side: opp, playerId: tackler.p.id, targetId: holder.p.id, opponentIds: [holder.p.id], from: fromPitch, pressure, probability: p, outcome: 'LOST' });
        // beaten: the defender is out of the play
        sit.pressers = sit.pressers.slice(1);
        pressure = sit.pressers.length as 0 | 1 | 2;
        sit.pressure = pressure;
      }
    }

    const options = evaluateOptions(sit);
    if (!options.length) {
      // nothing sensible: a hopeful long ball
      tk += MC.tickCost.normal;
      return looseBall({ x: toAttack(side, clamp(sit.ball.x + 30, 0, 90)), y: 50 }, side, -0.4);
    }
    const ps = choiceProbabilities(options, sit.attrs);
    let u = rng.next();
    let choice = options[options.length - 1];
    for (let i = 0; i < options.length; i++) if ((u -= ps[i]) <= 0) {
      choice = options[i];
      break;
    }
    const oppIds = opps.slice(0, pressure).map((e) => e.p.id);
    const isPass = ['SHORT_PASS', 'BACK_PASS', 'LONG_PASS', 'THROUGH_BALL'].includes(choice.type);
    const quick = (choice.type === 'SHORT_PASS' || choice.type === 'BACK_PASS') && pressure === 0;
    tk += quick ? MC.tickCost.quickPass : isPass ? MC.tickCost.pass : MC.tickCost.normal;
    const toPitch = (a: Point) => pitchPoint(side, a);
    const success = rng.chance(choice.p);

    switch (choice.type) {
      case 'SHORT_PASS':
      case 'BACK_PASS':
      case 'LONG_PASS':
      case 'THROUGH_BALL': {
        const recv = entryOf(side, choice.receiver!.id)!;
        const target = toPitch({ x: choice.target!.x + rng.range(-2, 2), y: choice.target!.y + rng.range(-3, 3) });
        hl.passes++;
        stats[side].passes++;
        if (success) {
          hl.passesDone++;
          stats[side].passesDone++;
          record({ type: choice.type, side, playerId: holder.p.id, targetId: recv.p.id, opponentIds: oppIds, from: fromPitch, to: target, pressure, probability: choice.p, outcome: 'COMPLETE' });
          const passer = holder;
          setHolder(recv, target, passer);
          // a through ball puts the runner clean through
          if (choice.type === 'THROUGH_BALL') {
            freeNext = true;
            if (toAttack(side, target.x) >= 80 && rng.chance(0.75)) return shoot(recv, eff(recv), target, 0, { oneOnOne: true, assister: passer });
          }
          return;
        }
        // not clean: out, loose, or intercepted
        const kind = choice.kind!;
        const outShare = kind === 'short' || kind === 'back' ? MC.passOutcome.outShareShort : MC.passOutcome.outShareLong;
        const r = rng.next();
        if (r < outShare) {
          record({ type: choice.type, side, playerId: holder.p.id, targetId: recv.p.id, opponentIds: oppIds, from: fromPitch, to: target, pressure, probability: choice.p, outcome: 'OUT' });
          if (toAttack(side, target.x) > 95) return goalKick(opp);
          return throwIn(opp, target);
        }
        if (r < outShare + MC.passOutcome.looseShare) {
          // reached the receiver, but awkwardly: control test
          const ra = eff(recv);
          const near = nearest(opp, target, undefined, false);
          const pc = resolveP(MC.controlBase - 0.6, ra.DRI, eff(near).DEF);
          const kept = rng.chance(pc);
          record({ type: choice.type, side, playerId: holder.p.id, targetId: kept ? recv.p.id : near.p.id, opponentIds: [near.p.id], from: fromPitch, to: target, pressure, probability: choice.p, outcome: kept ? 'LOOSE_KEPT' : 'LOOSE_LOST' });
          if (kept) {
            hl.passesDone++;
            stats[side].passesDone++;
            return setHolder(recv, target, holder);
          }
          lineOf(near.p, opp, near.from).interceptions++;
          return setHolder(near, target);
        }
        const mid = { x: (fromPitch.x + target.x) / 2 + rng.range(-4, 4), y: (fromPitch.y + target.y) / 2 + rng.range(-4, 4) };
        const cut = nearest(opp, mid, undefined, false);
        lineOf(cut.p, opp, cut.from).interceptions++;
        record({ type: choice.type, side, playerId: holder.p.id, targetId: cut.p.id, opponentIds: [cut.p.id], from: fromPitch, to: mid, pressure, probability: choice.p, outcome: 'INTERCEPTED' });
        if (toAttack(side, mid.x) >= 80 && rng.chance(MC.boxDeflectCorner)) return corner(side, mid.y < 50 ? 'L' : 'R');
        return setHolder(cut, mid);
      }
      case 'CROSS': {
        hl.passes++;
        stats[side].passes++;
        if (success) {
          hl.passesDone++;
          stats[side].passesDone++;
          record({ type: 'CROSS', side, playerId: holder.p.id, opponentIds: oppIds, from: fromPitch, to: toPitch(choice.target!), pressure, probability: choice.p, outcome: 'COMPLETE' });
          return aerial(side, holder, fromPitch, false);
        }
        const r = rng.next();
        const to = toPitch({ x: rng.range(84, 99), y: rng.range(30, 70) });
        if (r < MC.passOutcome.outShareCross) {
          record({ type: 'CROSS', side, playerId: holder.p.id, opponentIds: oppIds, from: fromPitch, to, pressure, probability: choice.p, outcome: 'OUT' });
          if (rng.chance(0.5)) return corner(side, ball.y < 50 ? 'L' : 'R');
          return goalKick(opp);
        }
        const cut = nearest(opp, to, undefined, false);
        record({ type: 'CROSS', side, playerId: holder.p.id, targetId: cut.p.id, opponentIds: [cut.p.id], from: fromPitch, to, pressure, probability: choice.p, outcome: 'INTERCEPTED' });
        lineOf(cut.p, opp, cut.from).interceptions++;
        if (rng.chance(MC.boxDeflectCorner + 0.1)) return corner(side, ball.y < 50 ? 'L' : 'R');
        return setHolder(cut, to);
      }
      case 'CARRY': {
        const to = toPitch(choice.target!);
        record({ type: 'CARRY', side, playerId: holder.p.id, opponentIds: [], from: fromPitch, to, pressure, probability: choice.p, outcome: success ? 'COMPLETE' : 'LOST' });
        if (success) return setHolder(holder, to, receivedFrom);
        const near = nearest(opp, to, undefined, false);
        return setHolder(near, to);
      }
      case 'DRIBBLE':
      case 'KNOCK_AND_RUN': {
        hl.dribbles++;
        stats[side].dribbles++;
        const beaten = opps[0];
        const to = toPitch(choice.target!);
        if (success) {
          hl.dribblesWon++;
          stats[side].dribblesWon++;
          if (holder.p.persona) personaStats!.duelsWon++;
          if (beaten?.p.persona) personaStats!.duelsLost++;
          record({ type: choice.type, side, playerId: holder.p.id, opponentIds: oppIds, from: fromPitch, to, pressure, probability: choice.p, outcome: 'BEAT', highlight: choice.p < 0.3 });
          // a beaten defender sometimes pulls him down
          const inBox = toAttack(side, to.x) >= 83 && Math.abs(to.y - 50) <= 22;
          if (beaten && !inBox && rng.chance(MC.foulsFromDuels * (1.5 - beaten.p.attrs.DEF / 100))) return foul(beaten, holder, to);
          setHolder(holder, to, receivedFrom);
          freeNext = true;
          return;
        }
        if (holder.p.persona) personaStats!.duelsLost++;
        if (beaten?.p.persona) personaStats!.duelsWon++;
        const inBox = sit.ball.x >= 83 && Math.abs(sit.ball.y - 50) <= 22;
        const foulP = MC.dribble.foulShare * (1.5 - (beaten?.p.attrs.DEF ?? 50) / 100) * (inBox ? 0.5 : 1);
        const r = rng.next();
        if (beaten && r < foulP) {
          record({ type: choice.type, side, playerId: holder.p.id, opponentIds: oppIds, from: fromPitch, to: fromPitch, pressure, probability: choice.p, outcome: 'FOUL_WON' });
          return foul(beaten, holder, fromPitch);
        }
        if (r < foulP + MC.dribbleOutcome.pushedWideShare) {
          const wide = toPitch({ x: sit.ball.x - 4, y: sit.ball.y < 50 ? Math.max(4, sit.ball.y - 10) : Math.min(96, sit.ball.y + 10) });
          record({ type: choice.type, side, playerId: holder.p.id, opponentIds: oppIds, from: fromPitch, to: wide, pressure, probability: choice.p, outcome: 'PUSHED_WIDE' });
          return setHolder(holder, wide, receivedFrom);
        }
        const winner = beaten ?? nearest(opp, fromPitch, undefined, false);
        record({ type: choice.type, side, playerId: holder.p.id, targetId: winner.p.id, opponentIds: oppIds, from: fromPitch, to: fromPitch, pressure, probability: choice.p, outcome: 'LOST' });
        lineOf(winner.p, opp, winner.from).tacklesWon++;
        return setHolder(winner, fromPitch);
      }
      case 'SHOOT':
        return shoot(holder, sit.attrs, fromPitch, pressure, { assister: receivedFrom, opponents: oppIds });
      case 'HOLD_UP': {
        record({ type: 'HOLD_UP', side, playerId: holder.p.id, opponentIds: oppIds, from: fromPitch, pressure, probability: choice.p, outcome: success ? 'HELD' : 'LOST' });
        if (success) {
          supportNext = true;
          return;
        }
        if (opps[0] && rng.chance(MC.holdUp.foulShare)) return foul(opps[0], holder, fromPitch);
        return setHolder(opps[0] ?? nearest(opp, fromPitch, undefined, false), fromPitch);
      }
      case 'CLEAR': {
        if (success) {
          if (rng.chance(MC.clear.outShare)) {
            const corner_ = rng.chance(MC.clear.cornerShareOfOut);
            const to = corner_ ? { x: toAttack(side, 0), y: sit.ball.y < 50 ? 20 : 80 } : { x: toAttack(side, sit.ball.x + rng.range(10, 30)), y: sit.ball.y < 50 ? 0 : 100 };
            record({ type: 'CLEAR', side, playerId: holder.p.id, opponentIds: oppIds, from: fromPitch, to, pressure, probability: choice.p, outcome: 'OUT' });
            if (corner_) return corner(opp, sit.ball.y < 50 ? 'R' : 'L');
            return throwIn(opp, to);
          }
          const to = toPitch({ x: rng.range(45, 68), y: rng.range(15, 85) });
          record({ type: 'CLEAR', side, playerId: holder.p.id, opponentIds: oppIds, from: fromPitch, to, pressure, probability: choice.p, outcome: 'CLEARED' });
          return looseBall(to, opp, 0.1);
        }
        const to = toPitch({ x: rng.range(22, 34), y: rng.range(20, 80) });
        record({ type: 'CLEAR', side, playerId: holder.p.id, opponentIds: oppIds, from: fromPitch, to, pressure, probability: choice.p, outcome: 'MISKICK' });
        return looseBall(to, opp, -MC.clear.miskickContest);
      }
    }
  };

  // ---- the match
  kickOff('home');
  let secondHalf = false;
  let guard = 0;
  while (tk < MC.TICKS_PER_MATCH && guard++ < 5000) {
    if (!secondHalf && tk >= MC.TICKS_PER_MATCH / 2) {
      secondHalf = true;
      tk = Math.max(tk, MC.TICKS_PER_MATCH / 2);
      kickOff('away');
      continue;
    }
    coach();
    // a team down to no players in a position still plays on; the holder may have been sent off or changed
    if (!players(poss).includes(holder)) {
      holder = nearest(poss, ball, undefined, true);
    }
    // possession is time on the ball (ticks used while this side had it)
    const owner = poss;
    const before = tk;
    step();
    stats[owner].possession += tk - before;
  }
  tk = MC.TICKS_PER_MATCH;
  coach();

  // ---- after the match: minutes, ratings, persona
  const R = MC.rating;
  const playerLines: PlayerMatchLine[] = [];
  for (const l of lines.values()) {
    const minutes = Math.max(0, (l.to ?? 90) - l.from);
    if (minutes <= 0) continue;
    const [own, opp] = l.side === 'home' ? score : [score[1], score[0]];
    const share = Math.min(1, minutes / 90);
    let r =
      R.base +
      (own > opp ? R.win : own < opp ? R.loss : 0) * share +
      (opp === 0 && minutes >= 60 ? R.cleanSheet[l.position] : 0) +
      l.goals * R.goal +
      l.assists * R.assist +
      l.keyPasses * R.keyPass +
      l.shotsOn * R.shotOnTarget +
      l.dribblesWon * R.dribbleWon +
      (l.dribbles - l.dribblesWon) * R.dribbleLost +
      l.tacklesWon * R.tackleWon +
      l.interceptions * R.interception +
      l.passesDone * R.passDone +
      (l.passes - l.passesDone) * R.passLost +
      l.fouls * R.foul +
      l.yellow * R.yellow +
      l.red * R.red;
    if (l.position === 'GK') r += l.saves * R.save + l.conceded * R.conceded;
    playerLines.push({ id: l.id, name: l.name, side: l.side, minutes, goals: l.goals, assists: l.assists, rating: Math.round(clamp(r, C.RATING_MIN, C.RATING_MAX) * 10) / 10 });
  }
  if (personaStats) {
    const me = [...lines.values()].find((l) => l.persona);
    const line = me ? playerLines.find((p) => p.id === me.id) : undefined;
    personaStats.minutes = line?.minutes ?? 0;
    personaStats.rating = line ? line.rating : null;
  }

  const events: MatchEvent[] = summary
    .map((d, i) => ({ d, i }))
    .sort((a, b) => a.d.minute - b.d.minute || a.i - b.i)
    .map(({ d }, idx) => {
      const { seq, highlight, ...rest } = d;
      return { ...rest, id: `${input.matchId}-e${idx}`, highlight: !!highlight, seq } as MatchEvent;
    });

  return { score, events, log, personaStats, players: playerLines, stats };
}
