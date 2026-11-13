import { describe, expect, it } from 'vitest';
import { LANGS, ruPlural, seasonStory, tierName, type SeasonFacts } from '../src';

const base: SeasonFacts = {
  personaName: 'Aziz', position: 'ST', seasonIndex: 1, clubName: 'Qumtepa FK', tier: 4, tierName: 'Akademiya Ligasi',
  nextTier: 3, nextTierName: 'Bronza Liga', matches: 14, apps: 8, starts: 6, goals: 4, assists: 2, saves: 0,
  avgRating: 7.1, best: { rating: 8.4, opponentName: 'Oqsoy Sport', goals: 2 }, injuries: 0, injuryWeeks: 0,
  outcome: 'promoted', finalPosition: 2, transferOffered: false,
};

const cases: Record<string, Partial<SeasonFacts>> = {
  promoted: {},
  champion: { finalPosition: 1 },
  championStay: { finalPosition: 1, outcome: 'stayed', tier: 1, nextTier: 1 },
  relegated: { tier: 3, nextTier: 4, outcome: 'relegated', finalPosition: 8 },
  stayed: { tier: 3, nextTier: 3, outcome: 'stayed', finalPosition: 5 },
  noApps: { apps: 0, goals: 0, assists: 0, avgRating: null, best: null },
  gk: { position: 'GK', saves: 21, goals: 0, assists: 0 },
  quiet: { goals: 0, assists: 0 },
  injured: { injuries: 1, injuryWeeks: 3, transferOffered: true, avgRating: 7.8 },
  later: { seasonIndex: 4 },
};

describe('season story in every language', () => {
  for (const lang of LANGS) {
    it(`${lang}: covers every case with numbers and names filled in`, () => {
      for (const [name, over] of Object.entries(cases)) {
        const text = seasonStory({ ...base, ...over }, lang);
        expect(text, `${lang}/${name}`).not.toMatch(/undefined|NaN|\$\{|\[object/);
        expect(text.length, `${lang}/${name}`).toBeGreaterThan(40);
      }
      expect(seasonStory(base, lang)).toContain('Oqsoy Sport');
    });
  }

  it('each language names the leagues in its own words', () => {
    expect(seasonStory(base, 'uz')).toContain("Bronza Ligaga ko'tarildi");
    expect(seasonStory(base, 'en')).toContain('promoted to the Bronze League');
    expect(seasonStory(base, 'ru')).toContain('поднялась в Бронзовую лигу');
    expect(seasonStory({ ...base, ...cases.champion }, 'ru')).toContain('чемпионом в Лиге академий');
    expect(tierName(1, 'ru')).toBe('Золотая лига');
    expect(tierName(2, 'en')).toBe('Silver League');
  });

  it('uses correct plurals', () => {
    expect(seasonStory(base, 'en')).toContain('4 goals and made 2 assists in 8 matches');
    expect(seasonStory({ ...base, goals: 1, assists: 1, apps: 1, best: null }, 'en')).toContain('1 goal and made 1 assist in 1 match');
    expect(seasonStory(base, 'ru')).toContain('За 8 матчей вы забили 4 гола и отдали 2 голевые передачи');
    expect(seasonStory({ ...base, goals: 5, assists: 1, apps: 21 }, 'ru')).toContain('За 21 матч вы забили 5 голов и отдали 1 голевую передачу');
    expect([1, 2, 5, 11, 12, 21, 22, 25, 111].map((n) => ruPlural(n, 'a', 'b', 'c')).join('')).toBe('abccc' + 'abcc');
  });

  it('leaves out a zero count instead of saying "0 assists"', () => {
    const goalsOnly = { ...base, goals: 2, assists: 0, apps: 10 };
    const assistsOnly = { ...base, goals: 0, assists: 3, apps: 10 };
    for (const lang of LANGS) {
      expect(seasonStory(goalsOnly, lang), lang).not.toMatch(/\b0 /);
      expect(seasonStory(assistsOnly, lang), lang).not.toMatch(/\b0 /);
    }
    expect(seasonStory(goalsOnly, 'uz')).toContain("10 ta o'yinda 2 ta gol urdingiz.");
    expect(seasonStory(goalsOnly, 'en')).toContain('You scored 2 goals in 10 matches.');
    expect(seasonStory(goalsOnly, 'ru')).toContain('За 10 матчей вы забили 2 гола.');
    expect(seasonStory(assistsOnly, 'en')).toContain('You made 3 assists in 10 matches.');
    expect(seasonStory(assistsOnly, 'ru')).toContain('вы отдали 3 голевые передачи.');
    expect(seasonStory(assistsOnly, 'uz')).toContain("3 ta golli pas berdingiz.");
  });

  it('English ordinals', () => {
    const at = (p: number) => seasonStory({ ...base, ...cases.stayed, finalPosition: p }, 'en');
    expect(at(2)).toContain('finished 2nd');
    expect(at(3)).toContain('finished 3rd');
    expect(at(5)).toContain('finished 5th');
  });
});
