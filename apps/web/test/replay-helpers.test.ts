import { describe, expect, it } from 'vitest';
import type { Match, MatchEvent, PersonaMatchStats } from '@futbolchi/engine';
import { emptyPersonaStats } from '@futbolchi/engine';
import { personaWindow } from '../src/replay/timeline';
import { DARK_KIT, LIGHT_KIT, MIN_KIT_DISTANCE, isGrassLike, kitColors, kitStroke } from '../src/replay/kits';

const ev = (minute: number, over: Partial<MatchEvent>): MatchEvent => ({
  id: `e${minute}`,
  minute,
  type: 'keyChance',
  team: 'home',
  actor: 'persona',
  path: [{ x: 50, y: 50 }],
  highlight: false,
  ...over,
});

const match = (stats: Partial<PersonaMatchStats>, events: MatchEvent[]): Match => ({
  id: 'm',
  seasonId: 's1',
  week: 1,
  seed: 1,
  homeId: 'a',
  awayId: 'b',
  score: [0, 0],
  personaSide: 'home',
  personaStats: { ...emptyPersonaStats('start'), minutes: 90, ...stats },
  events,
});

describe('personaWindow', () => {
  it('null when the persona did not play', () => {
    expect(personaWindow(match({ role: 'bench', minutes: 0 }, []))).toBeNull();
  });
  it('starter plays the full match', () => {
    expect(personaWindow(match({}, [ev(30, {})]))).toEqual({ from: 0, to: 90 });
  });
  it('substitute appears only from the minute they come on', () => {
    const m = match({ role: 'sub', minutes: 22 }, [ev(68, { type: 'substitution', detail: { personaIn: true } })]);
    expect(personaWindow(m)).toEqual({ from: 68, to: 90 });
  });
  it('injury sub-off and red card end the window', () => {
    expect(personaWindow(match({ minutes: 40 }, [ev(40, { type: 'substitution', detail: { personaIn: false } })]))).toEqual({ from: 0, to: 40 });
    expect(personaWindow(match({ minutes: 55 }, [ev(55, { type: 'card', detail: { card: 'red' } })]))).toEqual({ from: 0, to: 55 });
  });
});

describe('kit colours', () => {
  it('detects grass-like greens and teals, not blues or reds', () => {
    expect(isGrassLike('#2e9e5b')).toBe(true);
    expect(isGrassLike('#1fa3a3')).toBe(true);
    expect(isGrassLike('#2f6fd6')).toBe(false);
    expect(isGrassLike('#d94848')).toBe(false);
    expect(isGrassLike('#4a5568')).toBe(false); // grey, low saturation
  });
  it('replaces a green kit with a light kit', () => {
    expect(kitColors('#d94848', '#2e9e5b')).toEqual({ home: '#d94848', away: LIGHT_KIT });
  });
  it('separates two similar kits', () => {
    const k = kitColors('#2f6fd6', '#2b4c7e');
    expect(k.home).toBe('#2f6fd6');
    expect(k.away).toBe(LIGHT_KIT);
    const both = kitColors('#2e9e5b', '#5b8c2a'); // both green → both light → away goes dark
    expect(both).toEqual({ home: LIGHT_KIT, away: DARK_KIT });
  });
  it('keeps distinct kits unchanged', () => {
    expect(kitColors('#d94848', '#2f6fd6')).toEqual({ home: '#d94848', away: '#2f6fd6' });
    expect(MIN_KIT_DISTANCE).toBeGreaterThan(0);
  });
  it('outline contrasts with the kit', () => {
    expect(kitStroke(LIGHT_KIT)).toBe(DARK_KIT);
    expect(kitStroke('#111827')).toBe('#ffffff');
  });
});
