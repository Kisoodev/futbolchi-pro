/**
 * Season loop. All functions take a GameState and return a NEW GameState
 * (no mutation), so state can be stored, replayed and diffed as plain JSON.
 */
import * as C from './constants';
import { applyResult, clubAvg, doubleRoundRobin, emptyTable, generateWorld, sortTable } from './league';
import { simulateMatch } from './match';
import { addFatigue, applyMatchXp, createPersona, personaOvr, statDeltas, type CreatePersonaInput } from './persona';
import { applyAccountEvents, normalizeAccount, type AccountEvent, type AccountReward } from './account';
import { createRng, hashSeed } from './rng';
import { seasonFacts, seasonStoryUz } from './story';
import { applyTraining, offerTraining, weeklyRecovery, type TrainingId } from './training';
import type { Club, GameState, Match, Persona, PersonaRole, Season, SeasonOutcome, StatKey, Tier, WeekDay } from './types';

export interface NewGameInput {
  seed: number;
  persona: Omit<CreatePersonaInput, 'clubId' | 'seed'>;
}

export function newGame(input: NewGameInput): GameState {
  const clubs = generateWorld(input.seed);
  const rng = createRng(hashSeed(input.seed, 'startClub'));
  const academyClubs = Object.values(clubs).filter((c) => c.tier === 4);
  const club = rng.pick(academyClubs);
  const persona = createPersona({ ...input.persona, clubId: club.id, seed: input.seed });
  const state: GameState = {
    version: 1,
    seed: input.seed,
    persona,
    clubs,
    seasons: [],
    matches: {},
    phase: 'training',
    transferOffers: [],
  };
  return { ...state, seasons: [createSeason(state, 1)] };
}

export function createSeason(state: GameState, index: number): Season {
  const tier = state.clubs[state.persona.clubId].tier;
  const id = `s${index}`;
  const seed = hashSeed(state.seed, 'season', index);
  const clubIds = Object.values(state.clubs)
    .filter((c) => c.tier === tier)
    .map((c) => c.id)
    .sort();
  return {
    id,
    index,
    tier,
    seed,
    clubIds,
    fixtures: doubleRoundRobin(clubIds, id, seed),
    week: 1,
    table: emptyTable(clubIds),
    trainingLog: [],
    matchIds: [],
    finished: false,
  };
}

export const currentSeason = (state: GameState): Season => state.seasons[state.seasons.length - 1];
export const seasonWeeks = (s: Season): number => Math.max(...s.fixtures.map((f) => f.week));

export function trainingOffer(state: GameState): TrainingId[] {
  const s = currentSeason(state);
  return offerTraining(state.persona, hashSeed(s.seed, 'training', s.week));
}

/** P(start) for the persona at their current club. */
export function startChance(persona: Persona, club: Club): number {
  const p = 0.5 + (personaOvr(persona) - clubAvg(club) + C.SELECTION_OFFSET) * C.SELECTION_SLOPE;
  return Math.min(C.SELECTION_HI, Math.max(C.SELECTION_LO, p));
}

function pickRole(persona: Persona, club: Club, seed: number): PersonaRole {
  if (persona.injuryWeeksLeft > 0) return 'injured';
  const rng = createRng(seed);
  if (rng.chance(startChance(persona, club))) return 'start';
  return rng.chance(C.SUB_APPEARANCE_CHANCE) ? 'sub' : 'bench';
}

export interface WeekResult {
  state: GameState;
  /** The persona's club match this week. */
  matchId: string;
}

/** The player's only weekly decision: one training option. Everything else is simulated. */
/** Today's day of the week (older saves have no day: training). */
export const dayOf = (state: GameState): WeekDay => state.day ?? 'training';

export interface TrainingDayResult {
  state: GameState;
  /** Stat changes from the session (for the growth animation). */
  deltas: Partial<Record<StatKey, number>>;
  ovrBefore: number;
  ovrAfter: number;
  reward: AccountReward;
}

/**
 * Day 1 of a week: the training session. Stats grow (or the persona rests);
 * the match is played on the next day with playMatchDay().
 */
export function trainDay(state: GameState, optionId: TrainingId): TrainingDayResult {
  if (state.phase !== 'training') throw new Error('season is over; start the next season');
  if (dayOf(state) !== 'training') throw new Error('today is match day');
  const offer = trainingOffer(state);
  if (!offer.includes(optionId)) throw new Error(`option ${optionId} not offered this week`);
  const season = currentSeason(state);
  const before = state.persona;
  const trained = applyTraining(before, optionId);
  const ovrBefore = personaOvr(before);
  const ovrAfter = personaOvr(trained.persona);
  const { account, reward } = applyAccountEvents(normalizeAccount(state.account), [
    { type: 'training' },
    { type: 'ovr', delta: ovrAfter - ovrBefore },
  ]);
  const nextSeason: Season = { ...season, trainingLog: [...season.trainingLog, { week: season.week, optionId }] };
  return {
    state: {
      ...state,
      persona: trained.persona,
      day: 'match',
      pendingInjuryRisk: trained.injuryRiskBonus,
      account,
      seasons: [...state.seasons.slice(0, -1), nextSeason],
    },
    deltas: trained.deltas,
    ovrBefore,
    ovrAfter,
    reward,
  };
}

export interface MatchDayResult extends WeekResult {
  /** Stat growth earned by the performance. */
  deltas: Partial<Record<StatKey, number>>;
  ovrBefore: number;
  ovrAfter: number;
  reward: AccountReward;
}

/** Day 2 of a week: the match. The performance grows the persona; then the week ends. */
export function playMatchDay(state: GameState): MatchDayResult {
  if (state.phase !== 'training') throw new Error('season is over; start the next season');
  if (dayOf(state) !== 'match') throw new Error('train first: today is training day');
  const season = currentSeason(state);
  const before = state.persona;
  let persona = before;
  const club = state.clubs[persona.clubId];
  const role = pickRole(persona, club, hashSeed(season.seed, 'selection', season.week));
  const injuryRiskBonus = state.pendingInjuryRisk ?? 0;

  let table = season.table;
  const matches = { ...state.matches };
  let personaMatchId = '';
  let grown = persona;
  const events: AccountEvent[] = [];
  for (const fx of season.fixtures.filter((f) => f.week === season.week)) {
    const involved = fx.homeId === persona.clubId || fx.awayId === persona.clubId;
    const seed = hashSeed(season.seed, 'match', fx.matchId);
    const side = fx.homeId === persona.clubId ? 'home' : 'away';
    const result = simulateMatch({
      matchId: fx.matchId,
      seed,
      home: { id: fx.homeId, ratings: state.clubs[fx.homeId].ratings },
      away: { id: fx.awayId, ratings: state.clubs[fx.awayId].ratings },
      persona: involved
        ? { side, position: persona.position, stats: persona.stats, fatigue: persona.fatigue, role, injuryRiskBonus }
        : null,
    });
    table = applyResult(table, fx.homeId, fx.awayId, result.score);
    if (involved) {
      personaMatchId = fx.matchId;
      const match: Match = {
        id: fx.matchId,
        seasonId: season.id,
        week: season.week,
        seed,
        homeId: fx.homeId,
        awayId: fx.awayId,
        score: result.score,
        personaSide: side,
        personaStats: result.personaStats,
        events: result.events,
      };
      matches[match.id] = match;
      const ps = result.personaStats!;
      const [mine, theirs] = side === 'home' ? result.score : [result.score[1], result.score[0]];
      if (ps.minutes > 0) {
        persona = addFatigue(persona, (C.FATIGUE_PER_FULL_MATCH * ps.minutes) / 90);
        persona = applyMatchXp(persona, ps.rating);
        grown = persona;
        persona = {
          ...persona,
          career: {
            ...persona.career,
            apps: persona.career.apps + 1,
            goals: persona.career.goals + ps.goals,
            assists: persona.career.assists + ps.assists,
            saves: persona.career.saves + ps.saves,
          },
        };
      }
      events.push({ type: 'match', played: ps.minutes > 0, won: mine > theirs, rating: ps.rating, contributions: ps.goals + ps.assists + Math.floor(ps.saves / 3) });
      persona = weeklyRecovery(persona);
      if (ps.injuryWeeks > 0) persona = { ...persona, injuryWeeksLeft: ps.injuryWeeks };
    }
  }

  const ovrBefore = personaOvr(before);
  const ovrAfter = personaOvr(persona);
  events.push({ type: 'ovr', delta: ovrAfter - ovrBefore });
  const { account, reward } = applyAccountEvents(normalizeAccount(state.account), events);

  const nextSeason: Season = {
    ...season,
    week: season.week + 1,
    table,
    matchIds: [...season.matchIds, personaMatchId],
  };
  let next: GameState = {
    ...state,
    persona,
    matches,
    day: 'training',
    pendingInjuryRisk: 0,
    account,
    seasons: [...state.seasons.slice(0, -1), nextSeason],
  };
  let seasonReward = reward;
  if (nextSeason.week > seasonWeeks(nextSeason)) {
    next = finalizeSeason(next);
    const promoted = currentSeason(next).outcome === 'promoted';
    const done = applyAccountEvents(normalizeAccount(next.account), [{ type: 'season', promoted }]);
    next = { ...next, account: done.account };
    seasonReward = {
      xp: reward.xp + done.reward.xp,
      levelBefore: reward.levelBefore,
      levelAfter: done.reward.levelAfter,
      missionsDone: [...reward.missionsDone, ...done.reward.missionsDone],
    };
  }
  return { state: next, matchId: personaMatchId, deltas: statDeltas(before, grown), ovrBefore, ovrAfter, reward: seasonReward };
}

/** A whole week at once (training day + match day). Kept for tests and tools. */
export function playWeek(state: GameState, optionId: TrainingId): WeekResult {
  if (state.phase !== 'training') throw new Error('season is over; start the next season');
  const day1 = dayOf(state) === 'training' ? trainDay(state, optionId).state : state;
  const r = playMatchDay(day1);
  return { state: r.state, matchId: r.matchId };
}

/** Ranking of a tier: real table for the simulated tier, rating + noise for others. */
function rankTier(state: GameState, season: Season, tier: Tier): string[] {
  if (tier === season.tier) return sortTable(season.table, state.clubs).map((r) => r.clubId);
  const rng = createRng(hashSeed(season.seed, 'rank', tier));
  return Object.values(state.clubs)
    .filter((c) => c.tier === tier)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((c) => ({ id: c.id, score: clubAvg(c) + rng.range(-C.UNSIMULATED_TIER_NOISE, C.UNSIMULATED_TIER_NOISE) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.id);
}

function driftClub(c: Club, tier: Tier): Club {
  const base = C.TIER_BASE_RATING[tier];
  const d = (v: number) => Math.round(v + (base - v) * C.TIER_DRIFT);
  return { ...c, tier, ratings: { att: d(c.ratings.att), mid: d(c.ratings.mid), def: d(c.ratings.def), gk: d(c.ratings.gk) } };
}

export function personaSeasonRatings(state: GameState, season: Season): number[] {
  return season.matchIds
    .map((id) => state.matches[id]?.personaStats?.rating)
    .filter((r): r is number => typeof r === 'number');
}

export function finalizeSeason(state: GameState): GameState {
  const season = currentSeason(state);
  const ranking = rankTier(state, season, season.tier);
  const position = ranking.indexOf(state.persona.clubId) + 1;
  const n = ranking.length;

  // Move clubs across every tier boundary.
  const clubs = { ...state.clubs };
  for (const upper of [1, 2, 3] as Tier[]) {
    const lower = (upper + 1) as Tier;
    const down = rankTier(state, season, upper).slice(-C.RELEGATION_SPOTS);
    const up = rankTier(state, season, lower).slice(0, C.PROMOTION_SPOTS);
    for (const id of down) clubs[id] = driftClub(clubs[id], lower);
    for (const id of up) clubs[id] = driftClub(clubs[id], upper);
  }

  let outcome: SeasonOutcome = 'stayed';
  if (season.tier > 1 && position <= C.PROMOTION_SPOTS) outcome = 'promoted';
  else if (season.tier < 4 && position > n - C.RELEGATION_SPOTS) outcome = 'relegated';

  // Transfer offers for a standout season.
  const ratings = personaSeasonRatings(state, season);
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  const newTier = clubs[state.persona.clubId].tier;
  let transferOffers: GameState['transferOffers'] = [];
  if (newTier > 1 && ratings.length >= 5 && avg >= C.TRANSFER_MIN_AVG_RATING[state.persona.position]) {
    const target = (newTier - 1) as Tier;
    if (personaOvr(state.persona) >= C.TIER_BASE_RATING[target] - C.TRANSFER_OVR_MARGIN) {
      const rng = createRng(hashSeed(season.seed, 'transfers'));
      transferOffers = rng
        .shuffle(Object.values(clubs).filter((c) => c.tier === target).map((c) => c.id).sort())
        .slice(0, C.TRANSFER_OFFERS)
        .map((clubId) => ({ clubId }));
    }
  }

  const persona: Persona = { ...state.persona, career: { ...state.persona.career, seasons: state.persona.career.seasons + 1 } };
  const finished: Season = { ...season, finished: true, outcome, finalPosition: position };
  let next: GameState = {
    ...state,
    persona,
    clubs,
    phase: 'seasonSummary',
    transferOffers,
    seasons: [...state.seasons.slice(0, -1), finished],
  };
  const story = seasonStoryUz(seasonFacts(next, finished.id));
  next = { ...next, seasons: [...next.seasons.slice(0, -1), { ...finished, storyUz: story }] };
  return next;
}

/** Second meaningful choice: accept a transfer offer (clubId) or stay (null). */
export function startNextSeason(state: GameState, acceptClubId: string | null): GameState {
  if (state.phase !== 'seasonSummary') throw new Error('season still in progress');
  let clubId = state.persona.clubId;
  if (acceptClubId !== null) {
    if (!state.transferOffers.some((o) => o.clubId === acceptClubId)) throw new Error('no such offer');
    clubId = acceptClubId;
  }
  const persona: Persona = { ...state.persona, clubId, age: state.persona.age + 1, fatigue: 0 };
  const base: GameState = { ...state, persona, phase: 'training', transferOffers: [] };
  return { ...base, seasons: [...base.seasons, createSeason(base, currentSeason(state).index + 1)] };
}
