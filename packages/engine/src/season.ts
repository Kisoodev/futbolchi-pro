/**
 * Season loop. All functions take a GameState and return a NEW GameState
 * (no mutation), so state can be stored, replayed and diffed as plain JSON.
 */
import * as C from './constants';
import { applyResult, clubAvg, doubleRoundRobin, emptyTable, generateWorld, sortTable } from './league';
import { simulateMatch } from './match';
import { addFatigue, createPersona, personaOvr, type CreatePersonaInput } from './persona';
import { applyMatchGrowth, applyXp, matchXp, milestonesBetween, personaLevel, PROGRESSION_CONFIG as PC, tierConfig, trainingXp, upgradeAttribute } from './progression';
import { getTrainingOption } from './training';
import { statDeltas } from './persona';
import { driftSquad, ratingsFromSquad, squadAvg } from './npc';
import { academySquad } from './roster';
import { ETIQOD } from './academyLeague';
import { teamGrowth } from './teamGrowth';
import { pickLineup } from './lineup';
import { applyAccountEvents, normalizeAccount, type AccountEvent, type AccountReward } from './account';
import { createRng, hashSeed } from './rng';
import { seasonFacts, seasonStoryUz } from './story';
import { applyTrainingDay, offerTraining, weeklyRecovery, type TrainingId } from './training';
import type { Club, GameState, Match, MatchLineup, Persona, PersonaRole, Season, SeasonOutcome, Side, StatKey, Tier, WeekDay } from './types';

export interface NewGameInput {
  seed: number;
  persona: Omit<CreatePersonaInput, 'clubId' | 'seed'>;
}

export function newGame(input: NewGameInput): GameState {
  const clubs = generateWorld(input.seed);
  // every career starts at Etiqod Akademiyasi (docs/LEAGUE.md)
  const picked = clubs[ETIQOD];
  // the persona's first club plays with the academy team of docs/CHARACTERS.md
  const squad = academySquad(picked.id, input.seed, picked.squad);
  const club = { ...picked, squad, ratings: ratingsFromSquad(squad) };
  clubs[club.id] = club;
  const persona = createPersona({ ...input.persona, clubId: club.id, seed: input.seed });
  const state: GameState = {
    version: 2,
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
    startOvr: personaLevel(state.persona),
    teamStartOvr: Math.round(squadAvg(state.clubs[state.persona.clubId].squad) * 10) / 10,
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


export interface WeekResult {
  state: GameState;
  /** The persona's club match this week. */
  matchId: string;
}

/** Both teams' lineups for this week's match of the persona (same input → same XI). */
export function weekLineups(state: GameState, homeId: string, awayId: string): Record<'home' | 'away', MatchLineup> {
  const season = currentSeason(state);
  const seed = hashSeed(season.seed, 'lineup-week', season.week);
  const p = state.persona;
  const me = { id: p.id, name: p.name, position: p.position, injuryWeeksLeft: p.injuryWeeksLeft, ovr: personaLevel(p) };
  const of = (id: string) => pickLineup(state.clubs[id], { seed, persona: id === p.clubId ? me : undefined });
  return { home: of(homeId), away: of(awayId) };
}

/** The persona's team for this week's match (for the lineup board before kick-off). */
export function nextLineup(state: GameState): MatchLineup | null {
  const season = currentSeason(state);
  const fx = season.fixtures.find((f) => f.week === season.week && (f.homeId === state.persona.clubId || f.awayId === state.persona.clubId));
  if (!fx) return null;
  const l = weekLineups(state, fx.homeId, fx.awayId);
  return fx.homeId === state.persona.clubId ? l.home : l.away;
}

/** Today's day of the week (older saves have no day: training). */
export const dayOf = (state: GameState): WeekDay => state.day ?? 'training';

export interface TrainingDayResult {
  state: GameState;
  /** XP the day was worth (it went straight into the trained attributes). */
  xp: number;
  /** Attribute changes, for the growth animation. */
  deltas: Partial<Record<StatKey, number>>;
  levelBefore: number;
  levelAfter: number;
  milestones: number[];
  reward: AccountReward;
}

/**
 * Day 1 of a week: the player picks ONE of the day's offered trainings. Its XP
 * (§4.2: sessionsPerDay × xpPerSession × league multiplier) goes straight into
 * the attributes that training works on, at the §5 prices. Rest grows nothing
 * but brings fatigue down. The match is on the next day (playMatchDay).
 */
export function trainDay(state: GameState, optionId: TrainingId): TrainingDayResult {
  if (state.phase !== 'training') throw new Error('season is over; start the next season');
  if (dayOf(state) !== 'training') throw new Error('today is match day');
  const offer = trainingOffer(state);
  if (!offer.includes(optionId)) throw new Error(`option ${optionId} not offered this week`);
  const season = currentSeason(state);
  const before = state.persona;
  const day = applyTrainingDay(before, optionId);
  const focus = getTrainingOption(optionId).focus;
  const injured = before.injuryWeeksLeft > 0;
  const xp = focus.length && !injured ? trainingXp(PC.TRAINING.sessionsPerDay, season.tier) : 0;
  const persona = applyXp(day.persona, focus, xp);
  const levelBefore = personaLevel(before);
  const levelAfter = personaLevel(persona);
  const { account, reward } = applyAccountEvents(normalizeAccount(state.account), [
    { type: 'training' },
    { type: 'ovr', delta: levelAfter - levelBefore },
  ]);
  const nextSeason: Season = { ...season, trainingLog: [...season.trainingLog, { week: season.week, optionId }] };
  return {
    state: {
      ...state,
      persona,
      day: 'match',
      pendingInjuryRisk: day.injuryRiskBonus,
      account,
      seasons: [...state.seasons.slice(0, -1), nextSeason],
    },
    xp,
    deltas: statDeltas(before, persona),
    levelBefore,
    levelAfter,
    milestones: milestonesBetween(levelBefore, levelAfter),
    reward,
  };
}

export interface MatchDayResult extends WeekResult {
  /** XP earned in the match (0 when the persona did not play); it grew the main attributes. */
  xp: number;
  deltas: Partial<Record<StatKey, number>>;
  levelBefore: number;
  levelAfter: number;
  milestones: number[];
  reward: AccountReward;
}

/** Day 2 of a week: the match. The performance earns XP; then the week ends. */
export function playMatchDay(state: GameState): MatchDayResult {
  if (state.phase !== 'training') throw new Error('season is over; start the next season');
  if (dayOf(state) !== 'match') throw new Error('train first: today is training day');
  const season = currentSeason(state);
  const before = state.persona;
  let persona = before;
  let grownStats = before.stats;
  // the persona (like the core characters) always starts, unless injured
  const role: PersonaRole = persona.injuryWeeksLeft > 0 ? 'injured' : 'start';
  const injuryRiskBonus = state.pendingInjuryRisk ?? 0;

  let table = season.table;
  const matches = { ...state.matches };
  let personaMatchId = '';
  let xp = 0;
  const events: AccountEvent[] = [];
  for (const fx of season.fixtures.filter((f) => f.week === season.week)) {
    const involved = fx.homeId === persona.clubId || fx.awayId === persona.clubId;
    const seed = hashSeed(season.seed, 'match', fx.matchId);
    const side: Side = fx.homeId === persona.clubId ? 'home' : 'away';
    // the persona's league is played by the possession-chain engine with both clubs' XIs; other leagues use the quick engine
    const myLeague = state.clubs[fx.homeId].tier === state.clubs[persona.clubId].tier;
    const lineups = myLeague ? weekLineups(state, fx.homeId, fx.awayId) : undefined;
    const simPersona = involved ? { side, position: persona.position, stats: persona.stats, fatigue: persona.fatigue, role, injuryRiskBonus } : null;
    const result = simulateMatch({
      matchId: fx.matchId,
      seed,
      home: { id: fx.homeId, ratings: state.clubs[fx.homeId].ratings },
      away: { id: fx.awayId, ratings: state.clubs[fx.awayId].ratings },
      persona: simPersona,
      lineups,
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
        lineups,
        players: result.players,
        ...(result.engine ? { engine: result.engine, simPersona } : {}),
      };
      matches[match.id] = match;
      const ps = result.personaStats!;
      const [mine, theirs] = side === 'home' ? result.score : [result.score[1], result.score[0]];
      if (ps.minutes > 0) {
        const opponent = state.clubs[side === 'home' ? fx.awayId : fx.homeId];
        xp = matchXp({
          rating: ps.rating ?? PC.MATCH_XP.ratingPivot,
          minutes: ps.minutes,
          goals: ps.goals,
          assists: ps.assists,
          cleanSheet: theirs === 0,
          position: persona.position,
          result: mine > theirs ? 'win' : mine === theirs ? 'draw' : 'loss',
          tier: season.tier,
          opponentOvr: clubAvg(opponent),
          personaOvr: personaLevel(persona),
        });
        persona = addFatigue(persona, (C.FATIGUE_PER_FULL_MATCH * ps.minutes) / 90);
        persona = applyMatchGrowth(persona, xp);
        grownStats = persona.stats;
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

  const levelBefore = personaLevel(before);
  const levelAfter = personaLevel(persona);
  events.push({ type: 'ovr', delta: levelAfter - levelBefore });
  const { account, reward } = applyAccountEvents(normalizeAccount(state.account), events);
  const nextSeason: Season = {
    ...season,
    week: season.week + 1,
    table,
    matchIds: [...season.matchIds, personaMatchId],
  };
  let next: GameState = {
    ...state,
    // the squad grows week by week (faster when the persona trained), Odil too
    clubs: teamGrowth(state, season),
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
  return {
    state: next,
    matchId: personaMatchId,
    xp,
    deltas: statDeltas(before, { ...before, stats: grownStats }),
    levelBefore,
    levelAfter,
    milestones: milestonesBetween(levelBefore, levelAfter),
    reward: seasonReward,
  };
}

export interface UpgradeResult {
  state: GameState;
  /** OVR (as shown) before and after. */
  levelBefore: number;
  levelAfter: number;
  /** Milestones (60, 65, …) reached by this upgrade. */
  milestones: number[];
  reward: AccountReward;
}

/** Spends XP on +1 of an attribute (docs/PROGRESSION_SYSTEM.md §5). */
export function upgradeInGame(state: GameState, key: StatKey): UpgradeResult {
  const levelBefore = personaLevel(state.persona);
  const persona = upgradeAttribute(state.persona, key);
  const levelAfter = personaLevel(persona);
  const { account, reward } = applyAccountEvents(normalizeAccount(state.account), [{ type: 'ovr', delta: levelAfter - levelBefore }]);
  return { state: { ...state, persona, account }, levelBefore, levelAfter, milestones: milestonesBetween(levelBefore, levelAfter), reward };
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

/** A club in its (possibly new) tier after a season: every NPC changes −2…+3 and stays in the tier's range. */
function driftClub(c: Club, tier: Tier, seed: number): Club {
  const squad = driftSquad(c.squad, tier, hashSeed(seed, 'drift', c.id));
  return { ...c, tier, squad, ratings: ratingsFromSquad(squad) };
}

/** Average of the persona's last `n` match ratings. */
export function recentAvgRating(state: GameState, n = 10): { avg: number; count: number } {
  const all = state.seasons.flatMap((s) => personaSeasonRatings(state, s));
  const last = all.slice(-n);
  return { avg: last.length ? last.reduce((a, b) => a + b, 0) / last.length : 0, count: last.length };
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

  // Move clubs across every tier boundary, then every squad changes a little.
  const newTier: Record<string, Tier> = {};
  for (const c of Object.values(state.clubs)) newTier[c.id] = c.tier;
  for (const upper of C.TIERS.slice(0, -1)) {
    const lower = (upper + 1) as Tier;
    for (const id of rankTier(state, season, upper).slice(-C.RELEGATION_SPOTS)) newTier[id] = lower;
    for (const id of rankTier(state, season, lower).slice(0, C.PROMOTION_SPOTS)) newTier[id] = upper;
  }
  const clubs: Record<string, Club> = {};
  for (const c of Object.values(state.clubs)) clubs[c.id] = driftClub(c, newTier[c.id], season.seed);

  let outcome: SeasonOutcome = 'stayed';
  const bottomTier = C.TIERS[C.TIERS.length - 1];
  if (season.tier > C.TOP_TIER && position <= C.PROMOTION_SPOTS) outcome = 'promoted';
  else if (season.tier < bottomTier && position > n - C.RELEGATION_SPOTS) outcome = 'relegated';

  // Offers from the next tier (§7.3): OVR ≥ that tier's regular minimum + 2 and a good recent form.
  const clubTier = clubs[state.persona.clubId].tier;
  let transferOffers: GameState['transferOffers'] = [];
  if (clubTier > C.TOP_TIER) {
    const target = (clubTier - 1) as Tier;
    const form = recentAvgRating(state, 10);
    const enoughGames = form.count >= Math.min(10, season.matchIds.length);
    if (
      enoughGames &&
      personaLevel(state.persona) >= tierConfig(target).regular[0] + PC.PROMOTION.ovrAboveNextRegularMin &&
      form.avg >= PC.PROMOTION.minAvgRatingLast10
    ) {
      const rng = createRng(hashSeed(season.seed, 'transfers'));
      transferOffers = rng
        .shuffle(Object.values(clubs).filter((c) => c.tier === target).map((c) => c.id).sort())
        .slice(0, PC.OFFERS)
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
