/**
 * Every tunable number lives here. Keep BALANCE.md in sync when changing anything.
 */
import type { Appearance, Position, StatKey, Tier } from './types';
import { PROGRESSION_CONFIG } from './progression';

// ---------- Stats ----------
export const STAT_MIN = 1;
export const STAT_MAX = PROGRESSION_CONFIG.MAX_ATTR;

/** Importance of each attribute per position (from PROGRESSION_CONFIG). */
export const POSITION_WEIGHTS = PROGRESSION_CONFIG.WEIGHTS;

// ---------- Persona creation (see progression.ts) ----------
export const START_AGE = 17;

// ---------- Appearance (cosmetic only) ----------
export const HEIGHT_MIN_CM = 160;
export const HEIGHT_MAX_CM = 200;
export const WEIGHT_MIN_KG = 55;
export const WEIGHT_MAX_KG = 100;
export const DEFAULT_APPEARANCE: Appearance = {
  gender: 'male',
  headShape: 'round',
  skinTone: 'medium',
  hairStyle: 'short',
  hairColor: 'black',
  eyeColor: 'brown',
  brows: 'normal',
  nose: 'medium',
  facialHair: 'none',
  heightCm: 178,
  weightKg: 72,
  foot: 'right',
  boots: 'black',
  sleeves: 'short',
  accessory: 'none',
  celebration: 'arms_up',
};


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
  /** Attributes the session focuses on (training gives XP; these are suggested for spending). */
  focus: StatKey[];
  /** Fatigue added this week (negative = recovery). */
  fatigue: number;
  /** Extra injury probability for this week's match. */
  injuryRisk: number;
}

export const TRAINING_OPTIONS: TrainingOption[] = [
  { id: 'shooting', focus: ['shooting'], fatigue: 15, injuryRisk: 0 },
  { id: 'gym', focus: ['physical'], fatigue: 10, injuryRisk: 0.03 },
  { id: 'tactical', focus: ['passing', 'defending'], fatigue: 5, injuryRisk: 0 },
  { id: 'speed', focus: ['pace'], fatigue: 10, injuryRisk: 0.02 },
  { id: 'passing', focus: ['passing', 'dribbling'], fatigue: 5, injuryRisk: 0 },
  { id: 'dribbling', focus: ['dribbling'], fatigue: 10, injuryRisk: 0 },
  { id: 'defending', focus: ['defending'], fatigue: 10, injuryRisk: 0 },
  { id: 'rest', focus: [], fatigue: -30, injuryRisk: 0 },
];
/** Options offered on a training day; the player picks one. */
export const TRAINING_OFFER_SIZE = 3;

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
  CDM: { pass: 0.25, dribble: 0.03, shot: 0.03 },
  CM: { pass: 0.35, dribble: 0.08, shot: 0.08 },
  CAM: { pass: 0.3, dribble: 0.15, shot: 0.15 },
  W: { pass: 0.1, dribble: 0.35, shot: 0.2 },
  ST: { pass: 0.05, dribble: 0.1, shot: 0.45 },
};
/** Chance the persona is the defender in the dribble duel of an opposing phase. GK faces every shot. */
export const DEFENCE_INVOLVEMENT: Record<Position, number> = {
  GK: 0,
  CB: 0.3,
  FB: 0.2,
  CDM: 0.25,
  CM: 0.1,
  CAM: 0.05,
  W: 0.03,
  ST: 0,
};

/** Per phase, chance the defending side commits a bookable foul. */
export const CARD_PER_PHASE = 0.04;
/** Share of a team's cards attributed to the persona = CARD_PERSONA_SHARE × (1.5 − defending/100). */
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
export const RATING_CLEAN_SHEET: Record<Position, number> = { GK: 0.8, CB: 0.5, FB: 0.4, CDM: 0.3, CM: 0.2, CAM: 0, W: 0, ST: 0 };
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
/** 16 clubs → 30 matches a season (the spec is balanced for ~30). */
export const CLUBS_PER_TIER = 16;
/**
 * The leagues in play, top first: 1-liga (2), 2-liga (3), Akademiya (4).
 * Tier 1 (Elit) is reserved for a later stage of the game.
 */
export const TIERS: Tier[] = [2, 3, 4];
/** The highest league in play. */
export const TOP_TIER: Tier = 2;
/** Only the champion goes up (and only the last club goes down, so every league keeps 16 clubs). */
export const PROMOTION_SPOTS = 1;
export const RELEGATION_SPOTS = 1;
/** Noise used to rank clubs in tiers that are not simulated. */
export const UNSIMULATED_TIER_NOISE = 6;
export const POINTS_WIN = 3;
export const POINTS_DRAW = 1;

// ---------- Transfers ----------

export const STAT_KEYS_LIST: StatKey[] = [
  'pace',
  'shooting',
  'passing',
  'dribbling',
  'defending',
  'physical',
];
