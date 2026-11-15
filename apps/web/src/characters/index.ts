/**
 * The game's story characters in one registry. The intro film, the in-game
 * coach and any future storyline (a rival, an agent, a captain…) all take
 * their sprites, names and colours from here.
 *
 * Adding a character: write a painter in painters.ts (64×128 grid, feet on
 * row 122), then add an entry below with its names in all three languages.
 */
import { lang, type Lang } from '../i18n';
import { paintFather, paintMother, type Painter } from './painters';
import { paintCoachMatch, paintCoachTraining } from './coach';

/** coach = training tracksuit; coachMatch = match-day puffer (the same man). */
export type CharacterId = 'dad' | 'mom' | 'coach' | 'coachMatch';

export interface Character {
  id: CharacterId;
  /** Full name (for introductions). */
  fullName: Record<Lang, string>;
  /** Short label shown above speech (Dada, Oyi, Ustoz…). */
  label: Record<Lang, string>;
  /** Accent colour for the speaker label. */
  color: string;
  painter: Painter;
  /** Sprite resolution: 1 = 64×128, 2 = 128×256 (finer detail, same size on screen). */
  res?: number;
  /** Face area in sprite pixels (at its resolution), for round portraits. */
  face: { x: number; y: number; size: number };
}

export const CHARACTERS: Record<CharacterId, Character> = {
  dad: {
    id: 'dad',
    fullName: { uz: 'Dada', en: 'Dad', ru: 'Папа' },
    label: { uz: 'Dada', en: 'Dad', ru: 'Папа' },
    color: '#8fc1ff',
    painter: paintFather,
    face: { x: 16, y: 10, size: 32 },
  },
  mom: {
    id: 'mom',
    fullName: { uz: 'Oyi', en: 'Mum', ru: 'Мама' },
    label: { uz: 'Oyi', en: 'Mum', ru: 'Мама' },
    color: '#ffb3c1',
    painter: paintMother,
    face: { x: 16, y: 20, size: 32 },
  },
  coach: {
    id: 'coach',
    fullName: { uz: 'Usmoxan Kapadze', en: 'Usmoxan Kapadze', ru: 'Усмохан Кападзе' },
    label: { uz: 'Kapadze', en: 'Kapadze', ru: 'Кападзе' },
    color: '#9cc2ea',
    painter: paintCoachTraining,
    res: 2,
    face: { x: 38, y: 24, size: 52 },
  },
  coachMatch: {
    id: 'coachMatch',
    fullName: { uz: 'Usmoxan Kapadze', en: 'Usmoxan Kapadze', ru: 'Усмохан Кападзе' },
    label: { uz: 'Kapadze', en: 'Kapadze', ru: 'Кападзе' },
    color: '#9cc2ea',
    painter: paintCoachMatch,
    res: 2,
    face: { x: 40, y: 24, size: 52 },
  },
};

const cache = new Map<CharacterId, HTMLCanvasElement>();

/** The character's sprite (64×128, or 128×256 for res 2), drawn once. */
export function characterSprite(id: CharacterId): HTMLCanvasElement {
  let c = cache.get(id);
  if (!c) {
    c = document.createElement('canvas');
    const res = CHARACTERS[id].res ?? 1;
    c.width = 64 * res;
    c.height = 128 * res;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    CHARACTERS[id].painter(ctx);
    cache.set(id, c);
  }
  return c;
}

export const characterLabel = (id: CharacterId) => CHARACTERS[id].label[lang];
export const characterName = (id: CharacterId) => CHARACTERS[id].fullName[lang];
