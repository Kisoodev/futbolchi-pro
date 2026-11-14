/**
 * Which coach lessons this browser has already seen, and whether the coach's
 * tips are switched on. Kept in localStorage; the settings sheet can switch
 * the tips off, or back on (which replays the lessons).
 */
import { useSyncExternalStore } from 'react';
import type { LessonId } from '../i18n/coach';

interface CoachState {
  off: boolean;
  seen: LessonId[];
}

const KEY = 'futbolchi.coach';

function read(): CoachState {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<CoachState>;
    return { off: !!v.off, seen: Array.isArray(v.seen) ? v.seen : [] };
  } catch {
    return { off: false, seen: [] };
  }
}

let state = read();
const listeners = new Set<() => void>();

function write(next: CoachState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: lasts for this visit */
  }
  listeners.forEach((l) => l());
}

export const useCoachState = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );

/** True when this lesson should be shown now. */
export const lessonDue = (s: CoachState, id: LessonId) => !s.off && !s.seen.includes(id);

export function markLesson(id: LessonId) {
  if (!state.seen.includes(id)) write({ ...state, seen: [...state.seen, id] });
}

/** Switches the tips on (and replays every lesson) or off. */
export function setCoachOn(on: boolean) {
  write({ off: !on, seen: on ? [] : state.seen });
}

export const coachOn = () => !state.off;
