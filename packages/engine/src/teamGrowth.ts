/**
 * The persona's club grows during the season (docs/LEAGUE.md, "The title race").
 *
 * Etiqod starts mid-table (57) against Clairmont (the strongest, ~61.5). Every
 * week each teammate may improve by one OVR point — more often in weeks when
 * the persona really trained (Kapadze's training lifts the whole squad), so a
 * hard-working player can carry the team to the title by the end of the season.
 *
 * Odil, the rival, grows at his own pace and may pass the academy's usual 62
 * (agents watch him), so passing him takes work: the persona grows faster than
 * the teammates, but not by magic.
 */
import { ratingsFromSquad, tierOvrRange } from './npc';
import { createRng, hashSeed } from './rng';
import type { Club, GameState, Season } from './types';

export const TEAM_GROWTH = {
  /** Weekly chance that a teammate gains +1 OVR. */
  base: 0.03,
  /** Extra chance in a week the persona trained (not rest). */
  trained: 0.1,
  /** Odil's weekly chance of +1. */
  odil: 0.1,
  /** How far above the tier's usual top Odil may grow. */
  odilAboveCap: 4,
};

/** Did the persona really train this week (anything but rest)? */
export const trainedThisWeek = (season: Season): boolean => season.trainingLog.some((l) => l.week === season.week && l.optionId !== 'rest');

/** The persona's club after this week's growth (other clubs unchanged). */
export function teamGrowth(state: GameState, season: Season): Record<string, Club> {
  const club = state.clubs[state.persona.clubId];
  if (!club) return state.clubs;
  const trained = trainedThisWeek(season);
  const rng = createRng(hashSeed(season.seed, 'team-growth', club.id, season.week));
  const [, hi] = tierOvrRange(club.tier);
  let changed = false;
  const squad = club.squad.map((p) => {
    const odil = p.characterKey === 'odil';
    const chance = odil ? TEAM_GROWTH.odil : TEAM_GROWTH.base + (trained ? TEAM_GROWTH.trained : 0);
    const cap = odil ? hi + TEAM_GROWTH.odilAboveCap : hi;
    if (p.ovr < cap && rng.chance(chance)) {
      changed = true;
      return { ...p, ovr: p.ovr + 1 };
    }
    return p;
  });
  if (!changed) return state.clubs;
  return { ...state.clubs, [club.id]: { ...club, squad, ratings: ratingsFromSquad(squad) } };
}
