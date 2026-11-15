/**
 * Named-squad layer of the match simulation: who is on the pitch, who scores,
 * passes, saves and gets booked, and how the coach changes the team.
 *
 *  - Team strength each phase comes from the players on the pitch (att / mid /
 *    def / gk lines of the XI), so changes, injuries and red cards matter.
 *  - Substitutions: up to MAX_SUBS per team in a few windows — tired players
 *    first, a forced change for an injury, an extra attacker when losing late.
 *  - Every player who played gets a match rating.
 */
import * as C from './constants';
import { clamp, type Rng } from './rng';
import type { ClubRatings, LineupPlayer, MatchLineup, PlayerMatchLine, Position, Side, SlotId } from './types';

export const MAX_SUBS = 5;
/** Minutes when the coach looks at the bench. */
const WINDOWS = [58, 68, 77];

const LINES: Record<keyof ClubRatings, SlotId[]> = {
  att: ['LW', 'ST', 'RW', 'CAM'],
  mid: ['CDM', 'CM', 'CAM'],
  def: ['LB', 'LCB', 'RCB', 'RB', 'CDM'],
  gk: ['GK'],
};
/** Lines lose this much per player sent off. */
const MAN_DOWN = 3;

const SCORE_W: Record<Position, number> = { ST: 0.34, W: 0.24, CAM: 0.14, CM: 0.08, CDM: 0.04, FB: 0.04, CB: 0.05, GK: 0 };
const ASSIST_W: Record<Position, number> = { CAM: 0.24, W: 0.22, CM: 0.2, FB: 0.12, ST: 0.1, CDM: 0.08, CB: 0.03, GK: 0.01 };
const FOUL_W: Record<Position, number> = { CB: 0.26, CDM: 0.22, FB: 0.2, CM: 0.14, ST: 0.07, CAM: 0.06, W: 0.05, GK: 0.01 };
/** Which bench positions can replace a slot (best first). */
export const REPLACE: Record<SlotId, Position[]> = {
  GK: ['GK'],
  LB: ['FB', 'CB', 'CDM'],
  RB: ['FB', 'CB', 'CDM'],
  LCB: ['CB', 'CDM', 'FB'],
  RCB: ['CB', 'CDM', 'FB'],
  CDM: ['CDM', 'CM', 'CB'],
  CM: ['CM', 'CDM', 'CAM'],
  CAM: ['CAM', 'CM', 'W'],
  LW: ['W', 'CAM', 'ST'],
  RW: ['W', 'CAM', 'ST'],
  ST: ['ST', 'W', 'CAM'],
};
const ATTACKING: Position[] = ['ST', 'W', 'CAM'];

interface OnPitch extends LineupPlayer {
  slot: SlotId;
  from: number;
  /** Planned minute this NPC tires (> 90 = lasts the match). */
  tiresAt: number;
  /** Pre-rolled injury minute (NPCs only). */
  hurtAt: number | null;
}

interface Line {
  id: string;
  name: string;
  position: Position;
  from: number;
  to: number | null;
  goals: number;
  assists: number;
  saves: number;
  conceded: number;
  yellow: number;
  red: number;
  persona: boolean;
}

export interface SubEvent {
  minute: number;
  side: Side;
  out: string;
  in: string;
  /** The persona went off (fatigue / injury). */
  personaOut: boolean;
  /** An NPC went off injured. */
  injured: boolean;
}

/** One team's players during a match. */
export class TeamPlay {
  pitch: OnPitch[] = [];
  bench: LineupPlayer[] = [];
  subs = 0;
  sentOff = 0;
  lines = new Map<string, Line>();

  constructor(
    readonly side: Side,
    lineup: MatchLineup,
    private rng: Rng,
  ) {
    for (const p of lineup.starters) {
      const slot = p.slot ?? 'CM';
      const core = p.characterKey === 'odil' || p.characterKey === 'abu';
      this.pitch.push({
        ...p,
        slot,
        from: 0,
        // goalkeepers, the persona and the core characters are not changed for tiredness
        tiresAt: p.persona || core || slot === 'GK' ? 999 : rng.int(56, 104),
        hurtAt: !p.persona && rng.chance(C.NPC_INJURY_CHANCE) ? rng.int(8, 88) : null,
      });
      this.line(p);
    }
    this.bench = lineup.bench.slice();
  }

  private line(p: LineupPlayer, from = 0): Line {
    let l = this.lines.get(p.id);
    if (!l) {
      l = { id: p.id, name: p.name, position: p.position, from, to: null, goals: 0, assists: 0, saves: 0, conceded: 0, yellow: 0, red: 0, persona: !!p.persona };
      this.lines.set(p.id, l);
    }
    return l;
  }

  /** Current att / mid / def / gk of the NPCs on the pitch (the persona adds their own shift). */
  ratings(fallback: ClubRatings): ClubRatings {
    const out = { ...fallback };
    for (const k of Object.keys(LINES) as (keyof ClubRatings)[]) {
      const xs = this.pitch.filter((p) => !p.persona && LINES[k].includes(p.slot)).map((p) => p.ovr);
      if (xs.length) out[k] = xs.reduce((a, b) => a + b, 0) / xs.length;
      out[k] -= this.sentOff * MAN_DOWN;
    }
    return out;
  }

  /** A weighted pick of an NPC on the pitch (skill and position decide). */
  pick(weights: Record<Position, number>, exclude?: string): OnPitch | null {
    const xs = this.pitch.filter((p) => !p.persona && p.id !== exclude);
    const ws = xs.map((p) => weights[p.position] * Math.pow(p.ovr / 60, 2));
    const total = ws.reduce((a, b) => a + b, 0);
    if (total <= 0) return null;
    let u = this.rng.next() * total;
    for (let i = 0; i < xs.length; i++) if ((u -= ws[i]) <= 0) return xs[i];
    return xs[xs.length - 1];
  }
  scorer = (exclude?: string) => this.pick(SCORE_W, exclude);
  assister = (exclude?: string) => this.pick(ASSIST_W, exclude);
  fouler = () => this.pick(FOUL_W);
  keeper = () => this.pitch.find((p) => p.slot === 'GK') ?? null;
  stat = (id: string) => this.lines.get(id)!;

  /** The best bench player for a slot, or null. */
  private replacement(slot: SlotId, prefer?: Position[]): LineupPlayer | null {
    const order = prefer ?? REPLACE[slot];
    let best: LineupPlayer | null = null;
    let bestScore = -Infinity;
    for (const b of this.bench) {
      const step = order.indexOf(b.position);
      if (step < 0) continue;
      const s = b.ovr - step * 6;
      if (s > bestScore) {
        bestScore = s;
        best = b;
      }
    }
    return best;
  }

  /** Takes `out` off for a bench player at `minute`; returns the change, or null if nobody fits. */
  swap(out: OnPitch, minute: number, prefer?: Position[], injured = false): SubEvent | null {
    if (this.subs >= MAX_SUBS) return null;
    const inP = this.replacement(out.slot, prefer);
    if (!inP) return null;
    this.subs++;
    this.bench = this.bench.filter((b) => b !== inP);
    this.pitch = this.pitch.filter((p) => p !== out);
    this.stat(out.id).to = minute;
    this.pitch.push({ ...inP, slot: out.slot, from: minute, tiresAt: 999, hurtAt: null });
    this.line(inP, minute);
    return { minute, side: this.side, out: out.name, in: inP.name, personaOut: !!out.persona, injured };
  }

  /** Sends a player off (no replacement allowed). */
  sendOff(p: OnPitch, minute: number) {
    this.pitch = this.pitch.filter((x) => x !== p);
    this.stat(p.id).to = minute;
    this.sentOff++;
  }

  /**
   * The coach's changes up to `minute`: forced changes for injuries, and in
   * each window tired players (and, when losing late, an extra attacker).
   */
  coach(minute: number, done: Set<number>, goalDiff: number): SubEvent[] {
    const subs: SubEvent[] = [];
    for (const p of this.pitch.slice()) {
      if (p.hurtAt !== null && p.hurtAt <= minute) {
        const at = p.hurtAt;
        p.hurtAt = null;
        const s = this.swap(p, at, undefined, true);
        if (s) subs.push(s);
      }
    }
    for (const w of WINDOWS) {
      if (w > minute || done.has(w)) continue;
      done.add(w);
      let changes = 0;
      if (goalDiff < 0 && w >= 68) {
        // chasing the game: a defender off, an attacker on
        const def = this.pitch.filter((p) => !p.persona && ['LCB', 'RCB', 'CDM', 'LB', 'RB'].includes(p.slot)).sort((a, b) => a.ovr - b.ovr)[0];
        if (def) {
          const s = this.swap(def, w, ATTACKING);
          if (s) {
            subs.push(s);
            changes++;
          }
        }
      }
      const tired = this.pitch.filter((p) => !p.persona && p.tiresAt <= w).sort((a, b) => a.tiresAt - b.tiresAt);
      for (const p of tired) {
        if (changes >= 2) break;
        const s = this.swap(p, w);
        if (s) {
          subs.push(s);
          changes++;
        }
      }
    }
    return subs;
  }

  /** Ratings for everyone who played. */
  finish(own: number, opp: number): PlayerMatchLine[] {
    const out: PlayerMatchLine[] = [];
    for (const l of this.lines.values()) {
      const minutes = Math.max(0, (l.to ?? 90) - l.from);
      if (minutes <= 0) continue;
      let r =
        C.RATING_BASE +
        (own > opp ? C.RATING_WIN : own < opp ? C.RATING_LOSS : 0) +
        (opp === 0 ? C.RATING_CLEAN_SHEET[l.position] : 0) +
        l.goals * C.RATING_GOAL +
        l.assists * C.RATING_ASSIST +
        l.yellow * C.RATING_YELLOW +
        l.red * C.RATING_RED +
        this.rng.range(-0.3, 0.5);
      if (l.position === 'GK') r += l.saves * C.RATING_SAVE + l.conceded * (C.RATING_CONCEDED / 2);
      out.push({ id: l.id, name: l.name, side: this.side, minutes, goals: l.goals, assists: l.assists, rating: Math.round(clamp(r, C.RATING_MIN, C.RATING_MAX) * 10) / 10 });
    }
    return out;
  }
}
