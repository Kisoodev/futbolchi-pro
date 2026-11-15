/**
 * Brings saves from before the progression system (version 1) up to date:
 *
 *  - the persona drops "mentality", and every attribute moves up by the same
 *    amount the start rating moved (old start ≈ 40 → new START_OVR = 52), so
 *    the player keeps the same strength relative to everyone else; values are
 *    whole numbers in 1…MAX_ATTR; the XP bank starts at 0;
 *  - every club gets an NPC squad for its tier (its line ratings come from it);
 *  - the old top league joins the 1-liga (three leagues now);
 *  - tiers get the 16 clubs of the new pyramid from the next season on (the
 *    current season and its table are kept as they are).
 *
 * Safe to run on any save: version 2 saves come back unchanged.
 */
import * as C from './constants';
import { generateWorld } from './league';
import { generateSquad, ratingsFromSquad } from './npc';
import { PROGRESSION_CONFIG as PC } from './progression';
import { clamp, hashSeed } from './rng';
import { STAT_KEYS, type Club, type GameState, type Persona, type Position, type Stats } from './types';

/** Old start rating (version 1 templates were tuned to OVR ≈ 40). */
export const OLD_START_OVR = 40;
export const MIGRATION_SHIFT = PC.START_OVR - OLD_START_OVR;

const POSITIONS_V2 = Object.keys(PC.WEIGHTS) as Position[];

/** A version-1 persona on the new scale. */
export function migratePersona(p: Persona): Persona {
  const old = p.stats as Stats & { mentality?: number };
  if (!('mentality' in old) && typeof p.xp === 'number') return p;
  const stats = {} as Stats;
  for (const k of STAT_KEYS) stats[k] = clamp(Math.round((old[k] ?? 40) + MIGRATION_SHIFT), 1, PC.MAX_ATTR);
  return {
    ...p,
    position: POSITIONS_V2.includes(p.position) ? p.position : 'CM',
    stats,
    xp: typeof p.xp === 'number' ? p.xp : 0,
  };
}

export function migrateGame(state: GameState): GameState {
  if (state.version === 2) return state;
  const clubs: Record<string, Club> = {};
  for (const old of Object.values(state.clubs)) {
    // the game has three leagues now: the old top league joins the 1-liga
    const c = old.tier < C.TOP_TIER ? { ...old, tier: C.TOP_TIER } : old;
    const squad = c.squad?.length ? c.squad : generateSquad(c.id, c.tier, hashSeed(state.seed, 'migrate'));
    clubs[c.id] = { ...c, squad, ratings: ratingsFromSquad(squad) };
  }
  // fill every tier up to CLUBS_PER_TIER with new clubs (ids that cannot clash with old ones)
  const fresh = Object.values(generateWorld(hashSeed(state.seed, 'migrate-world')));
  const usedNames = new Set(Object.values(clubs).map((c) => c.name));
  for (const tier of C.TIERS) {
    const have = Object.values(clubs).filter((c) => c.tier === tier).length;
    const extra = fresh.filter((c) => c.tier === tier && !usedNames.has(c.name)).slice(0, Math.max(0, C.CLUBS_PER_TIER - have));
    for (const c of extra) {
      const id = `m${c.id}`;
      const squad = generateSquad(id, tier, hashSeed(state.seed, 'migrate'));
      clubs[id] = { ...c, id, squad, ratings: ratingsFromSquad(squad) };
      usedNames.add(c.name);
    }
  }
  const seasons = state.seasons.map((x) => (x.tier < C.TOP_TIER ? { ...x, tier: C.TOP_TIER } : x));
  return { ...state, version: 2, persona: migratePersona(state.persona), clubs, seasons };
}
