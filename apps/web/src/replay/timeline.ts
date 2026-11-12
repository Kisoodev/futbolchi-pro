/**
 * Pure replay timeline: turns an ordered event list into time segments and
 * answers "where is the ball at time t". No physics — the ball moves linearly
 * between the event's waypoints, then pauses on the final point.
 */
import type { Match, MatchEvent, PitchPoint } from '@futbolchi/engine';

/**
 * Minutes during which the persona is on the pitch, derived from the events:
 * a sub comes on at their substitution; injury/fatigue subs and red cards end it.
 * Null when the persona did not play.
 */
export function personaWindow(m: Match): { from: number; to: number } | null {
  if (!m.personaStats || m.personaStats.minutes <= 0) return null;
  const mine = m.events.filter((e) => e.actor === 'persona');
  const on = mine.find((e) => e.type === 'substitution' && e.detail?.personaIn === true);
  const off = mine.find(
    (e) => (e.type === 'substitution' && e.detail?.personaIn === false) || (e.type === 'card' && e.detail?.card === 'red'),
  );
  return { from: on ? on.minute : 0, to: off ? off.minute : 90 };
}

export const HOP_MS = 550;
export const HOLD_MS = 1100;
export const STATIC_MS = 1300; // cards, subs, injuries

export interface Segment {
  index: number;
  start: number;
  moveEnd: number;
  end: number;
}

export function buildTimeline(events: MatchEvent[]): { segments: Segment[]; total: number } {
  let t = 0;
  const segments = events.map((e, index) => {
    const hops = Math.max(0, e.path.length - 1);
    const move = hops > 0 ? hops * HOP_MS : 0;
    const hold = hops > 0 ? HOLD_MS : STATIC_MS;
    const seg = { index, start: t, moveEnd: t + move, end: t + move + hold };
    t = seg.end;
    return seg;
  });
  return { segments, total: t };
}

export interface Frame {
  /** Index of the current event, −1 before the first. */
  eventIndex: number;
  ball: PitchPoint;
  /** True once the ball reached the last waypoint of the current event. */
  arrived: boolean;
  score: [number, number];
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (k: number) => k * k * (3 - 2 * k);

export function frameAt(events: MatchEvent[], segments: Segment[], t: number): Frame {
  const score: [number, number] = [0, 0];
  if (events.length === 0) return { eventIndex: -1, ball: { x: 50, y: 50 }, arrived: true, score };
  let idx = segments.findIndex((s) => t < s.end);
  if (idx === -1) idx = segments.length - 1;
  for (let i = 0; i < idx; i++) if (events[i].type === 'goal') score[events[i].team === 'home' ? 0 : 1]++;

  const e = events[idx];
  const s = segments[idx];
  const path = e.path;
  let ball: PitchPoint = path[path.length - 1];
  let arrived = true;
  if (path.length > 1 && t < s.moveEnd) {
    const hops = path.length - 1;
    const k = Math.max(0, (t - s.start) / (s.moveEnd - s.start)) * hops;
    const h = Math.min(hops - 1, Math.floor(k));
    const f = ease(k - h);
    ball = { x: lerp(path[h].x, path[h + 1].x, f), y: lerp(path[h].y, path[h + 1].y, f) };
    arrived = false;
  }
  if (arrived && e.type === 'goal') score[e.team === 'home' ? 0 : 1]++;
  return { eventIndex: idx, ball, arrived, score };
}
