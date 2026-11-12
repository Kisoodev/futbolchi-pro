/**
 * Pure, deterministic match simulation. Same MatchInput (incl. seed) → same MatchResult.
 *
 * A match is PHASES_PER_MATCH attack phases. Each phase is a chain:
 *   pass → dribble (duel) → shot
 * Each step succeeds with p = clamp(base + (attack − defence) × slope, lo, hi),
 * drawn from the seeded RNG. When the persona is involved in a step, the
 * persona's (fatigue-adjusted) stats replace the team rating for that step.
 */
import * as C from './constants';
import { computeOvr, effectiveStats } from './positions';
import { clamp, createRng, type Rng } from './rng';
import type {
  Actor,
  ClubRatings,
  MatchEvent,
  PersonaMatchStats,
  PersonaRole,
  PitchPoint,
  Position,
  Side,
  Stats,
} from './types';

export interface TeamInput {
  id: string;
  ratings: ClubRatings;
}

export interface PersonaMatchInput {
  side: Side;
  position: Position;
  stats: Stats;
  fatigue: number;
  role: PersonaRole;
  /** Extra injury probability from this week's training. */
  injuryRiskBonus: number;
}

export interface MatchInput {
  matchId: string;
  seed: number;
  home: TeamInput;
  away: TeamInput;
  persona?: PersonaMatchInput | null;
}

export interface MatchResult {
  score: [number, number];
  events: MatchEvent[];
  personaStats: PersonaMatchStats | null;
}

type Step = 'pass' | 'dribble' | 'shot';
type DraftEvent = Omit<MatchEvent, 'id' | 'highlight'>;

const other = (s: Side): Side => (s === 'home' ? 'away' : 'home');
const avgRating = (r: ClubRatings): number => (r.att + r.mid + r.def + r.gk) / 4;
const shift = (r: ClubRatings, d: number): ClubRatings => ({ att: r.att + d, mid: r.mid + d, def: r.def + d, gk: r.gk + d });

export function emptyPersonaStats(role: PersonaRole): PersonaMatchStats {
  return {
    role,
    minutes: 0,
    goals: 0,
    assists: 0,
    keyChances: 0,
    duelsWon: 0,
    duelsLost: 0,
    saves: 0,
    conceded: 0,
    yellow: 0,
    red: 0,
    injuryWeeks: 0,
    rating: null,
  };
}

export function stepProbability(base: number, a: number, d: number, lo: number, hi: number, slope = C.STEP_SLOPE): number {
  return clamp(base + (a - d) * slope, lo, hi);
}

export function simulateMatch(input: MatchInput): MatchResult {
  const rng = createRng(input.seed);
  const { home, away } = input;
  const persona = input.persona ?? null;
  const teams: Record<Side, TeamInput> = { home, away };
  const drafts: DraftEvent[] = [];
  const score: [number, number] = [0, 0];
  const ps = persona ? emptyPersonaStats(persona.role) : null;
  const eff = persona ? effectiveStats(persona.stats, persona.fatigue) : null;

  const actorFor = (side: Side, isPersona: boolean): Actor => {
    if (isPersona) return 'persona';
    if (!persona) return side === 'home' ? 'teammate' : 'opponent';
    return side === persona.side ? 'teammate' : 'opponent';
  };

  // ---- Persona on-pitch window ----
  let onFrom = Number.POSITIVE_INFINITY;
  let onTo = Number.NEGATIVE_INFINITY;
  let offReason: 'fatigue' | 'injury' | 'red' | null = null;
  let personaSubsOnSide = 0;
  if (persona && (persona.role === 'start' || persona.role === 'sub')) {
    if (persona.role === 'start') {
      onFrom = 0;
      onTo = 90;
      if (persona.fatigue > C.FATIGUE_SUB_THRESHOLD) {
        onTo = C.FATIGUE_SUB_MINUTE;
        offReason = 'fatigue';
      }
    } else {
      onFrom = rng.int(C.PERSONA_SUB_ON_MIN, C.PERSONA_SUB_ON_MAX);
      onTo = 90;
      personaSubsOnSide++;
      drafts.push({
        minute: onFrom,
        type: 'substitution',
        team: persona.side,
        actor: 'persona',
        detail: { personaIn: true },
        path: [{ x: 50, y: 100 }],
      });
    }
    const pInjury = C.INJURY_BASE + C.INJURY_FATIGUE_FACTOR * (persona.fatigue / 100) + persona.injuryRiskBonus;
    if (rng.chance(pInjury)) {
      const minute = rng.int(Math.max(1, onFrom), Math.max(1, Math.min(onTo, 90)));
      const weeks = rng.int(C.INJURY_WEEKS_MIN, C.INJURY_WEEKS_MAX);
      onTo = minute;
      offReason = 'injury';
      ps!.injuryWeeks = weeks;
      drafts.push({
        minute,
        type: 'injury',
        team: persona.side,
        actor: 'persona',
        detail: { injuryWeeks: weeks },
        path: [{ x: rng.int(25, 75), y: rng.int(20, 80) }],
      });
    }
  }
  let sentOff = false;
  const personaOnAt = (minute: number) => !!persona && !sentOff && minute >= onFrom && minute <= onTo;

  // The persona lifts (or drags down) their team while on the pitch.
  const personaShift =
    persona && eff
      ? (computeOvr(eff, persona.position) - avgRating(teams[persona.side].ratings)) * C.PERSONA_TEAM_INFLUENCE
      : 0;

  // ---- Attack phases ----
  const minutes = Array.from({ length: C.PHASES_PER_MATCH }, () => rng.int(1, 90)).sort((a, b) => a - b);
  const pHome = (home.ratings.mid + C.HOME_ADVANTAGE) / (home.ratings.mid + C.HOME_ADVANTAGE + away.ratings.mid);

  for (const minute of minutes) {
    const att: Side = rng.chance(pHome) ? 'home' : 'away';
    const def = other(att);
    const on = personaOnAt(minute);
    const A = on && persona!.side === att ? shift(teams[att].ratings, personaShift) : teams[att].ratings;
    const D = on && persona!.side === def ? shift(teams[def].ratings, personaShift) : teams[def].ratings;
    const pAttacking = on && persona!.side === att;
    const pDefending = on && persona!.side === def;
    const toX = (x: number) => (att === 'home' ? x : 100 - x);

    let pStep: Step | null = null;
    if (pAttacking) {
      const inv = C.ATTACK_INVOLVEMENT[persona!.position];
      const u = rng.next();
      if (u < inv.shot) pStep = 'shot';
      else if (u < inv.shot + inv.dribble) pStep = 'dribble';
      else if (u < inv.shot + inv.dribble + inv.pass) pStep = 'pass';
    }
    const pDefendsDuel = pDefending && rng.chance(C.DEFENCE_INVOLVEMENT[persona!.position]);
    const pIsGk = pDefending && persona!.position === 'GK';

    const path: PitchPoint[] = [{ x: toX(rng.int(20, 40)), y: rng.int(15, 85) }];

    const runPhase = (): void => {
      // Pass
      const passA = pStep === 'pass' ? eff!.passing : A.mid;
      if (!rng.chance(stepProbability(C.PASS_BASE, passA, D.mid, C.PASS_LO, C.PASS_HI))) return;
      path.push({ x: toX(rng.int(50, 62)), y: rng.int(15, 85) });

      // Dribble duel
      const dribA = pStep === 'dribble' ? eff!.dribbling * 0.6 + eff!.pace * 0.4 : A.att;
      const dribD = pDefendsDuel ? eff!.defending * 0.7 + eff!.physical * 0.3 : D.def;
      const won = rng.chance(stepProbability(C.DRIBBLE_BASE, dribA, dribD, C.DRIBBLE_LO, C.DRIBBLE_HI));
      if (pStep === 'dribble') won ? ps!.duelsWon++ : ps!.duelsLost++;
      if (pDefendsDuel) won ? ps!.duelsLost++ : ps!.duelsWon++;
      if (!won) return;
      path.push({ x: toX(rng.int(72, 84)), y: rng.int(25, 75) });

      // Shot
      const shotA = pStep === 'shot' ? eff!.shooting : A.att;
      const gkR = pIsGk ? eff!.defending * 0.5 + eff!.mentality * 0.3 + eff!.physical * 0.2 : D.gk;
      const pGoal = stepProbability(C.GOAL_BASE, shotA, gkR, C.GOAL_LO, C.GOAL_HI, C.GOAL_SLOPE);
      const shooterIsPersona = pStep === 'shot';
      if (rng.chance(pGoal)) {
        score[att === 'home' ? 0 : 1]++;
        const assist = pStep === 'pass';
        if (shooterIsPersona) ps!.goals++;
        if (assist) ps!.assists++;
        if (pIsGk) ps!.conceded++;
        path.push({ x: toX(100), y: rng.int(46, 54) });
        drafts.push({
          minute,
          type: 'goal',
          team: att,
          actor: actorFor(att, shooterIsPersona),
          detail: assist ? { assistByPersona: true } : undefined,
          path: path.slice(),
        });
        return;
      }
      const saved = rng.chance(C.SAVE_SHARE);
      if (shooterIsPersona || pStep === 'pass') ps!.keyChances++;
      path.push(saved ? { x: toX(97), y: rng.int(44, 56) } : { x: toX(100), y: rng.chance(0.5) ? rng.int(30, 40) : rng.int(60, 70) });
      if (saved && pIsGk) {
        ps!.saves++;
        drafts.push({ minute, type: 'save', team: def, actor: 'persona', detail: { saved: true }, path: path.slice() });
      } else {
        drafts.push({
          minute,
          type: 'keyChance',
          team: att,
          actor: actorFor(att, shooterIsPersona),
          detail: { saved, ...(pStep === 'pass' ? { assistByPersona: true } : {}) },
          path: path.slice(),
        });
      }
    };
    runPhase();

    // Bookable foul by the defending side
    if (rng.chance(C.CARD_PER_PHASE)) {
      const last = path[path.length - 1];
      const personaFouls =
        pDefending && rng.chance(C.CARD_PERSONA_SHARE * (1.5 - persona!.stats.mentality / 100));
      let card: 'yellow' | 'red' = 'yellow';
      if (personaFouls) {
        if (ps!.yellow >= 1 || rng.chance(C.RED_STRAIGHT_SHARE)) {
          card = 'red';
          ps!.red++;
          sentOff = true;
          onTo = minute;
          offReason = 'red';
        } else {
          ps!.yellow++;
        }
      }
      drafts.push({
        minute,
        type: 'card',
        team: def,
        actor: actorFor(def, personaFouls),
        detail: { card },
        path: [{ x: last.x, y: last.y }],
      });
    }
  }

  // A red card before a pre-rolled injury cancels the injury.
  if (offReason === 'red' && ps && ps.injuryWeeks > 0) {
    const idx = drafts.findIndex((d) => d.type === 'injury' && d.actor === 'persona');
    if (idx >= 0 && drafts[idx].minute > onTo) {
      drafts.splice(idx, 1);
      ps.injuryWeeks = 0;
    }
  }

  // ---- Substitutions ----
  if (persona && (offReason === 'fatigue' || offReason === 'injury') && onTo < 90) {
    personaSubsOnSide++;
    drafts.push({
      minute: onTo,
      type: 'substitution',
      team: persona.side,
      actor: 'persona',
      detail: { personaIn: false },
      path: [{ x: 50, y: 100 }],
    });
  }
  for (const side of ['home', 'away'] as Side[]) {
    const used = persona && persona.side === side ? personaSubsOnSide : 0;
    for (let i = 0; i < Math.max(0, C.TEAM_SUBS - used); i++) {
      drafts.push({
        minute: rng.int(C.SUB_MINUTE_MIN, C.SUB_MINUTE_MAX),
        type: 'substitution',
        team: side,
        actor: actorFor(side, false),
        path: [{ x: 50, y: 100 }],
      });
    }
  }

  // ---- Persona minutes + rating ----
  if (ps) {
    ps.minutes = Number.isFinite(onFrom) ? Math.max(0, Math.min(onTo, 90) - onFrom) : 0;
    const [own, opp] = persona!.side === 'home' ? score : [score[1], score[0]];
    ps.rating = ps.minutes > 0 ? personaRating(ps, persona!.position, own, opp) : null;
  }

  // Stable sort by minute, then assign ids.
  const events: MatchEvent[] = drafts
    .map((d, i) => ({ d, i }))
    .sort((a, b) => a.d.minute - b.d.minute || a.i - b.i)
    .map(({ d }, idx) => ({ ...d, id: `${input.matchId}-e${idx}`, highlight: false }));

  return { score, events, personaStats: ps };
}

export function personaRating(ps: PersonaMatchStats, position: Position, teamGoals: number, oppGoals: number): number {
  let r =
    (teamGoals > oppGoals ? C.RATING_WIN : teamGoals < oppGoals ? C.RATING_LOSS : 0) +
    (oppGoals === 0 ? C.RATING_CLEAN_SHEET[position] : 0) +
    C.RATING_BASE +
    ps.goals * C.RATING_GOAL +
    ps.assists * C.RATING_ASSIST +
    ps.keyChances * C.RATING_KEY_CHANCE +
    (ps.duelsWon - ps.duelsLost) * C.RATING_DUEL +
    ps.yellow * C.RATING_YELLOW +
    ps.red * C.RATING_RED;
  if (position === 'GK') r += ps.saves * C.RATING_SAVE + ps.conceded * C.RATING_CONCEDED;
  return Math.round(clamp(r, C.RATING_MIN, C.RATING_MAX) * 10) / 10;
}

/** Exposed for tests / tools that need their own RNG stream. */
export type { Rng };
