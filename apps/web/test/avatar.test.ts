import { describe, expect, it } from 'vitest';
import {
  ACCESSORIES,
  BOOT_COLORS,
  BROWS,
  CELEBRATIONS,
  EYE_COLORS,
  FACIAL_HAIR,
  HAIR_COLORS,
  HAIR_STYLES,
  HEAD_SHAPES,
  NOSES,
  SKIN_TONES,
  SLEEVES,
  constants as C,
  type Appearance,
} from '@futbolchi/engine';
import { AVATAR_H, AVATAR_W, POSE_CYCLE, avatarPixels, avatarRects, headBox } from '../src/art/avatarRects';

const KIT = '#c0392b';
const base = C.DEFAULT_APPEARANCE;
const sig = (a: Appearance, pose: Parameters<typeof avatarPixels>[2] = 'stand') => avatarPixels(a, KIT, pose).join('|');

describe('pixel avatar', () => {
  it('is deterministic and stays inside the 64×96 grid', () => {
    expect(sig(base)).toBe(sig(base));
    for (const r of avatarRects(base, KIT)) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(AVATAR_W);
      expect(r.y + r.h).toBeLessThanOrEqual(AVATAR_H);
    }
  });

  it('every option visibly changes the picture', () => {
    const fields: [keyof Appearance, readonly string[]][] = [
      ['headShape', HEAD_SHAPES],
      ['skinTone', SKIN_TONES],
      ['hairStyle', HAIR_STYLES],
      ['hairColor', HAIR_COLORS],
      ['eyeColor', EYE_COLORS],
      ['brows', BROWS],
      ['nose', NOSES],
      ['facialHair', FACIAL_HAIR],
      ['boots', BOOT_COLORS],
      ['sleeves', SLEEVES],
      ['accessory', ACCESSORIES],
    ];
    for (const [field, options] of fields) {
      const seen = new Set(options.map((o) => sig({ ...base, [field]: o } as Appearance)));
      expect(seen.size, field).toBe(options.length);
    }
    // Height and weight change the body
    expect(sig({ ...base, heightCm: C.HEIGHT_MIN_CM })).not.toBe(sig({ ...base, heightCm: C.HEIGHT_MAX_CM }));
    expect(sig({ ...base, weightKg: C.WEIGHT_MIN_KG })).not.toBe(sig({ ...base, weightKg: C.WEIGHT_MAX_KG }));
  });

  it('each celebration is its own pose, all inside the grid at the extremes', () => {
    const poses = new Set(CELEBRATIONS.map((p) => sig(base, p)));
    expect(poses.size).toBe(CELEBRATIONS.length);
    expect(poses.has(sig(base))).toBe(false);
    const extremes: Appearance[] = [
      { ...base, heightCm: C.HEIGHT_MAX_CM, weightKg: C.WEIGHT_MAX_KG, hairStyle: 'afro' },
      { ...base, heightCm: C.HEIGHT_MAX_CM, hairStyle: 'mohawk' },
      { ...base, heightCm: C.HEIGHT_MIN_CM, weightKg: C.WEIGHT_MIN_KG, hairStyle: 'dreads' },
    ];
    for (const a of extremes) {
      for (const p of CELEBRATIONS) {
        const px = avatarPixels(a, KIT, p);
        // Nothing touches the top edge (room for the outline)
        expect(px.slice(0, AVATAR_W).every((c) => c === null), `${a.hairStyle} ${p}`).toBe(true);
      }
    }
  });

  it('the pose button cycles through distinct football poses that fit the grid', () => {
    expect(new Set(POSE_CYCLE).size).toBe(POSE_CYCLE.length);
    const all = new Set([sig(base), ...POSE_CYCLE.map((p) => sig(base, p))]);
    expect(all.size).toBe(POSE_CYCLE.length + 1);
    for (const a of [
      { ...base, heightCm: C.HEIGHT_MAX_CM, weightKg: C.WEIGHT_MAX_KG },
      { ...base, heightCm: C.HEIGHT_MIN_CM, weightKg: C.WEIGHT_MIN_KG },
    ]) {
      for (const p of POSE_CYCLE) {
        const px = avatarPixels(a, KIT, p);
        // Left and right columns stay empty (nothing is cut at the edges)
        for (let y = 0; y < AVATAR_H; y++) {
          expect(px[y * AVATAR_W], p).toBeNull();
          expect(px[y * AVATAR_W + AVATAR_W - 1], p).toBeNull();
        }
      }
    }
  });

  it('the bust crop stays inside the grid', () => {
    for (const h of [C.HEIGHT_MIN_CM, C.HEIGHT_MAX_CM]) {
      const b = headBox({ ...base, heightCm: h });
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(AVATAR_W);
    }
  });
});
