/**
 * Language state. The game ships in Uzbek (default), English and Russian.
 *
 * `tx` is a live ES-module binding to the current dictionary: components read
 * `tx.something` while rendering, and App re-renders the whole tree through
 * useLang() whenever the language changes, so a switch is instant.
 *
 * Adding UI text: put it in uz.ts, en.ts and ru.ts — the Messages type makes
 * the build fail if any language is missing a key.
 */
import { useSyncExternalStore } from 'react';
import { LANGS, type Lang } from '@futbolchi/engine';
import { uz, type Messages } from './uz';
import { en } from './en';
import { ru } from './ru';

export { LANGS, type Lang, type Messages };

const DICTS: Record<Lang, Messages> = { uz, en, ru };
const KEY = 'futbolchi.lang';
export const DEFAULT_LANG: Lang = 'uz';

export const LANG_LABELS: Record<Lang, { short: string; name: string }> = {
  uz: { short: 'UZ', name: "O'zbekcha" },
  en: { short: 'EN', name: 'English' },
  ru: { short: 'RU', name: 'Русский' },
};

const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LANGS as readonly string[]).includes(v);

function readStored(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    return isLang(v) ? v : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

export let lang: Lang = readStored();
export let tx: Messages = DICTS[lang];
if (typeof document !== 'undefined') document.documentElement.lang = lang;

const listeners = new Set<() => void>();

export function setLang(next: Lang): void {
  if (!isLang(next) || next === lang) return;
  lang = next;
  tx = DICTS[next];
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* storage blocked: the choice lasts for this visit */
  }
  document.documentElement.lang = next;
  listeners.forEach((l) => l());
}

/** Subscribes a component (App) to language changes. */
export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => lang,
  );
}

export const messagesFor = (l: Lang): Messages => DICTS[l];

/** Money from minor units (tiyin), e.g. 500000 → "5 000 so'm" / "5 000 UZS" / "5 000 сум". */
export function formatMoney(minor: number): string {
  const grouped = String(Math.round(minor / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return tx.money(grouped);
}
