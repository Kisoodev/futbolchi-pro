/**
 * Match players: the six attributes of PROGRESSION_SYSTEM (pace … physical)
 * mapped to the engine's codes (PAC SHO PAS DRI DEF PHY), the derived ones
 * (VIS COM STA HEA, §3) and goalkeeper attributes.
 *
 * NPCs only have an OVR and a position, so their attributes come from a
 * position profile (a striker shoots better than he defends…), shifted so the
 * weighted OVR matches, plus a small personal variation. Characters of
 * docs/CHARACTERS.md get their described strengths (Odil is fast and tricky
 * but lazy defending, Abu has good reflexes but weak hands…).
 */
import { PROGRESSION_CONFIG } from '../progression';
import { clamp, createRng, hashSeed } from '../rng';
import type { LineupPlayer, Position, SlotId, Stats } from '../types';

export interface Attrs {
  PAC: number;
  SHO: number;
  PAS: number;
  DRI: number;
  DEF: number;
  PHY: number;
  VIS: number;
  COM: number;
  STA: number;
  HEA: number;
  GK_REF: number;
  GK_HAN: number;
  GK_POS: number;
  GK_KIC: number;
}

export interface SimPlayer {
  id: string;
  name: string;
  position: Position;
  slot: SlotId;
  ovr: number;
  attrs: Attrs;
  persona: boolean;
  characterKey?: string;
}

type Six = Pick<Attrs, 'PAC' | 'SHO' | 'PAS' | 'DRI' | 'DEF' | 'PHY'>;

/** Position profiles: how far each attribute sits from the OVR. */
const PROFILE: Record<Position, Six> = {
  ST: { PAC: 3, SHO: 7, PAS: -4, DRI: 3, DEF: -18, PHY: 3 },
  W: { PAC: 7, SHO: 1, PAS: -1, DRI: 6, DEF: -16, PHY: -5 },
  CAM: { PAC: 0, SHO: 2, PAS: 6, DRI: 5, DEF: -12, PHY: -6 },
  CM: { PAC: -2, SHO: -3, PAS: 6, DRI: 2, DEF: -1, PHY: 1 },
  CDM: { PAC: -3, SHO: -8, PAS: 2, DRI: -4, DEF: 6, PHY: 5 },
  FB: { PAC: 6, SHO: -10, PAS: -1, DRI: -2, DEF: 4, PHY: 1 },
  CB: { PAC: -4, SHO: -14, PAS: -5, DRI: -8, DEF: 7, PHY: 7 },
  GK: { PAC: -15, SHO: -25, PAS: -8, DRI: -20, DEF: -10, PHY: 0 },
};

/** Characters' strengths and weaknesses (docs/CHARACTERS.md). */
const CHARACTER: Record<string, Partial<Attrs>> = {
  odil: { PAC: 6, DRI: 6, DEF: -8, COM: 4 },
  abu: { GK_REF: 5, GK_HAN: -6, PHY: -6 },
  sardor: { DEF: 3, PHY: 4, COM: 4 },
  temur: { GK_POS: 3 },
  jasur: { PHY: 4, DEF: 1, COM: -6 },
  bekzod: { COM: 3 },
  islom: { PAC: 2 },
  doniyor: { PHY: 3, DEF: 2 },
  shohruh: { PAS: 4, VIS: 6 },
  farrux: { PAC: 3 },
  ulugbek: { DRI: 3, VIS: 4, STA: -8 },
  azizbek: { COM: -4 },
  otabek: { PHY: 5, SHO: 3, HEA: 4 },
  nodir: { PAC: 4, PHY: -4 },
};

const KEYS: (keyof Six)[] = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'];
const STAT_OF: Record<keyof Six, keyof Stats> = { PAC: 'pace', SHO: 'shooting', PAS: 'passing', DRI: 'dribbling', DEF: 'defending', PHY: 'physical' };

const weightedOvr = (six: Six, position: Position) => {
  const w = PROGRESSION_CONFIG.WEIGHTS[position];
  return KEYS.reduce((sum, k) => sum + six[k] * w[STAT_OF[k]], 0);
};

/** Derived and goalkeeper attributes (§3: computed when the game has none). */
function complete(six: Six, ovr: number, position: Position, extra: Partial<Attrs> = {}): Attrs {
  const a: Attrs = {
    ...six,
    VIS: 0.7 * six.PAS + 0.3 * six.DRI,
    COM: 0.5 * six.DRI + 0.3 * six.PAS + 0.2 * ovr,
    STA: six.PHY,
    HEA: 0.6 * six.PHY + 0.4 * six.SHO,
    GK_REF: position === 'GK' ? ovr + 3 : 25,
    GK_HAN: position === 'GK' ? ovr : 25,
    GK_POS: position === 'GK' ? ovr + 1 : 25,
    GK_KIC: position === 'GK' ? ovr - 6 : 25,
  };
  for (const [k, v] of Object.entries(extra)) (a as unknown as Record<string, number>)[k] += v ?? 0;
  for (const k of Object.keys(a) as (keyof Attrs)[]) a[k] = clamp(a[k], 1, 99);
  return a;
}

/** Attributes of an NPC from its OVR, position and (if any) character. */
export function npcAttrs(id: string, ovr: number, position: Position, characterKey?: string): Attrs {
  const rng = createRng(hashSeed(0x5eed, 'attrs', id));
  const six = {} as Six;
  for (const k of KEYS) six[k] = ovr + PROFILE[position][k] + rng.range(-3, 3);
  // shift so the weighted OVR matches the player's OVR
  const shift = ovr - weightedOvr(six, position);
  for (const k of KEYS) six[k] += shift;
  return complete(six, ovr, position, characterKey ? CHARACTER[characterKey] : undefined);
}

/** The persona's attributes are their real stats (a goalkeeper's keeping skills come from defending/physical). */
export function personaAttrs(stats: Stats, ovr: number, position: Position): Attrs {
  const six: Six = { PAC: stats.pace, SHO: stats.shooting, PAS: stats.passing, DRI: stats.dribbling, DEF: stats.defending, PHY: stats.physical };
  const a = complete(six, ovr, position);
  if (position === 'GK') {
    a.GK_REF = clamp(0.6 * stats.defending + 0.4 * stats.physical, 1, 99);
    a.GK_HAN = clamp(0.7 * stats.defending + 0.3 * stats.passing, 1, 99);
    a.GK_POS = clamp(0.5 * stats.defending + 0.5 * stats.physical, 1, 99);
    a.GK_KIC = clamp(0.8 * stats.passing + 0.2 * stats.physical, 1, 99);
  }
  return a;
}

export function toSimPlayer(p: LineupPlayer, personaStats?: Stats): SimPlayer {
  return {
    id: p.id,
    name: p.name,
    position: p.position,
    slot: p.slot ?? 'CM',
    ovr: p.ovr,
    persona: !!p.persona,
    characterKey: p.characterKey,
    attrs: p.persona && personaStats ? personaAttrs(personaStats, p.ovr, p.position) : npcAttrs(p.id, p.ovr, p.position, p.characterKey),
  };
}
