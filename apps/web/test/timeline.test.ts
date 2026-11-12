import { describe, expect, it } from 'vitest';
import { newGame, playWeek, trainingOffer } from '@futbolchi/engine';
import { buildTimeline, frameAt } from '../src/replay/timeline';

function aMatch() {
  let s = newGame({ seed: 3, persona: { id: 'p', name: 'Aziz', position: 'ST', bonus: {} } });
  const r = playWeek(s, trainingOffer(s)[0]);
  s = r.state;
  return s.matches[r.matchId];
}

describe('replay timeline', () => {
  it('segments are contiguous and cover every event', () => {
    const m = aMatch();
    const { segments, total } = buildTimeline(m.events);
    expect(segments).toHaveLength(m.events.length);
    for (let i = 1; i < segments.length; i++) expect(segments[i].start).toBe(segments[i - 1].end);
    expect(total).toBe(segments.at(-1)?.end ?? 0);
  });

  it('ball starts on the first waypoint and ends on the last; final score matches', () => {
    const m = aMatch();
    const { segments, total } = buildTimeline(m.events);
    const f0 = frameAt(m.events, segments, 0);
    expect(f0.ball).toEqual(m.events[0].path[0]);
    const end = frameAt(m.events, segments, total);
    expect(end.ball).toEqual(m.events.at(-1)!.path.at(-1));
    expect(end.score).toEqual(m.score);
  });

  it('is a pure function of t', () => {
    const m = aMatch();
    const { segments, total } = buildTimeline(m.events);
    expect(frameAt(m.events, segments, total / 2)).toEqual(frameAt(m.events, segments, total / 2));
  });

  it('handles a match without events', () => {
    const { segments, total } = buildTimeline([]);
    expect(total).toBe(0);
    expect(frameAt([], segments, 0).score).toEqual([0, 0]);
  });
});
