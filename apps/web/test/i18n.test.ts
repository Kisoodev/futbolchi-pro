import { describe, expect, it } from 'vitest';
import { uz } from '../src/i18n/uz';
import { en } from '../src/i18n/en';
import { ru } from '../src/i18n/ru';

type Leaf = { path: string; value: string };

/** Flattens a dictionary; functions are called with sample arguments. */
function leaves(obj: unknown, path = ''): Leaf[] {
  if (typeof obj === 'string') return [{ path, value: obj }];
  if (typeof obj === 'function') {
    const args = Array.from({ length: obj.length }, (_, i) => (i % 2 ? 3 : 'Aziz'));
    const out = (obj as (...a: unknown[]) => unknown)(...args);
    return typeof out === 'string' ? [{ path: `${path}()`, value: out }] : leaves(out, path);
  }
  if (obj && typeof obj === 'object') return Object.entries(obj).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [];
}

const keysOf = (o: object) => leaves(o).map((l) => l.path).sort();

/** Same in every language on purpose (brand, symbols, codes). */
const SAME_EVERYWHERE = new Set([
  'appName',
  'tableCols.pos',
  'adminToken',
  'adminTitle', // "Admin panel" is also English
  'weightValue()', // "72 kg" in both
]);
const isSymbolOnly = (s: string) => !/\p{L}{3,}/u.test(s);

describe('translations', () => {
  it('every language has exactly the same keys', () => {
    expect(keysOf(en)).toEqual(keysOf(uz));
    expect(keysOf(ru)).toEqual(keysOf(uz));
  });

  for (const [name, dict] of Object.entries({ uz, en, ru })) {
    it(`${name}: no empty or broken strings`, () => {
      for (const { path, value } of leaves(dict)) {
        expect(value.trim(), path).not.toBe('');
        expect(value, path).not.toMatch(/undefined|NaN|\$\{|\[object/);
      }
    });
  }

  it('English and Russian are actually translated (not copied from Uzbek)', () => {
    const uzMap = new Map(leaves(uz).map((l) => [l.path, l.value]));
    for (const [name, dict] of Object.entries({ en, ru })) {
      const copied = leaves(dict).filter(
        (l) => l.value === uzMap.get(l.path) && !SAME_EVERYWHERE.has(l.path) && !isSymbolOnly(l.value) && !l.path.startsWith('eventIcons'),
      );
      expect(copied.map((c) => `${name}:${c.path}`)).toEqual([]);
    }
  });

  it('Russian has no Latin-only sentences (spot check)', () => {
    for (const { path, value } of leaves(ru)) {
      if (SAME_EVERYWHERE.has(path) || path.startsWith('eventIcons') || isSymbolOnly(value)) continue;
      if (/^(GK|CB|FB|CM|W|ST)$/.test(value) || /Futbolchi Pro|PNG|UZS/.test(value)) continue;
      expect(/[а-яё]/i.test(value), `${path}: ${value}`).toBe(true);
    }
  });
});
