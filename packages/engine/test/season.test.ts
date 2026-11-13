import { describe, expect, it } from 'vitest';
import {
  currentSeason,
  doubleRoundRobin,
  finalizeSeason,
  generateWorld,
  newGame,
  playWeek,
  seasonFacts,
  seasonStoryUz,
  seasonWeeks,
  startNextSeason,
  trainingOffer,
  TIER_NAMES,
  type GameState,
} from '../src';
import * as C from '../src/constants';

const start = (seed = 1): GameState =>
  newGame({ seed, persona: { id: 'p1', name: 'Aziz', position: 'ST', bonus: { shooting: 5, pace: 5 } } });

/** Plays the rest of the season, always picking the first offered option. */
function playSeason(state: GameState): GameState {
  let s = state;
  while (s.phase === 'training') s = playWeek(s, trainingOffer(s)[0]).state;
  return s;
}

describe('world & fixtures', () => {
  it('generates 4 tiers of 8 clubs with unique names', () => {
    const clubs = Object.values(generateWorld(3));
    expect(clubs).toHaveLength(32);
    for (const t of C.TIERS) expect(clubs.filter((c) => c.tier === t)).toHaveLength(8);
    expect(new Set(clubs.map((c) => c.name)).size).toBe(32);
  });

  it('double round-robin: 14 weeks, each pair meets home and away once', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const fx = doubleRoundRobin(ids, 's1', 5);
    expect(fx).toHaveLength(56);
    expect(Math.max(...fx.map((f) => f.week))).toBe(14);
    for (let w = 1; w <= 14; w++) {
      const teams = fx.filter((f) => f.week === w).flatMap((f) => [f.homeId, f.awayId]);
      expect(new Set(teams).size).toBe(8);
    }
    const pairs = new Set(fx.map((f) => `${f.homeId}>${f.awayId}`));
    expect(pairs.size).toBe(56);
  });
});

describe('season loop', () => {
  it('starts the persona in an academy-tier club', () => {
    const s = start();
    expect(s.clubs[s.persona.clubId].tier).toBe(4);
    expect(currentSeason(s).clubIds).toContain(s.persona.clubId);
  });

  it('rejects options that were not offered', () => {
    const s = start();
    const offered = trainingOffer(s);
    const notOffered = C.TRAINING_OPTIONS.map((o) => o.id).find((id) => !offered.includes(id))!;
    expect(() => playWeek(s, notOffered)).toThrow();
  });

  it('a full season plays 14 matches and ends in the summary phase', () => {
    const end = playSeason(start());
    const season = currentSeason(end);
    expect(season.matchIds).toHaveLength(14);
    expect(season.finished).toBe(true);
    expect(end.phase).toBe('seasonSummary');
    for (const row of season.table) expect(row.played).toBe(14);
    const totalGf = season.table.reduce((a, r) => a + r.gf, 0);
    const totalGa = season.table.reduce((a, r) => a + r.ga, 0);
    expect(totalGf).toBe(totalGa);
    expect(season.storyUz).toBeTruthy();
    expect(() => playWeek(end, 'rest')).toThrow();
  });

  it('is fully deterministic and JSON-serializable', () => {
    const a = playSeason(start(77));
    const b = playSeason(start(77));
    expect(b).toEqual(a);
    const roundTrip = JSON.parse(JSON.stringify(a)) as GameState;
    expect(roundTrip).toEqual(a);
    // Continuing from a deserialized save gives the same result.
    const c1 = playWeek(startNextSeason(a, null), trainingOffer(startNextSeason(a, null))[0]).state;
    const c2 = playWeek(startNextSeason(roundTrip, null), trainingOffer(startNextSeason(roundTrip, null))[0]).state;
    expect(c2).toEqual(c1);
  });

  it('promotion and relegation keep 8 clubs per tier and move the persona club correctly', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const end = playSeason(start(seed));
      for (const t of C.TIERS) expect(Object.values(end.clubs).filter((c) => c.tier === t)).toHaveLength(8);
      const season = currentSeason(end);
      const tierNow = end.clubs[end.persona.clubId].tier;
      if (season.outcome === 'promoted') expect(tierNow).toBe(season.tier - 1);
      else if (season.outcome === 'relegated') expect(tierNow).toBe(season.tier + 1);
      else expect(tierNow).toBe(season.tier);
      if (season.finalPosition! <= 2) expect(season.outcome).toBe('promoted');
    }
  });

  it('next season: persona ages, new league for the club tier, transfer accepted only if offered', () => {
    const end = playSeason(start(4));
    expect(() => startNextSeason(end, 'not-a-club')).toThrow();
    const next = startNextSeason(end, null);
    expect(next.persona.age).toBe(end.persona.age + 1);
    expect(next.seasons).toHaveLength(2);
    expect(currentSeason(next).tier).toBe(next.clubs[next.persona.clubId].tier);
    expect(currentSeason(next).week).toBe(1);
  });

  it('a standout season produces transfer offers one tier up', () => {
    let s = playSeason(start(11));
    const season = currentSeason(s);
    // Force a brilliant season for the persona.
    const matches = { ...s.matches };
    for (const id of season.matchIds) {
      const m = matches[id];
      matches[id] = { ...m, personaStats: { ...m.personaStats!, role: 'start', minutes: 90, rating: 8.5 } };
    }
    const boosted: GameState = {
      ...s,
      matches,
      phase: 'training',
      persona: { ...s.persona, stats: { pace: 70, shooting: 70, passing: 70, dribbling: 70, defending: 70, physical: 70, mentality: 70 } },
      seasons: [...s.seasons.slice(0, -1), { ...season, finished: false, outcome: undefined }],
      clubs: Object.fromEntries(Object.entries(s.clubs).map(([k, c]) => [k, c])),
    };
    // Re-run finalize on the original club tiers.
    const orig = start(11);
    s = finalizeSeason({ ...boosted, clubs: orig.clubs });
    expect(s.transferOffers.length).toBe(C.TRANSFER_OFFERS);
    const newTier = s.clubs[s.persona.clubId].tier;
    for (const o of s.transferOffers) expect(s.clubs[o.clubId].tier).toBe(newTier - 1);
    const moved = startNextSeason(s, s.transferOffers[0].clubId);
    expect(moved.persona.clubId).toBe(s.transferOffers[0].clubId);
    expect(currentSeason(moved).clubIds).toContain(moved.persona.clubId);
  });

  it('a 6-season career runs without errors', () => {
    let s = start(21);
    for (let i = 0; i < 6; i++) {
      s = playSeason(s);
      s = startNextSeason(s, s.transferOffers[0]?.clubId ?? null);
    }
    expect(s.seasons).toHaveLength(7);
    expect(s.persona.age).toBe(C.START_AGE + 6);
    expect(currentSeason(s).fixtures.length).toBe(56);
    expect(seasonWeeks(currentSeason(s))).toBe(14);
  });
});

describe('story', () => {
  const base = {
    personaName: 'Aziz', position: 'ST' as const, seasonIndex: 1, clubName: 'Qumtepa FK', tier: 4 as const,
    tierName: TIER_NAMES[4], nextTier: 3 as const, nextTierName: TIER_NAMES[3], matches: 14, apps: 8, starts: 6, goals: 4, assists: 2,
    saves: 0, avgRating: 7.1, best: { rating: 8.4, opponentName: 'Oqsoy Sport', goals: 2 }, injuries: 0,
    injuryWeeks: 0, outcome: 'promoted' as const, finalPosition: 2, transferOffered: false,
  };
  it('mentions goals, apps and promotion in Uzbek', () => {
    const t = seasonStoryUz(base);
    expect(t).toContain("8 ta o'yinda 4 ta gol urdingiz");
    expect(t).toContain("Bronza Ligaga ko'tarildi");
  });
  it('covers no appearances, injury, relegation and GK', () => {
    expect(seasonStoryUz({ ...base, apps: 0, avgRating: null, best: null })).toContain('maydonga tushish nasib etmadi');
    expect(seasonStoryUz({ ...base, injuries: 1, injuryWeeks: 3 })).toContain('3 hafta');
    expect(seasonStoryUz({ ...base, tier: 3, outcome: 'relegated', finalPosition: 8, nextTier: 4, nextTierName: TIER_NAMES[4] })).toContain('tushib ketdi');
    expect(seasonStoryUz({ ...base, position: 'GK', saves: 20 })).toContain('20 marta darvozani qutqardingiz');
  });
  it('facts match stored matches', () => {
    const end = playSeason(start(5));
    const f = seasonFacts(end, currentSeason(end).id);
    const apps = currentSeason(end).matchIds.filter((id) => end.matches[id].personaStats!.rating !== null).length;
    expect(f.apps).toBe(apps);
    expect(f.matches).toBe(14);
  });
});
