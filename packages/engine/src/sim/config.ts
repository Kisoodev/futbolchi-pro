/**
 * MATCH_CONFIG — every number of the match engine (docs/MATCH_ENGINE.md §11).
 * The spec's values come first; keys marked "added" are ours (see
 * docs/MATCH_ENGINE_ASSUMPTIONS.md) and were tuned in calibration
 * (docs/MATCH_ENGINE_CALIBRATION.md).
 */
export const MATCH_CONFIG = {
  P_MIN: 0.03,
  P_MAX: 0.95,
  S: 12,
  T_BASE: 0.35,
  TICKS_PER_MATCH: 180,
  pass: { short: 2.2, long: 1.0, through: 0.2, cross: -0.2, pressure1: -0.6, pressure2: -1.2 },
  dribble: { base: 0.0, knockNoSpace: -1.0, DOUBLE_TEAM_PENALTY: -0.9, DOUBLE_TEAM_FACTOR: 0.35, foulShare: 0.12 },
  shot: {
    zones: {
      sixYard: { base: 0.9, quality: 0.55 },
      boxCentre: { base: 0.3, quality: 0.28 },
      boxWide: { base: -0.1, quality: 0.15 },
      boxEdge: { base: -0.4, quality: 0.1 },
      long: { base: -0.8, quality: 0.06 },
    },
    pressurePenalty: 0.4,
    headerQuality: 0.75,
    woodworkShare: 0.05,
  },
  OPEN_TEAMMATE_BONUS: 1.4,
  OUT_OF_POSITION_PENALTY: 4,
  FATIGUE_MAX: 0.15,
  FATIGUE_START_MIN: 55,
  penaltyConversion: 0.76,
  riskByRow: [0.25, 0.5, 0.8, 1.0, 1.2, 1.3],

  // ---------------------------------------------------------------- added (see the assumptions file)
  /** Seconds of match time per tick (5400 / TICKS_PER_MATCH). */
  SECONDS_PER_TICK: 30,
  /** Utility scale before the softmax, so T works on a sensible range. */
  UTILITY_SCALE: 1,
  /** Pressure radii (pitch units, 0–100 both ways): nearest / second defender. */
  pressure: { radius1: 7, radius2: 9, closeDown: 0.4 },
  /** A teammate is open when no opponent is within this distance. */
  OPEN_RADIUS: 9,
  /** Pass outcomes when a pass does not complete cleanly. */
  passOutcome: { looseShare: 0.35, outShareShort: 0.15, outShareLong: 0.35, outShareCross: 0.3 },
  /** A loose ball is controlled with a DRI test at this base. */
  controlBase: 1.4,
  /** Dribble outcomes on failure. */
  dribbleOutcome: { pushedWideShare: 0.3 },
  /** Shot outcomes. */
  shotOutcome: { catchBase: 0.45, parryCornerShare: 0.5, reboundShare: 0.4, blockBase: 0.18, blockPerPressure: 0.12, blockCornerShare: 0.7 },
  /** How often the defender tackles before the holder acts, by pressure. */
  tackle: { chanceP1: 0.24, chanceP2: 0.4, base: -0.6, foulShare: 0.74 },
  /** Interceptions take place during passes; their share of failed passes. */
  interceptShare: 0.65,
  /** Cards: share of fouls that are booked; straight reds among bookings. */
  cards: { yellowShare: 0.17, straightRedShare: 0.02 },
  /** Fouls from lost duels (attacker kept the ball) — the defender's DEF lowers it. */
  foulsFromDuels: 0.4,
  /** Set pieces. */
  setPiece: { throwInKeep: 0.85, cornerDirectGoal: 0.03, cornerHeaderShare: 0.55, freeKickShotShare: 0.35, freeKickDangerRow: 5 },
  /** Restart pause after goals and at half-time (ticks skipped). */
  restartTicks: 1,
  /** Header duel base for crosses and corners. */
  aerialBase: -0.3,
  /** Goalkeeper claims of crosses. */
  gkClaimBase: -1.6,
  /** Late-game risk: the leading team plays safer in the last minutes, the trailing team takes more risk. */
  scoreRisk: { lateMinute: 80, leading: 0.8, trailing: 1.25 },
  /** Fatigue sub windows and limits. */
  subs: { max: 5, windows: [58, 68, 77], perWindow: 2, tiredBelow: 0.95 },
  /** Pass details: long-pass length penalty (logit per unit beyond 30), pressure scale by pass type (spec table §5.2), receiver marking. */
  passDetail: { lengthFree: 30, lengthPenalty: 0.012, pressureScale: { short: 1, back: 1, long: 5 / 6, through: 5 / 6, cross: 4 / 6 }, marked1: -0.6, marked2: -1.2, shortMax: 26, longMax: 62 },
  /** Clearances: clean clearance base; share that goes out; corners among those. */
  clear: { base: 1.4, outShare: 0.35, cornerShareOfOut: 0.45, miskickContest: -0.8 },
  /** Hold-up play: base, share of failures that win a foul. */
  holdUp: { base: 0.5, foulShare: 0.25 },
  /** Carry with nobody close. */
  carryBase: 2.4,
  /** Home side morale. */
  homeMorale: 1.01,
  /** Value of having the ball by attack-frame x (0–100): V = lo + (hi − lo)·(x/100)^pow, minus wideCut when wide in the last third. */
  value: { lo: 0.22, hi: 0.95, pow: 2, wideCut: 0.1, beatBonus: 0.15, throughBonus: 0.25, goal: 20 },
  /** Risk exponent per action: utility × riskByRow[row]^exp (negative = more attractive when the zone is dangerous). */
  riskExp: { SHORT_PASS: 0, BACK_PASS: -0.3, LONG_PASS: 0.4, THROUGH_BALL: 0.8, CROSS: 0.5, DRIBBLE: 1.5, KNOCK_AND_RUN: 1.2, CARRY: 0.3, SHOOT: 0, HOLD_UP: 0.3, CLEAR: -1.5 },
  /** Position behaviour (§4.3): 1 = normal. */
  roleWeight: {
    GK: { SHORT_PASS: 1.2, BACK_PASS: 0.2, LONG_PASS: 1.3, THROUGH_BALL: 0.1, CROSS: 0, DRIBBLE: 0.02, KNOCK_AND_RUN: 0.02, CARRY: 0.2, SHOOT: 0, HOLD_UP: 0, CLEAR: 1.4 },
    CB: { SHORT_PASS: 1.2, BACK_PASS: 1.2, LONG_PASS: 0.9, THROUGH_BALL: 0.3, CROSS: 0.3, DRIBBLE: 0.2, KNOCK_AND_RUN: 0.2, CARRY: 0.7, SHOOT: 0.15, HOLD_UP: 0.2, CLEAR: 1.3 },
    FB: { SHORT_PASS: 1.1, BACK_PASS: 0.9, LONG_PASS: 0.8, THROUGH_BALL: 0.5, CROSS: 1.3, DRIBBLE: 0.6, KNOCK_AND_RUN: 0.9, CARRY: 1.2, SHOOT: 0.35, HOLD_UP: 0.3, CLEAR: 1.1 },
    CDM: { SHORT_PASS: 1.3, BACK_PASS: 1.0, LONG_PASS: 0.9, THROUGH_BALL: 0.5, CROSS: 0.4, DRIBBLE: 0.4, KNOCK_AND_RUN: 0.4, CARRY: 0.8, SHOOT: 0.4, HOLD_UP: 0.5, CLEAR: 1.0 },
    CM: { SHORT_PASS: 1.2, BACK_PASS: 0.8, LONG_PASS: 1.15, THROUGH_BALL: 0.9, CROSS: 0.6, DRIBBLE: 0.7, KNOCK_AND_RUN: 0.6, CARRY: 1.0, SHOOT: 0.7, HOLD_UP: 0.6, CLEAR: 0.8 },
    CAM: { SHORT_PASS: 1.0, BACK_PASS: 0.4, LONG_PASS: 0.8, THROUGH_BALL: 1.4, CROSS: 0.7, DRIBBLE: 1.2, KNOCK_AND_RUN: 0.9, CARRY: 1.0, SHOOT: 1.1, HOLD_UP: 0.7, CLEAR: 0.5 },
    W: { SHORT_PASS: 0.9, BACK_PASS: 0.35, LONG_PASS: 0.6, THROUGH_BALL: 0.8, CROSS: 1.3, DRIBBLE: 1.4, KNOCK_AND_RUN: 1.3, CARRY: 1.2, SHOOT: 1.1, HOLD_UP: 0.5, CLEAR: 0.5 },
    ST: { SHORT_PASS: 1.0, BACK_PASS: 0.6, LONG_PASS: 0.4, THROUGH_BALL: 0.7, CROSS: 0.6, DRIBBLE: 1.0, KNOCK_AND_RUN: 1.0, CARRY: 0.9, SHOOT: 1.5, HOLD_UP: 1.4, CLEAR: 0.5 },
  },
  /** Cost of an action in ticks: quick, safe passes in the own half take half a tick. */
  tickCost: { quickPass: 0.5, pass: 0.6, normal: 1 },
  /** Technique level: passes and dribbles also depend on the absolute skill (academy players are less precise than professionals, §9). */
  skillAbs: { ref: 68, scale: 24, dribbleRef: 72, dribbleScale: 60, shotLeague: 1 },
  /** Balls cut out in the defending box go behind for a corner this often. */
  boxDeflectCorner: 0.45,
  /** Counter-attacks: after winning the ball in open play, the other side is out of shape for a few actions. */
  counter: { actions: 3, disorder: 0.7 },
  /** A tackle won in the own box puts the ball behind for a corner this often. */
  boxTackleCorner: 0.3,
  /** Team strength in the match: attributes are pulled towards the match level (compression) and each team has a match-day form (OVR points, normal). */
  strength: { compression: 0.3, passCompression: 0.7, formSd: 0.7, saturation: 12 },
  /** Reward of a cross relative to having the ball at the penalty spot. */
  crossReward: 1.0,
  /** Loose balls: who gets there (distance difference per logit). */
  looseDistanceScale: 10,
  /** Penalty kick: spread of the shooter vs keeper modifier. */
  penaltySpread: 24,
  /** Keepers of weaker leagues let in more: p(goal | on target) += (ref − GK_eff) / scale. */
  keeperAbs: { ref: 77, scale: 150 },
  /** The main character takes fewer knocks and cards than other players (less luck-based setbacks). */
  persona: { injuryMul: 0.5, cardMul: 0.5 },
  /** Player match rating (all players). */
  rating: {
    base: 6.0, goal: 1.1, assist: 0.7, keyPass: 0.2, shotOnTarget: 0.08, dribbleWon: 0.1, dribbleLost: -0.06,
    tackleWon: 0.14, interception: 0.08, passDone: 0.004, passLost: -0.03, foul: -0.08, yellow: -0.5, red: -1.5,
    save: 0.3, conceded: -0.25, win: 0.3, loss: -0.3, cleanSheet: { GK: 0.8, CB: 0.5, FB: 0.4, CDM: 0.3, CM: 0.15, CAM: 0, W: 0, ST: 0 },
  },
};

export type MatchConfig = typeof MATCH_CONFIG;
