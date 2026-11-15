import { describe, expect, it } from 'vitest';
import { dayOf, newGame, playMatchDay, trainDay, trainingOffer, type GameState } from '@futbolchi/engine';
import { buildScenes, liveFrameAt, pitchAt, rebuildLog } from '../src/replay/liveScenes';

function playedMatch(seed: number) {
  let s: GameState = newGame({ seed, persona: { id: 'me', name: 'Aziz', position: 'W', bonus: {} } });
  if (dayOf(s) === 'training') s = trainDay(s, trainingOffer(s)[0]).state;
  const r = playMatchDay(s);
  return r.state.matches[r.matchId];
}

describe('live replay', () => {
  it('rebuilds exactly the match that was played (same goals, same events)', () => {
    for (const seed of [3, 8, 21]) {
      const m = playedMatch(seed);
      expect(m.engine).toBe(2);
      const log = rebuildLog(m)!;
      expect(log.filter((e) => e.outcome === 'GOAL').length).toBe(m.score[0] + m.score[1]);
      for (const e of m.events) if (e.seq !== undefined) expect(log[e.seq]).toBeTruthy();
      const goalSeqs = m.events.filter((e) => e.type === 'goal').map((e) => e.seq);
      for (const q of goalSeqs) expect(log[q!].outcome).toBe('GOAL');
    }
  });

  it('every highlight becomes a scene; players stay on the pitch and the score adds up', () => {
    const m = playedMatch(5);
    const log = rebuildLog(m)!;
    const { scenes, total } = buildScenes(m, log);
    expect(scenes).toHaveLength(m.events.length);
    expect(total).toBeGreaterThan(0);
    for (const s of scenes) {
      if (s.event.type === 'goal' || s.event.type === 'keyChance') expect(s.actions.length).toBeGreaterThan(0);
      for (let j = 0; j < s.actions.length; j++)
        for (const k of [0, 0.5, 1]) {
          const st = pitchAt(s, j, k)!;
          expect(st.players.size).toBeGreaterThanOrEqual(18);
          for (const p of st.players.values()) {
            expect(p.x).toBeGreaterThanOrEqual(0);
            expect(p.x).toBeLessThanOrEqual(100);
            expect(p.y).toBeGreaterThanOrEqual(0);
            expect(p.y).toBeLessThanOrEqual(100);
          }
        }
    }
    expect(liveFrameAt(scenes, total).score).toEqual(m.score);
  });
});

describe('replay texts', () => {
  it('uz, en and ru name every action and outcome', async () => {
    const { REPLAY_TEXTS } = await import('../src/i18n/replay');
    const keys = (o: object) => Object.keys(o).sort();
    for (const l of ['en', 'ru'] as const) {
      expect(keys(REPLAY_TEXTS[l].action)).toEqual(keys(REPLAY_TEXTS.uz.action));
      expect(keys(REPLAY_TEXTS[l].outcome)).toEqual(keys(REPLAY_TEXTS.uz.outcome));
    }
    for (const l of ['uz', 'en', 'ru'] as const) for (const v of Object.values(REPLAY_TEXTS[l].action)) expect(v.length).toBeGreaterThan(2);
  });
});
