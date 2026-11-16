/**
 * Game data model. Everything here is plain, JSON-serializable data:
 * no classes, no Date objects (ISO strings only), no functions.
 */

export const POSITIONS = ['GK', 'CB', 'FB', 'CDM', 'CM', 'CAM', 'W', 'ST'] as const;
export type Position = (typeof POSITIONS)[number];

export const STAT_KEYS = [
  'pace',
  'shooting',
  'passing',
  'dribbling',
  'defending',
  'physical',
] as const;
export type StatKey = (typeof STAT_KEYS)[number];
/** Six attributes, 1–100 (docs/PROGRESSION_SYSTEM.md). */
export type Stats = Record<StatKey, number>;

/** Cosmetic options chosen at creation. They never affect the simulation. */
/** Boy or girl. Cosmetic only: it changes the look and the story texts, never the simulation. */
export const GENDERS = ['male', 'female'] as const;
export type Gender = (typeof GENDERS)[number];
/** Face shapes. Kept to natural, flattering ones. */
export const HEAD_SHAPES = ['oval', 'round', 'square'] as const;
export type HeadShape = (typeof HEAD_SHAPES)[number];
/** The four main human skin tones. */
export const SKIN_TONES = ['light', 'medium', 'tan', 'dark'] as const;
export type SkinTone = (typeof SKIN_TONES)[number];
export const HAIR_STYLES = [
  'short',
  'sidepart',
  'spiky',
  'buzz',
  'undercut',
  'curly',
  'afro',
  'long',
  'dreads',
  'bald',
  'ponytail',
  'bun',
  'braid',
] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];
/** Hairstyles offered for each gender (kept short so the creator stays simple). */
export const HAIR_STYLES_BY_GENDER: Record<Gender, readonly HairStyle[]> = {
  male: ['short', 'sidepart', 'undercut', 'spiky', 'buzz', 'curly', 'afro', 'long', 'dreads', 'bald'],
  female: ['ponytail', 'bun', 'braid', 'long', 'short', 'curly'],
};
/** Natural hair colours of young players. */
export const HAIR_COLORS = ['black', 'chestnut', 'brown', 'blonde', 'red'] as const;
export type HairColor = (typeof HAIR_COLORS)[number];
/** Natural eye colours. */
export const EYE_COLORS = ['dark', 'brown', 'hazel', 'green', 'blue'] as const;
export type EyeColor = (typeof EYE_COLORS)[number];
export const BROWS = ['thin', 'normal', 'thick'] as const;
export type Brows = (typeof BROWS)[number];
export const NOSES = ['small', 'medium', 'large'] as const;
export type Nose = (typeof NOSES)[number];
export const FACIAL_HAIR = ['none', 'stubble', 'mustache', 'goatee', 'beard'] as const;
export type FacialHair = (typeof FACIAL_HAIR)[number];
export const BOOT_COLORS = ['black', 'white', 'red', 'gold', 'blue', 'orange'] as const;
export type BootColor = (typeof BOOT_COLORS)[number];
export const SLEEVES = ['short', 'long'] as const;
export type Sleeves = (typeof SLEEVES)[number];
export const ACCESSORIES = ['none', 'headband', 'wristbands'] as const;
export type Accessory = (typeof ACCESSORIES)[number];
/** Goal celebration: shown in the creator preview and on the season card. */
export const CELEBRATIONS = ['arms_up', 'point_sky', 'ear_cup', 'fists', 'shush'] as const;
export type Celebration = (typeof CELEBRATIONS)[number];
export const FEET = ['right', 'left'] as const;
export type Foot = (typeof FEET)[number];

export interface Appearance {
  gender: Gender;
  headShape: HeadShape;
  skinTone: SkinTone;
  hairStyle: HairStyle;
  hairColor: HairColor;
  eyeColor: EyeColor;
  brows: Brows;
  nose: Nose;
  facialHair: FacialHair;
  heightCm: number;
  weightKg: number;
  foot: Foot;
  boots: BootColor;
  sleeves: Sleeves;
  accessory: Accessory;
  celebration: Celebration;
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
  /** Unspent XP (earned in matches and training, spent on attributes). */
  xp: number;
  /** Old saves only: the hidden growth cap of the previous system. Unused. */
  potential?: number;
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

export type NpcRole = 'regular' | 'good' | 'strong';

/** A computer-controlled player of a club's squad. */
export interface NpcPlayer {
  id: string;
  /** Shown in match events and on the lineup board. */
  name: string;
  position: Position;
  /** Wingers and full-backs: the side they prefer. */
  side?: 'L' | 'R';
  /** A character from docs/CHARACTERS.md (odil, abu, sardor…). */
  characterKey?: string;
  role: NpcRole;
  ovr: number;
  captain: boolean;
}

/** How a kit is cut (drawn on the pitch, the crest and the shirts). */
export const KIT_PATTERNS = ['plain', 'stripes', 'hoops', 'band', 'sleeves', 'shoulders', 'trim', 'collar', 'halves'] as const;
export type KitPattern = (typeof KIT_PATTERNS)[number];

export interface Kit {
  shirt: string;
  secondary: string;
  shorts: string;
  socks: string;
  pattern: KitPattern;
}

/** A club's way of playing; the match engine leans its decisions on it (MATCH_CONFIG.styles). */
export const CLUB_STYLES = [
  'disciplined', 'possession', 'stars', 'technical', 'press', 'physical', 'intense', 'athletic',
  'stubborn', 'wings', 'combination', 'modern', 'traditional', 'chaotic', 'raw', 'underdog',
] as const;
export type ClubStyle = (typeof CLUB_STYLES)[number];

export interface Club {
  id: string;
  name: string;
  tier: Tier;
  /** Derived from the squad (averages of its lines). */
  ratings: ClubRatings;
  squad: NpcPlayer[];
  /** Hex colour used by the replay and share card (the shirt colour). */
  color: string;
  /** Home kit (older saves: derived from the colour). */
  kit?: Kit;
  style?: ClubStyle;
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
  /** Persona OVR when the season started (for the season report). */
  startOvr?: number;
  /** Average OVR of the persona's squad when the season started (the team grows through it). */
  teamStartOvr?: number;
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
    /** Who did it (scorer, shooter, booked player, injured player). */
    player?: string;
    /** Who passed for the goal / chance. */
    assist?: string;
    /** The goalkeeper who saved. */
    keeper?: string;
    /** substitution: who went off and who came on. */
    out?: string;
    in?: string;
  };
  /** Index of the action in the v2 engine log (for the replay). */
  seq?: number;
  /** Waypoints for the replay. Ball travels along them. */
  path: PitchPoint[];
  highlight: boolean;
}

/** Positions on the pitch in the 4-3-3 the game uses. */
export const SLOTS = ['GK', 'LB', 'LCB', 'RCB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'ST', 'RW'] as const;
export type SlotId = (typeof SLOTS)[number];

export interface LineupPlayer {
  id: string;
  name: string;
  position: Position;
  ovr: number;
  /** Starters: their place in the XI. */
  slot?: SlotId;
  characterKey?: string;
  persona?: boolean;
}

export interface MatchLineup {
  starters: LineupPlayer[];
  bench: LineupPlayer[];
  /** The club's style (the match engine leans on it). */
  style?: ClubStyle;
}

/** One player's match (both teams, everyone who played). */
export interface PlayerMatchLine {
  id: string;
  name: string;
  side: Side;
  minutes: number;
  goals: number;
  assists: number;
  rating: number;
}

export interface PersonaMatchStats {
  role: PersonaRole;
  /** Work load of the match (1 = normal effort; more with high effort): scales the tiredness after it. */
  load?: number;
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
  /** Starting XIs and benches (matches played since named squads). */
  lineups?: Record<Side, MatchLineup>;
  /** Everyone who played, with a rating. */
  players?: PlayerMatchLine[];
  /** 2 = possession-chain engine (docs/MATCH_ENGINE.md); the replay rebuilds its action log from seed + lineups + simPersona. */
  engine?: 2;
  /** The persona's match input, to rebuild the same action log. */
  simPersona?: MatchPersonaInput | null;
}

/** What the match engine needs to know about the persona. */
/** 0 = low, 1 = normal, 2 = high. */
export type OrderLevel = 0 | 1 | 2;

/**
 * The player's instructions to their persona during a match, from a minute on:
 * effort (work rate: stronger, but tires faster), mentality (0 defensive,
 * 2 attacking: shoots and goes forward more, helps less in defence) and
 * confidence (high: takes players on, low: plays it safe).
 */
export interface PersonaOrder {
  from: number;
  effort: OrderLevel;
  mentality: OrderLevel;
  confidence: OrderLevel;
}

export interface MatchPersonaInput {
  side: Side;
  position: Position;
  stats: Stats;
  fatigue: number;
  role: PersonaRole;
  /** Extra injury probability from this week's training. */
  injuryRiskBonus: number;
  /** Instructions given during the match (the latest one whose minute has come counts). */
  orders?: PersonaOrder[];
}

export interface TransferOffer {
  clubId: string;
}

export type GamePhase = 'training' | 'seasonSummary';
/** Each game week has two days: a training day, then a match day. */
export type WeekDay = 'training' | 'match';

export type MissionKind = 'train' | 'play' | 'goodGame' | 'win' | 'contribute' | 'ovr';

/** Lifetime counters of the account (they drive missions). */
export interface AccountCounters {
  trainings: number;
  matches: number;
  wins: number;
  /** Matches rated 7.0 or more. */
  goodGames: number;
  /** Goals + assists (+ one per 3 saves for keepers). */
  contributions: number;
  /** OVR points gained in total (fractional). */
  ovrGained: number;
  seasons: number;
  promotions: number;
}

/** The player's account level (see account.ts). */
export interface Account {
  level: number;
  /** XP inside the current level. */
  xp: number;
  totalXp: number;
  counters: AccountCounters;
  /** Active missions: their index in the endless list and the counter value when they started. */
  missions: { index: number; base: number }[];
  nextMission: number;
  missionsDone: number;
}

export interface GameState {
  /** 2 = progression system v1 (six attributes, XP, NPC squads). */
  version: 1 | 2;
  seed: number;
  persona: Persona;
  clubs: Record<string, Club>;
  seasons: Season[];
  /** Only matches involving the persona's club are stored (with events). */
  matches: Record<string, Match>;
  phase: GamePhase;
  transferOffers: TransferOffer[];
  /** Today's day of the week; missing in older saves (= training). */
  day?: WeekDay;
  /** Extra injury risk from this week's training, used on match day. */
  pendingInjuryRisk?: number;
  /** Account level and missions; missing in older saves. */
  account?: Account;
}
