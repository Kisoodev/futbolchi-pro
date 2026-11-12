/**
 * Fictional league pyramid. All names are invented; do not add real clubs,
 * leagues, players or towns that host a real professional club.
 */
import * as C from './constants';
import { clamp, createRng, hashSeed } from './rng';
import type { Club, ClubRatings, Fixture, TableRow, Tier } from './types';

/** League names (Uzbek, proper nouns). */
export const TIER_NAMES: Record<Tier, string> = {
  1: 'Oltin Liga',
  2: 'Kumush Liga',
  3: 'Bronza Liga',
  4: 'Akademiya Ligasi',
};

/** Invented town names. */
export const TOWNS = [
  'Qumtepa', 'Oqsoy', 'Yashilobod', "Tog'etak", "Bo'ztepa", 'Kumushsoy', 'Shamolli', 'Chinorli',
  'Bulutli', 'Oydinkent', 'Quyoshli', "Gulbog'", 'Tolzor', 'Suvsamar', 'Yulduzkent', 'Charoqli',
  'Moviyobod', 'Lolazor', 'Bahorobod', 'Shirinsoy', "Ko'kterak", 'Oqqushli', 'Tiniqsoy', 'Bodomzor',
  'Anorli', 'Uzumzor', 'Qayinsoy', "Yong'oqli", 'Shabbodali', 'Tongotar', 'Kamalakli', 'Sohilobod',
  'Ilonsoy', 'Toshtepa', 'Otliqsoy', 'Bulbulobod',
];

const NAME_PATTERNS = [
  (t: string) => `${t} FK`,
  (t: string) => `${t} Sport`,
  (t: string) => `${t} Lochinlari`,
  (t: string) => `${t} Arslonlari`,
  (t: string) => `${t} Yulduzi`,
];

const COLORS = [
  '#d94848', '#2f6fd6', '#111827', '#e0a526', '#8a4fd1', '#e64980', '#e06a2b', '#4a5568',
  '#c2398f', '#5f3dc4', '#2b4c7e', '#b5651d', '#7a1f3d', '#364fc7', '#9f7aea', '#a0522d',
];

function rateClub(base: number, rng: ReturnType<typeof createRng>): ClubRatings {
  const club = rng.range(-C.CLUB_RATING_SPREAD, C.CLUB_RATING_SPREAD);
  const r = (): number => Math.round(clamp(base + club + rng.range(-2, 2), 20, 95));
  return { att: r(), mid: r(), def: r(), gk: r() };
}

export const clubAvg = (c: Club): number => (c.ratings.att + c.ratings.mid + c.ratings.def + c.ratings.gk) / 4;

/** Generates the whole pyramid: CLUBS_PER_TIER clubs in each of the tiers. */
export function generateWorld(seed: number): Record<string, Club> {
  const rng = createRng(hashSeed(seed, 'world'));
  const towns = rng.shuffle(TOWNS);
  const colors = rng.shuffle(COLORS);
  const clubs: Record<string, Club> = {};
  let i = 0;
  for (const tier of C.TIERS) {
    for (let k = 0; k < C.CLUBS_PER_TIER; k++, i++) {
      const id = `c${String(i + 1).padStart(2, '0')}`;
      clubs[id] = {
        id,
        name: rng.pick(NAME_PATTERNS)(towns[i % towns.length]),
        tier,
        ratings: rateClub(C.TIER_BASE_RATING[tier], rng),
        color: colors[i % colors.length],
      };
    }
  }
  return clubs;
}

/** Double round-robin (circle method). n even. Returns fixtures for 2(n−1) weeks. */
export function doubleRoundRobin(clubIds: string[], seasonId: string, seed: number): Fixture[] {
  const rng = createRng(hashSeed(seed, 'fixtures'));
  const ids = rng.shuffle(clubIds);
  const n = ids.length;
  if (n % 2 !== 0) throw new Error('need an even number of clubs');
  const rounds: [string, string][][] = [];
  const arr = ids.slice();
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      // Alternate home/away so no club is always home.
      pairs.push((r + i) % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop()!); // rotate all but the first
  }
  const fixtures: Fixture[] = [];
  const all = [...rounds, ...rounds.map((p) => p.map(([h, a]) => [a, h] as [string, string]))];
  all.forEach((pairs, w) => {
    for (const [homeId, awayId] of pairs) {
      fixtures.push({ week: w + 1, homeId, awayId, matchId: `${seasonId}-w${w + 1}-${homeId}-${awayId}` });
    }
  });
  return fixtures;
}

export function emptyTable(clubIds: string[]): TableRow[] {
  return clubIds.map((clubId) => ({ clubId, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 }));
}

export function applyResult(table: TableRow[], homeId: string, awayId: string, score: [number, number]): TableRow[] {
  return table.map((row) => {
    if (row.clubId !== homeId && row.clubId !== awayId) return row;
    const isHome = row.clubId === homeId;
    const gf = isHome ? score[0] : score[1];
    const ga = isHome ? score[1] : score[0];
    const won = gf > ga ? 1 : 0, drawn = gf === ga ? 1 : 0, lost = gf < ga ? 1 : 0;
    return {
      ...row,
      played: row.played + 1,
      won: row.won + won,
      drawn: row.drawn + drawn,
      lost: row.lost + lost,
      gf: row.gf + gf,
      ga: row.ga + ga,
      points: row.points + won * C.POINTS_WIN + drawn * C.POINTS_DRAW,
    };
  });
}

/** Sorted by points, goal difference, goals for, then club name. */
export function sortTable(table: TableRow[], clubs: Record<string, Club>): TableRow[] {
  return table.slice().sort(
    (a, b) =>
      b.points - a.points ||
      b.gf - b.ga - (a.gf - a.ga) ||
      b.gf - a.gf ||
      clubs[a.clubId].name.localeCompare(clubs[b.clubId].name),
  );
}
