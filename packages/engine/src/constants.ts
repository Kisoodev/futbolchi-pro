/**
 * Every tunable number lives here. Keep BALANCE.md in sync when changing anything.
 */
import type { Position, StatKey, Stats, Tier } from './types';

// ---------- Stats ----------
export const STAT_MIN = 1;
export const STAT_MAX = 99;

/** Importance of each stat per position. Each row sums to 1. */
export const POSITION_WEIGHTS: Record<Position, Stats> = {
  GK: { pace: 0.05, shooting: 0, passing: 0.15, dribbling: 0, defending: 0.35, physical: 0.15, mentality: 0.3 },
  CB: { pace: 0.1, shooting: 0, passing: 0.1, dribbling: 0.05, defending: 0.35, physical: 0.25, mentality: 0.15 },
  FB: { pace: 0.25, shooting: 0, passing: 0.15, dribbling: 0.1, defending: 0.25, physical: 0.15, mentality: 0.1 },
  CM: { pace: 0.05, shooting: 0.1, passing: 0.3, dribbling: 0.15, defending: 0.1, physical: 0.1, mentality: 0.2 },
  W: { pace: 0.3, shooting: 0.15, passing: 0.15, dribbling: 0.3, defending: 0, physical: 0.05, mentality: 0.05 },
  ST: { pace: 0.2, shooting: 0.35, passing: 0.05, dribbling: 0.15, defending: 0, physical: 0.15, mentality: 0.1 },
};

// ---------- Persona creation ----------
/** Starting stats per position, tuned so OVR ≈ 40. */
export const STAT_TEMPLATES: Record<Position, Stats> = {
  GK: { pace: 30, shooting: 20, passing: 36, dribbling: 25, defending: 42, physical: 40, mentality: 42 },
  CB: { pace: 36, shooting: 25, passing: 36, dribbling: 30, defending: 43, physical: 43, mentality: 38 },
  FB: { pace: 43, shooting: 28, passing: 38, dribbling: 36, defending: 41, physical: 38, mentality: 36 },
  CM: { pace: 36, shooting: 36, passing: 43, dribbling: 40, defending: 36, physical: 37, mentality: 41 },
  W: { pace: 44, shooting: 38, passing: 37, dribbling: 43, defending: 25, physical: 34, mentality: 35 },
  ST: { pace: 42, shooting: 42, passing: 35, dribbling: 40, defending: 25, physical: 40, mentality: 38 },
};
export const BONUS_POINTS_TOTAL = 10;
export const BONUS_POINTS_PER_STAT_MAX = 5;
export const START_AGE = 17;

/** Hidden potential: triangular(min, mode, max). */
export const POTENTIAL_MIN = 60;
export const POTENTIAL_MODE = 75;
export const POTENTIAL_MAX = 92;

// ---------- Growth ----------
/** room = clamp((potential − OVR) / GROWTH_ROOM_SPAN, 0, 1) */
export const GROWTH_ROOM_SPAN = 15;
/** gain = base × (GROWTH_POS_BASE + GROWTH_POS_FACTOR × weight) × room */
export const GROWTH_POS_BASE = 0.5;
export const GROWTH_POS_FACTOR = 2;
/** After each match played, top-N position stats get this base gain. */
export const MATCH_XP_BASE = 0.3;
export const MATCH_XP_TOP_STATS = 2;

// ---------- Training ----------
export type TrainingId =
  | 'shooting'
  | 'gym'
  | 'tactical'
  | 'speed'
  | 'passing'
  | 'dribbling'
  | 'defending'
  | 'rest';

export interface TrainingOption {
  id: TrainingId;
  /** Positive values go through the growth formula; negative values apply directly. */
  gains: Partial<Stats>;
  /** Fatigue added this week (negative = recovery). */
  fatigue: number;
  /** Extra injury probability for this week's match. */
  injuryRisk: number;
}

export const TRAINING_OPTIONS: TrainingOption[] = [
  { id: 'shooting', gains: { shooting: 1.0 }, fatigue: 15, injuryRisk: 0 },
  { id: 'gym', gains: { physical: 1.0 }, fatigue: 10, injuryRisk: 0.03 },
  { id: 'tactical', gains: { mentality: 1.0, pace: -0.2 }, fatigue: 5, injuryRisk: 0 },
  { id: 'speed', gains: { pace: 0.8 }, fatigue: 10, injuryRisk: 0.02 },
  { id: 'passing', gains: { passing: 0.8, dribbling: 0.2 }, fatigue: 5, injuryRisk: 0 },
  { id: 'dribbling', gains: { dribbling: 1.0 }, fatigue: 10, injuryRisk: 0 },
  { id: 'defending', gains: { defending: 1.0, mentality: 0.2 }, fatigue: 10, injuryRisk: 0 },
  { id: 'rest', gains: {}, fatigue: -30, injuryRisk: 0 },
];
export const TRAINING_OFFER_SIZE = 3;
/** Multiplier on positive training gains (before the growth formula). */
export const TRAINING_GAIN_MULT = 1.6;

// ---------- Fatigue / injury ----------
export const FATIGUE_MAX = 100;
export const FATIGUE_PER_FULL_MATCH = 25;
export const FATIGUE_WEEKLY_RECOVERY = 35;
/** effective = stat × (1 − FATIGUE_STAT_PENALTY × fatigue/100) */
export const FATIGUE_STAT_PENALTY = 0.25;
/** Fatigue level from which Rest is always offered. */
export const FATIGUE_FORCE_REST_OFFER = 60;
/** Persona is subbed off at this minute if starting fatigue > threshold. */
export const FATIGUE_SUB_THRESHOLD = 70;
export const FATIGUE_SUB_MINUTE = 65;

export const INJURY_BASE = 0.02;
export const INJURY_FATIGUE_FACTOR = 0.05;
export const INJURY_WEEKS_MIN = 1;
export const INJURY_WEEKS_MAX = 3;

// ---------- Match simulation ----------
export const PHASES_PER_MATCH = 22;
export const HOME_ADVANTAGE = 3;
/** Step success p = clamp(base + (A − D) × slope, lo, hi). */
export const STEP_SLOPE = 0.015;
export const PASS_BASE = 0.7;
export const PASS_LO = 0.35;
export const PASS_HI = 0.92;
export const DRIBBLE_BASE = 0.55;
export const DRIBBLE_LO = 0.25;
export const DRIBBLE_HI = 0.85;
export const GOAL_BASE = 0.32;
export const GOAL_SLOPE = 0.012;
export const GOAL_LO = 0.08;
export const GOAL_HI = 0.6;
/** Share of missed shots that count as a goalkeeper save (rest go wide). */
export const SAVE_SHARE = 0.5;

/** Chance the persona performs each step of an attacking phase (exclusive, one roll). */
export const ATTACK_INVOLVEMENT: Record<Position, { pass: number; dribble: number; shot: number }> = {
  GK: { pass: 0, dribble: 0, shot: 0 },
  CB: { pass: 0.08, dribble: 0, shot: 0.03 },
  FB: { pass: 0.1, dribble: 0.15, shot: 0.02 },
  CM: { pass: 0.35, dribble: 0.08, shot: 0.08 },
  W: { pass: 0.1, dribble: 0.35, shot: 0.2 },
  ST: { pass: 0.05, dribble: 0.1, shot: 0.45 },
};
/** Chance the persona is the defender in the dribble duel of an opposing phase. GK faces every shot. */
export const DEFENCE_INVOLVEMENT: Record<Position, number> = {
  GK: 0,
  CB: 0.3,
  FB: 0.2,
  CM: 0.1,
  W: 0.03,
  ST: 0,
};

/** Per phase, chance the defending side commits a bookable foul. */
export const CARD_PER_PHASE = 0.04;
/** Share of a team's cards attributed to the persona = CARD_PERSONA_SHARE × (1.5 − mentality/100). */
export const CARD_PERSONA_SHARE = 0.12;
export const RED_STRAIGHT_SHARE = 0.08;

export const TEAM_SUBS = 2;
/** While on the pitch, the persona's team ratings shift by (personaOVR − teamAvg) × this. */
export const PERSONA_TEAM_INFLUENCE = 0.1;
export const SUB_MINUTE_MIN = 55;
export const SUB_MINUTE_MAX = 85;
export const PERSONA_SUB_ON_MIN = 60;
export const PERSONA_SUB_ON_MAX = 75;

// ---------- Match rating ----------
export const RATING_BASE = 6.0;
export const RATING_GOAL = 1.2;
export const RATING_ASSIST = 0.8;
export const RATING_KEY_CHANCE = 0.3;
export const RATING_DUEL = 0.2;
export const RATING_YELLOW = -0.5;
export const RATING_RED = -1.5;
export const RATING_SAVE = 0.4;
export const RATING_CONCEDED = -0.4;
/** Team result bonus for the persona's rating. */
export const RATING_WIN = 0.3;
export const RATING_LOSS = -0.3;
/** Clean-sheet bonus by position (persona played and team conceded 0). */
export const RATING_CLEAN_SHEET: Record<Position, number> = { GK: 0.8, CB: 0.5, FB: 0.4, CM: 0.2, W: 0, ST: 0 };
export const RATING_MIN = 3;
export const RATING_MAX = 10;

// ---------- Selection ----------
/** P(start) = clamp(0.5 + (OVR − clubAvg + SELECTION_OFFSET) × SELECTION_SLOPE, lo, hi) */
export const SELECTION_OFFSET = 4;
export const SELECTION_SLOPE = 0.06;
export const SELECTION_LO = 0.05;
export const SELECTION_HI = 0.98;
export const SUB_APPEARANCE_CHANCE = 0.3;

// ---------- League ----------
export const CLUBS_PER_TIER = 8;
export const TIERS: Tier[] = [1, 2, 3, 4];
export const TIER_BASE_RATING: Record<Tier, number> = { 1: 75, 2: 65, 3: 55, 4: 45 };
export const CLUB_RATING_SPREAD = 5;
export const PROMOTION_SPOTS = 2;
export const RELEGATION_SPOTS = 2;
/** After moving tier, each club rating moves this share of the way to the new tier base. */
export const TIER_DRIFT = 0.4;
/** Noise used to rank clubs in tiers that are not simulated. */
export const UNSIMULATED_TIER_NOISE = 6;
export const POINTS_WIN = 3;
export const POINTS_DRAW = 1;

// ---------- Transfers ----------
/** Min season average rating for a transfer offer. Per position: defenders' ratings run lower. */
export const TRANSFER_MIN_AVG_RATING: Record<Position, number> = { GK: 6.6, CB: 6.3, FB: 6.2, CM: 6.8, W: 6.8, ST: 7.0 };
/** OVR must be ≥ target tier base − this. */
export const TRANSFER_OVR_MARGIN = 5;
export const TRANSFER_OFFERS = 2;

export const STAT_KEYS_LIST: StatKey[] = [
  'pace',
  'shooting',
  'passing',
  'dribbling',
  'defending',
  'physical',
  'mentality',
];
