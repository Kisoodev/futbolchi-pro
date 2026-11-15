/**
 * The academy team from docs/CHARACTERS.md (the characters bible): the people
 * players meet in the videos, with their positions, OVRs and looks. The
 * persona's first club plays with this squad.
 *
 * Every other NPC gets a name from NAME_POOL (fictional first names with an
 * initial), so match events can always say who did what.
 */
import { DEFAULT_APPEARANCE } from './constants';
import { PROGRESSION_CONFIG } from './progression';
import { createRng, hashSeed } from './rng';
import type { Appearance, NpcPlayer, NpcRole, Position } from './types';

export type CharacterKey =
  | 'odil'
  | 'abu'
  | 'sardor'
  | 'temur'
  | 'jasur'
  | 'bekzod'
  | 'islom'
  | 'doniyor'
  | 'shohruh'
  | 'farrux'
  | 'ulugbek'
  | 'azizbek'
  | 'otabek'
  | 'nodir'
  | 'javlon';

export interface RosterEntry {
  key: CharacterKey;
  name: string;
  position: Position;
  /** For wingers and full-backs: the side they play on. */
  side?: 'L' | 'R';
  ovr: number;
  captain?: boolean;
  /** Always in the starting XI when fit (with the persona). */
  core?: boolean;
  look: Partial<Appearance>;
}

/** docs/CHARACTERS.md §1–2. */
export const ACADEMY_ROSTER: RosterEntry[] = [
  {
    key: 'odil', name: 'Odil', position: 'W', side: 'R', ovr: 62, core: true,
    look: { headShape: 'square', skinTone: 'light', hairStyle: 'undercut', hairColor: 'brown', eyeColor: 'brown', brows: 'normal', nose: 'small', heightCm: 186, weightKg: 80, boots: 'orange', accessory: 'wristbands' },
  },
  {
    key: 'abu', name: 'Abu', position: 'GK', ovr: 54, core: true,
    look: { headShape: 'round', skinTone: 'medium', hairStyle: 'curly', hairColor: 'black', eyeColor: 'dark', brows: 'thin', heightCm: 174, weightKg: 82, sleeves: 'long', boots: 'black' },
  },
  { key: 'sardor', name: 'Sardor', position: 'CB', ovr: 61, captain: true, look: { headShape: 'square', hairStyle: 'buzz', heightCm: 194, weightKg: 88, brows: 'thick' } },
  { key: 'temur', name: 'Temur', position: 'GK', ovr: 59, look: { headShape: 'oval', hairStyle: 'short', heightCm: 192, weightKg: 76, facialHair: 'stubble' } },
  { key: 'jasur', name: 'Jasur', position: 'CB', ovr: 58, look: { headShape: 'round', hairStyle: 'buzz', heightCm: 170, weightKg: 82, nose: 'large' } },
  { key: 'bekzod', name: 'Bekzod', position: 'FB', side: 'R', ovr: 57, look: { headShape: 'oval', hairStyle: 'sidepart', heightCm: 176, weightKg: 64 } },
  { key: 'islom', name: 'Islom', position: 'FB', side: 'L', ovr: 58, look: { headShape: 'oval', hairStyle: 'spiky', hairColor: 'blonde', heightCm: 178, weightKg: 70 } },
  { key: 'doniyor', name: 'Doniyor', position: 'CDM', ovr: 59, look: { headShape: 'square', hairStyle: 'short', brows: 'thick', accessory: 'headband', heightCm: 180, weightKg: 80 } },
  { key: 'shohruh', name: 'Shohruh', position: 'CM', ovr: 60, look: { headShape: 'oval', hairStyle: 'curly', hairColor: 'chestnut', heightCm: 177, weightKg: 70 } },
  { key: 'farrux', name: 'Farrux', position: 'CM', ovr: 56, look: { headShape: 'round', hairStyle: 'short', heightCm: 166, weightKg: 62 } },
  { key: 'ulugbek', name: "Ulug'bek", position: 'CAM', ovr: 58, look: { headShape: 'oval', hairStyle: 'long', heightCm: 179, weightKg: 66, accessory: 'wristbands' } },
  { key: 'azizbek', name: 'Azizbek', position: 'W', side: 'L', ovr: 57, look: { headShape: 'oval', hairStyle: 'short', heightCm: 176, weightKg: 68 } },
  { key: 'otabek', name: 'Otabek', position: 'ST', ovr: 60, look: { headShape: 'square', hairStyle: 'short', facialHair: 'beard', heightCm: 190, weightKg: 86 } },
  { key: 'nodir', name: 'Nodir', position: 'ST', ovr: 55, look: { headShape: 'round', hairStyle: 'buzz', heightCm: 168, weightKg: 62 } },
  { key: 'javlon', name: 'Javlon', position: 'CB', ovr: 55, look: { headShape: 'oval', hairStyle: 'short', heightCm: 178, weightKg: 72 } },
];

/** The full look of a bible character (unset fields from the default). */
export const rosterLook = (key: CharacterKey): Appearance => ({ ...DEFAULT_APPEARANCE, ...ACADEMY_ROSTER.find((r) => r.key === key)!.look });

/** Invented first names for the other NPCs (common, not tied to any real player). */
export const NAME_POOL = [
  'Akmal', 'Bobur', 'Dilshod', 'Eldor', 'Farhod', "G'ayrat", 'Hasan', 'Ilhom', 'Jamshid', 'Kamol', 'Laziz', 'Mansur',
  'Nurbek', 'Olim', 'Sanjar', 'Tohir', 'Umid', 'Vali', 'Xurshid', 'Yusuf', 'Zafar', 'Asad', 'Behruz', 'Davron',
  'Ergash', 'Husan', 'Ixtiyor', 'Komil', 'Muhammad', 'Oybek', "Po'lat", 'Rasul', 'Shavkat', 'Ulmas', 'Yorqin', 'Zokir',
  'Anvar', 'Botir', 'Diyor', 'Elyor', 'Fazliddin', 'Hamid', 'Inom', 'Jahongir', 'Kamron', 'Lochin', 'Mirjalol', 'Nuriddin',
];
const INITIALS = 'ABDEFGHIJKLMNORSTUXYZ';

/** A deterministic name for an NPC (first name + initial). */
export function npcName(id: string, seed: number): string {
  const rng = createRng(hashSeed(seed, 'name', id));
  return `${rng.pick(NAME_POOL)} ${INITIALS[rng.int(0, INITIALS.length - 1)]}.`;
}

const roleOf = (ovr: number): NpcRole => (ovr >= 60 ? 'strong' : ovr >= 57 ? 'good' : 'regular');

/**
 * The academy club's squad: the 15 named characters, plus nameless-in-the-bible
 * squad players to reach `size` (they get pool names).
 */
export function academySquad(clubId: string, seed: number, fill: NpcPlayer[]): NpcPlayer[] {
  const named: NpcPlayer[] = ACADEMY_ROSTER.map((r) => ({
    id: `${clubId}-${r.key}`,
    name: r.name,
    position: r.position,
    side: r.side,
    role: r.captain ? 'strong' : roleOf(r.ovr),
    ovr: r.ovr,
    captain: !!r.captain,
    characterKey: r.key,
  }));
  // fill the positions the named squad is short of (see SQUAD.positions) with generated players
  const need = new Map<Position, number>();
  for (const pos of PROGRESSION_CONFIG.SQUAD.positions) need.set(pos, (need.get(pos) ?? 0) + 1);
  for (const n of named) need.set(n.position, (need.get(n.position) ?? 0) - 1);
  const extra: NpcPlayer[] = [];
  for (const p of fill) {
    const left = need.get(p.position) ?? 0;
    if (left > 0) {
      // the bible's unnamed squad players are ordinary: nobody outshines its characters
      extra.push({ ...p, captain: false, role: 'regular', ovr: Math.max(55, Math.min(p.ovr, 57)) });
      need.set(p.position, left - 1);
    }
  }
  return [...named, ...extra];
}

export const hasAcademyRoster = (squad: NpcPlayer[] | undefined) => !!squad?.some((p) => p.characterKey === 'odil');
