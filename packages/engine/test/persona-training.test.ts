import { describe, expect, it } from 'vitest';
import {
  applyMatchXp,
  applyTraining,
  computeOvr,
  createPersona,
  growthRoom,
  offerTraining,
  personaOvr,
  personaView,
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
  it('every position template starts near OVR 40', () => {
    for (const pos of POSITIONS) {
      const ovr = computeOvr(C.STAT_TEMPLATES[pos], pos);
      expect(ovr).toBeGreaterThan(38);
      expect(ovr).toBeLessThan(42);
    }
  });

  it('position weights sum to 1', () => {
    for (const pos of POSITIONS) {
      const sum = Object.values(C.POSITION_WEIGHTS[pos]).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 6);
    }
  });

  it('applies bonus points and validates limits', () => {
    const p = make({ bonus: { shooting: 5, pace: 5 } });
    expect(p.stats.shooting).toBe(C.STAT_TEMPLATES.ST.shooting + 5);
    expect(validatePersonaInput({ name: 'Aziz', position: 'ST', bonus: { shooting: 6 } })).toBe('bonus_per_stat');
    expect(validatePersonaInput({ name: 'Aziz', position: 'ST', bonus: { shooting: 5, pace: 5, passing: 1 } })).toBe('bonus_total');
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

  it('fills old or broken appearances with defaults, keeping valid fields', () => {
    expect(normalizeAppearance(undefined)).toEqual(C.DEFAULT_APPEARANCE);
    const old = { headShape: 'oval', skinTone: 'dark', hairStyle: 'curly', hairColor: 'red', heightCm: 190, weightKg: 80, foot: 'left' };
    const n = normalizeAppearance(old as never);
    expect(n).toMatchObject(old);
    expect(n.facialHair).toBe(C.DEFAULT_APPEARANCE.facialHair);
    expect(normalizeAppearance({ hairStyle: 'nope', heightCm: 999 } as never)).toEqual(C.DEFAULT_APPEARANCE);
  });

  it('appearance does not change stats or potential', () => {
    const a = make();
    const b = make({ appearance: { ...C.DEFAULT_APPEARANCE, heightCm: 200, weightKg: 100 } });
    expect(b.stats).toEqual(a.stats);
    expect(b.potential).toBe(a.potential);
  });

  it('potential is deterministic, hidden in the view, and within range', () => {
    expect(make().potential).toBe(make().potential);
    const pots = Array.from({ length: 500 }, (_, i) => make({ seed: i }).potential);
    expect(Math.min(...pots)).toBeGreaterThanOrEqual(C.POTENTIAL_MIN);
    expect(Math.max(...pots)).toBeLessThanOrEqual(C.POTENTIAL_MAX);
    const avg = pots.reduce((a, b) => a + b, 0) / pots.length;
    expect(avg).toBeGreaterThan(72);
    expect(avg).toBeLessThan(79);
    expect('potential' in personaView(make())).toBe(false);
  });
});

describe('training', () => {
  it('offers 3 distinct options deterministically', () => {
    const p = make();
    const a = offerTraining(p, 99);
    expect(a).toHaveLength(3);
    expect(new Set(a).size).toBe(3);
    expect(offerTraining(p, 99)).toEqual(a);
  });

  it('always offers rest when tired or injured', () => {
    for (let s = 0; s < 50; s++) {
      expect(offerTraining({ ...make(), fatigue: 65 }, s)).toContain('rest');
      expect(offerTraining({ ...make(), injuryWeeksLeft: 1 }, s)).toContain('rest');
    }
  });

  it('shooting training raises shooting and adds fatigue', () => {
    const p = make();
    const r = applyTraining(p, 'shooting');
    expect(r.persona.stats.shooting).toBeGreaterThan(p.stats.shooting);
    expect(r.persona.fatigue).toBe(15);
    expect(r.injuryRiskBonus).toBe(0);
  });

  it('gym raises physical and injury risk; tactical lowers pace', () => {
    const p = make();
    const gym = applyTraining(p, 'gym');
    expect(gym.persona.stats.physical).toBeGreaterThan(p.stats.physical);
    expect(gym.injuryRiskBonus).toBeGreaterThan(0);
    const tac = applyTraining(p, 'tactical');
    expect(tac.persona.stats.mentality).toBeGreaterThan(p.stats.mentality);
    expect(tac.persona.stats.pace).toBeCloseTo(p.stats.pace - 0.2, 6);
  });

  it('rest reduces fatigue, never below zero', () => {
    const r = applyTraining({ ...make(), fatigue: 20 }, 'rest');
    expect(r.persona.fatigue).toBe(0);
  });

  it('position-relevant stats grow faster', () => {
    const st = make();
    const stShoot = applyTraining(st, 'shooting').deltas.shooting!;
    const cb = make({ position: 'CB' });
    const cbShoot = applyTraining(cb, 'shooting').deltas.shooting!;
    expect(stShoot).toBeGreaterThan(cbShoot);
  });

  it('injured persona gets no gains from training', () => {
    const p = { ...make(), injuryWeeksLeft: 2 };
    expect(applyTraining(p, 'shooting').persona.stats).toEqual(p.stats);
  });

  it('growth stops at hidden potential', () => {
    let p: Persona = { ...make(), potential: 45 };
    for (let i = 0; i < 2000; i++) p = applyMatchXp(applyTraining(p, i % 2 ? 'shooting' : 'speed').persona);
    expect(growthRoom(p)).toBeLessThan(0.05);
    expect(personaOvr(p)).toBeLessThanOrEqual(45.01);
  });

  it('weekly recovery lowers fatigue and heals injuries', () => {
    const p = weeklyRecovery({ ...make(), fatigue: 50, injuryWeeksLeft: 2 });
    expect(p.fatigue).toBe(15);
    expect(p.injuryWeeksLeft).toBe(1);
  });
});
