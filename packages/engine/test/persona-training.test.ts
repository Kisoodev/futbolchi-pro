import { describe, expect, it } from 'vitest';
import {
  applyTrainingDay,
  createPersona,
  offerTraining,
  personaLevel,
  personaView,
  startStats,
  normalizeAppearance,
  validatePersonaInput,
  weeklyRecovery,
  POSITIONS,
  type Persona,
} from '../src';
import * as C from '../src/constants';

const make = (over: Partial<Parameters<typeof createPersona>[0]> = {}): Persona =>
  createPersona({ id: 'p1', name: 'Aziz', position: 'ST', bonus: {}, seed: 7, clubId: 'c1', ...over });

describe('persona creation', () => {
  it('every position starts at OVR 52 (rounded down)', () => {
    for (const pos of POSITIONS) expect(personaLevel({ stats: startStats(pos), position: pos })).toBe(52);
  });

  it('position weights sum to 1', () => {
    for (const pos of POSITIONS) {
      const sum = Object.values(C.POSITION_WEIGHTS[pos]).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 6);
    }
  });

  it('applies bonus points and validates limits', () => {
    const p = make({ bonus: { shooting: 5, pace: 5 } });
    expect(p.stats.shooting).toBe(startStats('ST').shooting + 5);
    expect(validatePersonaInput({ name: 'Aziz', position: 'ST', bonus: { shooting: 6 } })).toBe('bonus_per_stat');
    expect(validatePersonaInput({ name: 'Aziz', position: 'ST', bonus: { passing: 5, defending: 5, physical: 3 } })).toBe('bonus_total');
    expect(validatePersonaInput({ name: 'A', position: 'ST', bonus: {} })).toBe('name_length');
    expect(validatePersonaInput({ name: 'Aziz', position: 'ST', bonus: { pace: -1 } })).toBe('bonus_negative');
    expect(() => make({ name: ' ' })).toThrow();
  });

  it('stores a valid appearance and rejects invalid ones', () => {
    expect(make().appearance).toEqual(C.DEFAULT_APPEARANCE);
    const custom = { ...C.DEFAULT_APPEARANCE, hairStyle: 'curly' as const, heightCm: 191, weightKg: 84, foot: 'left' as const };
    expect(make({ appearance: custom }).appearance).toEqual(custom);
    const bad = (over: object) => validatePersonaInput({ name: 'Aziz', position: 'ST', bonus: {}, appearance: { ...C.DEFAULT_APPEARANCE, ...over } as never });
    expect(bad({ heightCm: 230 })).toBe('bad_appearance');
    expect(bad({ weightKg: 54.5 })).toBe('bad_appearance');
    expect(bad({ hairStyle: 'pompadour' })).toBe('bad_appearance');
    expect(bad({ facialHair: 'sideburns' })).toBe('bad_appearance');
    expect(bad({ celebration: 'backflip' })).toBe('bad_appearance');
    expect(bad({ boots: 'green' })).toBe('bad_appearance');
    expect(bad({ eyeColor: undefined })).toBe('bad_appearance');
    expect(bad({})).toBeNull();
  });

  it('keeps the look consistent with the gender', () => {
    const bad = (over: object) => validatePersonaInput({ name: 'Malika', position: 'W', bonus: {}, appearance: { ...C.DEFAULT_APPEARANCE, ...over } as never });
    expect(bad({ gender: 'female', hairStyle: 'ponytail' })).toBeNull();
    expect(bad({ gender: 'female', hairStyle: 'braid', facialHair: 'beard' })).toBe('bad_appearance');
    expect(bad({ gender: 'female', hairStyle: 'dreads' })).toBe('bad_appearance');
    expect(bad({ gender: 'male', hairStyle: 'bun' })).toBe('bad_appearance');
    expect(bad({ gender: 'other' })).toBe('bad_appearance');
    // a girl's saved look survives normalisation; old saves without a gender become boys
    const girl = { ...C.DEFAULT_APPEARANCE, gender: 'female' as const, hairStyle: 'ponytail' as const };
    expect(normalizeAppearance(girl)).toEqual(girl);
    const { gender: _drop, ...old } = C.DEFAULT_APPEARANCE;
    expect(normalizeAppearance(old as never).gender).toBe('male');
  });

  it('fills old or broken appearances with defaults, keeping valid fields', () => {
    expect(normalizeAppearance(undefined)).toEqual(C.DEFAULT_APPEARANCE);
    const old = { headShape: 'oval', skinTone: 'dark', hairStyle: 'curly', hairColor: 'red', heightCm: 190, weightKg: 80, foot: 'left' };
    const n = normalizeAppearance(old as never);
    expect(n).toMatchObject(old);
    expect(n.facialHair).toBe(C.DEFAULT_APPEARANCE.facialHair);
    expect(normalizeAppearance({ hairStyle: 'nope', heightCm: 999 } as never)).toEqual(C.DEFAULT_APPEARANCE);
  });

  it('appearance does not change stats', () => {
    const a = make();
    const b = make({ appearance: { ...C.DEFAULT_APPEARANCE, heightCm: 200, weightKg: 100 } });
    expect(b.stats).toEqual(a.stats);
  });

  it('a new persona has an empty XP bank and no hidden potential', () => {
    expect(make().xp).toBe(0);
    expect('potential' in personaView(make())).toBe(false);
  });
});

describe('training', () => {
  it('offers 3 distinct options deterministically', () => {
    const p = make();
    const a = offerTraining(p, 99);
    expect(a).toHaveLength(C.TRAINING_OFFER_SIZE);
    expect(new Set(a).size).toBe(C.TRAINING_OFFER_SIZE);
    expect(offerTraining(p, 99)).toEqual(a);
  });

  it('always offers rest when tired or injured', () => {
    for (let s = 0; s < 50; s++) {
      expect(offerTraining({ ...make(), fatigue: 65 }, s)).toContain('rest');
      expect(offerTraining({ ...make(), injuryWeeksLeft: 1 }, s)).toContain('rest');
    }
  });

  it('the training day itself only changes fatigue and the injury risk (growth comes from XP)', () => {
    const p = make();
    const r = applyTrainingDay(p, 'gym');
    expect(r.persona.stats).toEqual(p.stats);
    expect(r.persona.fatigue).toBeGreaterThan(0);
    expect(r.injuryRiskBonus).toBeGreaterThan(0);
  });

  it('rest reduces fatigue, never below zero', () => {
    const r = applyTrainingDay({ ...make(), fatigue: 20 }, 'rest');
    expect(r.persona.fatigue).toBe(0);
  });

  it('weekly recovery lowers fatigue and heals injuries', () => {
    const p = weeklyRecovery({ ...make(), fatigue: 50, injuryWeeksLeft: 2 });
    expect(p.fatigue).toBe(15);
    expect(p.injuryWeeksLeft).toBe(1);
  });
});
