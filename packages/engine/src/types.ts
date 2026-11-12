/**
 * Game data model. Everything here is plain, JSON-serializable data:
 * no classes, no Date objects (ISO strings only), no functions.
 */

export const POSITIONS = ['GK', 'CB', 'FB', 'CM', 'W', 'ST'] as const;
export type Position = (typeof POSITIONS)[number];

export const STAT_KEYS = [
  'pace',
  'shooting',
  'passing',
  'dribbling',
  'defending',
  'physical',
  'mentality',
] as const;
export type StatKey = (typeof STAT_KEYS)[number];
/** Stats are floats in [1, 99]; the UI shows them rounded. */
export type Stats = Record<StatKey, number>;

/** Cosmetic body options chosen at creation. They do not affect simulation. */
export const HEAD_SHAPES = ['round', 'oval', 'square'] as const;
export type HeadShape = (typeof HEAD_SHAPES)[number];
export const SKIN_TONES = ['light', 'medium', 'tan', 'dark'] as const;
export type SkinTone = (typeof SKIN_TONES)[number];
export const HAIR_STYLES = ['short', 'buzz', 'curly', 'long', 'mohawk', 'bald'] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];
export const HAIR_COLORS = ['black', 'brown', 'blonde', 'red', 'gray', 'white'] as const;
export type HairColor = (typeof HAIR_COLORS)[number];
export const FEET = ['right', 'left'] as const;
export type Foot = (typeof FEET)[number];

export interface Appearance {
  headShape: HeadShape;
  skinTone: SkinTone;
  hairStyle: HairStyle;
  hairColor: HairColor;
  heightCm: number;
  weightKg: number;
  foot: Foot;
}

export interface CareerStats {
  seasons: number;
  apps: number;
  goals: number;
  assists: number;
  saves: number;
}

export interface Persona {
  id: string;
  name: string;
  position: Position;
  age: number;
  appearance: Appearance;
  stats: Stats;
  /** HIDDEN from the player. Caps long-term growth. Never render it. */
  potential: number;
  /** 0–100. Lowers effective stats in matches. */
  fatigue: number;
  injuryWeeksLeft: number;
  clubId: string;
  seed: number;
  career: CareerStats;
}

/** Persona without hidden fields — the only shape UI components should receive. */
export type PersonaView = Omit<Persona, 'potential'>;

export interface ClubRatings {
  att: number;
  mid: number;
  def: number;
  gk: number;
}

export type Tier = 1 | 2 | 3 | 4;

export interface Club {
  id: string;
  name: string;
  tier: Tier;
  ratings: ClubRatings;
  /** Hex colour used by the replay and share card. */
  color: string;
}

export interface Fixture {
  week: number; // 1-based
  homeId: string;
  awayId: string;
  matchId: string;
}

export interface TableRow {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  points: number;
}

export interface TrainingChoice {
  week: number;
  optionId: string;
}

export type SeasonOutcome = 'promoted' | 'relegated' | 'stayed';

export interface Season {
  id: string;
  index: number; // 1-based
  tier: Tier;
  seed: number;
  clubIds: string[];
  fixtures: Fixture[];
  /** Next week to be played (1-based). Equals weeks+1 when finished. */
  week: number;
  table: TableRow[];
  trainingLog: TrainingChoice[];
  /** Matches the persona's club played, in order. */
  matchIds: string[];
  finished: boolean;
  outcome?: SeasonOutcome;
  finalPosition?: number;
  storyUz?: string;
}

export type PersonaRole = 'start' | 'sub' | 'bench' | 'injured';

export type MatchEventType = 'goal' | 'keyChance' | 'save' | 'card' | 'injury' | 'substitution';
export type Side = 'home' | 'away';
export type Actor = 'persona' | 'teammate' | 'opponent';

export interface PitchPoint {
  /** 0–100, home attacks towards x = 100. */
  x: number;
  /** 0–100. */
  y: number;
}

export interface MatchEvent {
  id: string;
  minute: number;
  type: MatchEventType;
  team: Side;
  /** Relative to the persona: persona / persona's teammate / opponent. 'teammate' when no persona. */
  actor: Actor;
  detail?: {
    card?: 'yellow' | 'red';
    assistByPersona?: boolean;
    saved?: boolean;
    /** substitution: true if persona came on, false if persona went off. */
    personaIn?: boolean;
    injuryWeeks?: number;
  };
  /** Waypoints for the replay. Ball travels along them. */
  path: PitchPoint[];
  highlight: boolean;
}

export interface PersonaMatchStats {
  role: PersonaRole;
  minutes: number;
  goals: number;
  assists: number;
  keyChances: number;
  duelsWon: number;
  duelsLost: number;
  saves: number;
  conceded: number;
  yellow: number;
  red: number;
  injuryWeeks: number;
  /** Null when the persona did not play. */
  rating: number | null;
}

export interface Match {
  id: string;
  seasonId: string;
  week: number;
  seed: number;
  homeId: string;
  awayId: string;
  score: [number, number];
  personaSide: Side | null;
  personaStats: PersonaMatchStats | null;
  events: MatchEvent[];
}

export interface TransferOffer {
  clubId: string;
}

export type GamePhase = 'training' | 'seasonSummary';

export interface GameState {
  version: 1;
  seed: number;
  persona: Persona;
  clubs: Record<string, Club>;
  seasons: Season[];
  /** Only matches involving the persona's club are stored (with events). */
  matches: Record<string, Match>;
  phase: GamePhase;
  transferOffers: TransferOffer[];
}
