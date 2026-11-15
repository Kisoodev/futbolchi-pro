/**
 * NPC squads (spec section 7.2): every club has a squad of SQUAD.size players
 * — regular / good / strong by SQUAD_MIX, the captain always strong — with
 * OVRs drawn from a normal distribution inside the tier's ranges. Strong clubs
 * sit up to ±SQUAD.clubStrength above the others. The club ratings the match
 * engine uses (att / mid / def / gk) are averages of the squad.
 */
import { PROGRESSION_CONFIG as P, tierConfig } from './progression';
import { clamp, createRng, hashSeed, type Rng } from './rng';
import { npcName } from './roster';
import type { ClubRatings, NpcPlayer, NpcRole, Position, Tier } from './types';

const ROLES: NpcRole[] = ['regular', 'good', 'strong'];

/** Normal sample (Box–Muller). */
function gaussian(rng: Rng): number {
  const u = Math.max(1e-9, rng.next());
  const v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Lowest and highest OVR an NPC of this tier can have. */
export function tierOvrRange(tier: Tier): [number, number] {
  const t = tierConfig(tier);
  return [t.regular[0], t.strong[1]];
}

/** An OVR in a role's range, centred (normal), shifted by the club's strength, kept inside the tier. */
function rollOvr(rng: Rng, tier: Tier, role: NpcRole, strength: number): number {
  const [lo, hi] = tierConfig(tier)[role];
  const mid = (lo + hi) / 2;
  const v = clamp(mid + gaussian(rng) * ((hi - lo) / 4), lo, hi) + strength;
  const [tlo, thi] = tierOvrRange(tier);
  return Math.round(clamp(v, tlo, thi));
}

/** How many players of each role a squad has (strong ≥ 1: the captain). */
export function squadCounts(size: number = P.SQUAD.size): Record<NpcRole, number> {
  const strong = Math.max(1, Math.round(size * P.SQUAD_MIX.strong));
  const good = Math.round(size * P.SQUAD_MIX.good);
  return { strong, good, regular: size - strong - good };
}

export function generateSquad(clubId: string, tier: Tier, seed: number): NpcPlayer[] {
  const rng = createRng(hashSeed(seed, 'squad', clubId));
  const strength = Math.round(rng.range(-P.SQUAD.clubStrength, P.SQUAD.clubStrength));
  const counts = squadCounts();
  const roles: NpcRole[] = rng.shuffle([
    ...Array<NpcRole>(counts.strong).fill('strong'),
    ...Array<NpcRole>(counts.good).fill('good'),
    ...Array<NpcRole>(counts.regular).fill('regular'),
  ]);
  const sideCount: Partial<Record<Position, number>> = {};
  const squad: NpcPlayer[] = P.SQUAD.positions.map((position, i) => ({
    id: `${clubId}-p${i + 1}`,
    name: npcName(`${clubId}-p${i + 1}`, seed),
    position,
    // wingers and full-backs alternate sides
    side: position === 'W' || position === 'FB' ? ((sideCount[position] = (sideCount[position] ?? 0) + 1) % 2 ? 'R' : 'L') : undefined,
    role: roles[i],
    ovr: rollOvr(rng, tier, roles[i], strength),
    captain: false,
  }));
  // the captain: the strongest of the strong
  const cap = squad.filter((p) => p.role === 'strong').sort((a, b) => b.ovr - a.ovr)[0];
  cap.captain = true;
  return squad;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const LINES: Record<keyof ClubRatings, Position[]> = {
  att: ['ST', 'W', 'CAM'],
  mid: ['CM', 'CDM', 'CAM'],
  def: ['CB', 'FB', 'CDM'],
  gk: ['GK'],
};

/** Club ratings for the match engine, from the squad's lines. */
export function ratingsFromSquad(squad: NpcPlayer[]): ClubRatings {
  const line = (k: keyof ClubRatings) => Math.round(avg(squad.filter((p) => LINES[k].includes(p.position)).map((p) => p.ovr)));
  return { att: line('att'), mid: line('mid'), def: line('def'), gk: line('gk') };
}

export const squadAvg = (squad: NpcPlayer[]): number => avg(squad.map((p) => p.ovr));
export const captainOf = (squad: NpcPlayer[]): NpcPlayer | undefined => squad.find((p) => p.captain) ?? squad[0];

/** End of season: each NPC changes by −2…+3 and stays inside the (possibly new) tier's range. */
export function driftSquad(squad: NpcPlayer[], tier: Tier, seed: number): NpcPlayer[] {
  const rng = createRng(seed);
  const [lo, hi] = tierOvrRange(tier);
  const [dmin, dmax] = P.SQUAD.seasonDrift;
  // Odil may stay above the tier's usual top (teamGrowth.ts)
  return squad.map((p) => ({ ...p, ovr: clamp(p.ovr + rng.int(dmin, dmax), lo, p.characterKey === 'odil' ? Math.max(hi, p.ovr) : hi) }));
}

export { ROLES as NPC_ROLES };
