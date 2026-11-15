/**
 * Named squads (docs/CHARACTERS.md), lineups and the squad layer of the match.
 */
import { describe, expect, it } from 'vitest';
import {
  dayOf,
  MAX_SUBS,
  migrateGame,
  newGame,
  nextLineup,
  pickLineup,
  playMatchDay,
  simulateMatch,
  trainDay,
  trainingOffer,
  type GameState,
  type Position,
} from '../src';

const start = (position: Position = 'ST', seed = 4): GameState =>
  newGame({ seed, persona: { id: 'me', name: 'Aziz', position, bonus: {} } });

const myClub = (s: GameState) => s.clubs[s.persona.clubId];
const me = (s: GameState) => ({ id: s.persona.id, name: s.persona.name, position: s.persona.position, injuryWeeksLeft: s.persona.injuryWeeksLeft, ovr: 52 });
const slotOf = (l: ReturnType<typeof pickLineup>, key: string) => l.starters.find((p) => p.characterKey === key)?.slot;

describe('the academy team', () => {
  it('the first club plays with the characters of the bible', () => {
    const squad = myClub(start()).squad;
    const names = squad.map((p) => p.name);
    for (const n of ['Odil', 'Abu', 'Sardor', 'Temur', 'Doniyor', 'Shohruh', 'Otabek']) expect(names).toContain(n);
    expect(squad.find((p) => p.captain)?.name).toBe('Sardor');
    expect(squad.find((p) => p.characterKey === 'odil')?.ovr).toBe(62);
    expect(squad).toHaveLength(18);
    // every other club's players have names too
    for (const c of Object.values(start().clubs)) for (const p of c.squad) expect(p.name.length).toBeGreaterThan(1);
  });

  it('old saves get names and the academy team once', () => {
    const s = start();
    const stripped = {
      ...s,
      clubs: Object.fromEntries(Object.entries(s.clubs).map(([k, c]) => [k, { ...c, squad: c.squad.filter((p) => !p.characterKey).map((p) => ({ ...p, name: '' })) }])),
    } as GameState;
    const m = migrateGame(stripped);
    expect(myClub(m).squad.some((p) => p.characterKey === 'odil')).toBe(true);
    expect(Object.values(m.clubs).every((c) => c.squad.every((p) => p.name))).toBe(true);
    expect(migrateGame(m)).toBe(m);
  });
});

describe('lineups', () => {
  it('the persona, Odil and Abu always start', () => {
    const s = start('ST');
    const l = pickLineup(myClub(s), { seed: 1, persona: me(s) });
    expect(l.starters).toHaveLength(11);
    expect(l.starters.find((p) => p.persona)?.slot).toBe('ST');
    expect(slotOf(l, 'odil')).toBe('RW');
    expect(slotOf(l, 'abu')).toBe('GK');
    expect(l.bench.length).toBeGreaterThan(0);
    expect(l.bench.some((p) => p.position === 'GK')).toBe(true);
  });

  it('a winger persona takes the right wing and Odil moves to the left', () => {
    const s = start('W');
    const l = pickLineup(myClub(s), { seed: 2, persona: me(s) });
    expect(l.starters.find((p) => p.persona)?.slot).toBe('RW');
    expect(slotOf(l, 'odil')).toBe('LW');
  });

  it('a goalkeeper persona keeps goal and Abu waits on the bench', () => {
    const s = start('GK');
    const l = pickLineup(myClub(s), { seed: 3, persona: me(s) });
    expect(l.starters.find((p) => p.persona)?.slot).toBe('GK');
    expect(l.bench.some((p) => p.characterKey === 'abu')).toBe(true);
  });

  it('an injured persona is left out; the board shows the week\'s XI', () => {
    const s = start('CM');
    const hurt = { ...me(s), injuryWeeksLeft: 2 };
    const l = pickLineup(myClub(s), { seed: 4, persona: hurt });
    expect(l.starters.some((p) => p.persona)).toBe(false);
    expect(l.starters).toHaveLength(11);
    const board = nextLineup(s)!;
    expect(board.starters.find((p) => p.persona)?.slot).toBe('CM');
  });
});

describe('matches with named squads', () => {
  it('the persona always starts and the events name the players', () => {
    let s = start('ST', 9);
    let named = 0;
    for (let w = 0; w < 6; w++) {
      s = dayOf(s) === 'training' ? trainDay(s, trainingOffer(s)[0]).state : s;
      const r = playMatchDay(s);
      const m = r.state.matches[r.matchId];
      expect(m.personaStats!.role === 'start' || m.personaStats!.role === 'injured').toBe(true);
      expect(m.lineups?.home.starters).toHaveLength(11);
      for (const e of m.events.filter((x) => x.type === 'goal')) {
        expect(e.detail?.player).toBeTruthy();
        named++;
      }
      expect(m.players?.length).toBeGreaterThanOrEqual(22);
      s = r.state;
    }
    expect(named).toBeGreaterThan(0);
  });

  it('coaches make real changes: named, at most five, bench players come on', () => {
    const s = start('CB', 12);
    const l = { home: pickLineup(myClub(s), { seed: 5, persona: me(s) }), away: pickLineup(Object.values(s.clubs).find((c) => c.id !== s.persona.clubId && c.tier === 4)!, { seed: 5 }) };
    let total = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const r = simulateMatch({
        matchId: `m${seed}`,
        seed,
        home: { id: 'h', ratings: myClub(s).ratings },
        away: { id: 'a', ratings: myClub(s).ratings },
        persona: { side: 'home', position: 'CB', stats: s.persona.stats, fatigue: 0, role: 'start', injuryRiskBonus: 0 },
        lineups: l,
      });
      for (const side of ['home', 'away'] as const) {
        const subs = r.events.filter((e) => e.type === 'substitution' && e.team === side);
        expect(subs.length).toBeLessThanOrEqual(MAX_SUBS);
        for (const e of subs) {
          expect(e.detail?.in).toBeTruthy();
          expect(e.detail?.out).toBeTruthy();
          expect(l[side].bench.map((b) => b.name)).toContain(e.detail!.in);
        }
        total += subs.length;
      }
      for (const p of r.players!) expect(p.rating).toBeGreaterThanOrEqual(3);
    }
    expect(total / 40).toBeGreaterThan(2);
  });

  it('goals stay realistic with named squads (about 2–3.5 a match)', () => {
    const s = start('CM', 15);
    const club = myClub(s);
    let goals = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const lineups = { home: pickLineup(club, { seed }), away: pickLineup(club, { seed: seed + 1000 }) };
      const r = simulateMatch({ matchId: `g${seed}`, seed, home: { id: 'h', ratings: club.ratings }, away: { id: 'a', ratings: club.ratings }, lineups });
      goals += r.score[0] + r.score[1];
    }
    expect(goals / 200).toBeGreaterThan(1.8);
    expect(goals / 200).toBeLessThan(3.6);
  });
});

describe('the bible stays true', () => {
  it('nobody in the academy squad is stronger than Odil, and the unnamed players are ordinary', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const squad = myClub(start('ST', seed)).squad;
      expect(Math.max(...squad.map((p) => p.ovr))).toBe(62);
      for (const p of squad.filter((x) => !x.characterKey)) expect(p.ovr).toBeLessThanOrEqual(57);
    }
  });
});
