/**
 * Live replay of a v2 match (docs/MATCH_ENGINE.md): the action log is rebuilt
 * from the match's seed, lineups and the persona's input (the engine is
 * deterministic), then every highlight (goal, chance, card, change) becomes a
 * scene: the chain of actions that led to it, played on a pitch where all 22
 * players stand in their team shape (the engine's own shapeSpot) — defenders
 * step up in attack, forwards drop back in defence, the pressing players close
 * the ball down, the receiver runs onto the pass.
 *
 * Pure: no DOM, so it can be tested.
 */
import {
  runMatch,
  shapeSpot,
  type LineupPlayer,
  type Match,
  type MatchEvent,
  type Point,
  type SimEvent,
  type Side,
  type SlotId,
} from '@futbolchi/engine';

export interface LivePlayer {
  id: string;
  name: string;
  side: Side;
  position: LineupPlayer['position'];
  characterKey?: string;
  persona: boolean;
}

export interface Step {
  /** Index into scene.actions. */
  j: number;
  start: number;
  end: number;
}

export interface Scene {
  event: MatchEvent;
  eventIndex: number;
  /** The actions shown (may be empty for a change of players). */
  actions: SimEvent[];
  /** Log index of actions[0]. */
  firstIndex: number;
  /** Who is on the pitch, by slot. */
  roster: Map<string, { slot: SlotId; side: Side }>;
  steps: Step[];
  start: number;
  /** When the last action has arrived (the caption shows from here). */
  arrive: number;
  end: number;
}

const other = (s: Side): Side => (s === 'home' ? 'away' : 'home');
const MAX_CHAIN = 7;

export function rebuildLog(m: Match): SimEvent[] | null {
  if (m.engine !== 2 || !m.lineups) return null;
  return runMatch({ matchId: m.id, seed: m.seed, lineups: m.lineups, persona: m.simPersona ?? null }).log;
}

export function livePlayers(m: Match): Map<string, LivePlayer> {
  const out = new Map<string, LivePlayer>();
  if (!m.lineups) return out;
  for (const side of ['home', 'away'] as Side[]) {
    const lu = m.lineups[side];
    for (const p of [...lu.starters, ...lu.bench]) out.set(p.id, { id: p.id, name: p.name, side, position: p.position, characterKey: p.characterKey, persona: !!p.persona });
  }
  return out;
}

/** Which side had the ball when this action started. */
export function ownerBefore(a: SimEvent): Side {
  if (a.type === 'TACKLE' || a.type === 'FOUL' || a.type === 'GK_CLAIM') return other(a.side);
  if (a.type === 'HEADER' && a.outcome === 'CLEARED') return other(a.side);
  return a.side;
}

/** Who holds the ball at the start of the action. */
export function holderOf(a: SimEvent): string {
  if (a.type === 'TACKLE' || a.type === 'FOUL') return a.targetId ?? a.playerId;
  return a.playerId;
}

const PASSES = new Set(['SHORT_PASS', 'LONG_PASS', 'THROUGH_BALL', 'BACK_PASS', 'CROSS', 'KICK_OFF', 'THROW_IN']);
const MARKERS = new Set(['KICK_OFF', 'THROW_IN', 'CORNER', 'FREE_KICK', 'GOAL_KICK', 'GK_CLAIM']);
const CHANGE_OF_BALL = new Set(['INTERCEPTED', 'LOST', 'LOOSE_LOST', 'WON', 'MISKICK']);

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, (a.y - b.y) * 0.68);

/** Milliseconds an action takes on screen (before slow motion). */
export function actionMs(a: SimEvent): number {
  if (PASSES.has(a.type) && a.to) return Math.round(380 + dist(a.from, a.to) * 9);
  switch (a.type) {
    case 'CARRY':
      return 650;
    case 'DRIBBLE':
    case 'KNOCK_AND_RUN':
    case 'CLEAR':
      return 760;
    case 'SHOOT':
    case 'HEADER':
    case 'PENALTY':
      return 720;
    case 'TACKLE':
    case 'FOUL':
      return 600;
    case 'LOOSE_BALL':
      return 520;
    case 'HOLD_UP':
      return 620;
    default:
      return MARKERS.has(a.type) ? 650 : 600;
  }
}

export const HOLD_GOAL_MS = 2100;
export const HOLD_MS = 1250;
export const STATIC_MS = 1500;
export const SLOW_MO = 1.4;

/**
 * Turns the summary events into scenes on one timeline. Events without an
 * action (old saves) become short static scenes.
 */
export function buildScenes(m: Match, log: SimEvent[]): { scenes: Scene[]; total: number } {
  const players = livePlayers(m);
  // who is on the pitch before each log index
  const rosterBefore: Map<string, { slot: SlotId; side: Side }>[] = [];
  const roster = new Map<string, { slot: SlotId; side: Side }>();
  for (const side of ['home', 'away'] as Side[]) for (const p of m.lineups?.[side].starters ?? []) if (p.slot) roster.set(p.id, { slot: p.slot, side });
  for (let i = 0; i < log.length; i++) {
    rosterBefore.push(new Map(roster));
    const a = log[i];
    if (a.type === 'SUB' && a.targetId) {
      const out = roster.get(a.playerId);
      roster.delete(a.playerId);
      const inP = players.get(a.targetId);
      if (out && inP) roster.set(a.targetId, out);
    }
    if (a.type === 'FOUL' && a.outcome === 'RED') roster.delete(a.playerId);
  }
  rosterBefore.push(new Map(roster));

  let t = 0;
  const scenes: Scene[] = [];
  m.events.forEach((event, eventIndex) => {
    const seq = event.seq;
    const start = t;
    if (seq === undefined || !log[seq] || event.type === 'substitution' || event.type === 'injury') {
      t += STATIC_MS;
      scenes.push({ event, eventIndex, actions: [], firstIndex: seq ?? 0, roster: rosterBefore[Math.min(seq ?? 0, rosterBefore.length - 1)], steps: [], start, arrive: start + 250, end: t });
      return;
    }
    const side = ownerBefore(log[seq]);
    let first = seq;
    while (first > 0 && seq - first < MAX_CHAIN) {
      const prev = log[first - 1];
      if (prev.type === 'SUB' || prev.type === 'KICK_OFF') break;
      if (prev.outcome === 'GOAL') break;
      first--;
      // the action that won the ball starts the move
      if (ownerBefore(prev) !== side || CHANGE_OF_BALL.has(prev.outcome)) break;
    }
    const actions = log.slice(first, seq + 1).filter((a) => a.type !== 'SUB');
    const big = event.type === 'goal' || event.highlight;
    const steps: Step[] = actions.map((a, j) => {
      const slow = big && j >= actions.length - 2 ? SLOW_MO : 1;
      const s = { j, start: t, end: t + actionMs(a) * slow };
      t = s.end;
      return s;
    });
    const arrive = t;
    t += event.type === 'goal' ? HOLD_GOAL_MS : HOLD_MS;
    scenes.push({ event, eventIndex, actions, firstIndex: first, roster: rosterBefore[first], steps, start, arrive, end: t });
  });
  return { scenes, total: t };
}

export interface LiveFrame {
  sceneIndex: number;
  /** Current action (index into scene.actions), −1 for a static scene. */
  j: number;
  /** 0–1 progress through the action. */
  k: number;
  arrived: boolean;
  score: [number, number];
}

export function liveFrameAt(scenes: Scene[], t: number): LiveFrame {
  const score: [number, number] = [0, 0];
  if (!scenes.length) return { sceneIndex: -1, j: -1, k: 1, arrived: true, score };
  let idx = scenes.findIndex((s) => t < s.end);
  if (idx === -1) idx = scenes.length - 1;
  for (let i = 0; i < idx; i++) if (scenes[i].event.type === 'goal') score[scenes[i].event.team === 'home' ? 0 : 1]++;
  const s = scenes[idx];
  const arrived = t >= s.arrive;
  if (arrived && s.event.type === 'goal') score[s.event.team === 'home' ? 0 : 1]++;
  if (!s.steps.length) return { sceneIndex: idx, j: -1, k: 1, arrived, score };
  let step = s.steps.find((st) => t < st.end) ?? s.steps[s.steps.length - 1];
  if (t < s.steps[0].start) step = s.steps[0];
  const k = Math.max(0, Math.min(1, (t - step.start) / (step.end - step.start)));
  return { sceneIndex: idx, j: step.j, k, arrived, score };
}

// ------------------------------------------------------------------ positions

export interface PitchState {
  ball: Point;
  /** Ball height for lofted balls (0–1), for the shadow. */
  lift: number;
  players: Map<string, Point>;
  /** Who is on the ball (for the highlight ring and the name). */
  holder: string | null;
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (k: number) => k * k * (3 - 2 * k);
const clampP = (p: Point): Point => ({ x: Math.min(98, Math.max(2, p.x)), y: Math.min(97, Math.max(3, p.y)) });
const ownGoalX = (s: Side) => (s === 'home' ? 0 : 100);

/** Team shapes for the ball at `ball` with `owner` in possession (the other side out of shape on a counter). */
function shapes(roster: Scene['roster'], ball: Point, owner: Side, counter: boolean): Map<string, Point> {
  const out = new Map<string, Point>();
  for (const [id, { slot, side }] of roster) {
    const inPos = side === owner;
    let p = shapeSpot(side, slot, ball, inPos);
    if (!inPos && counter) {
      const caught = shapeSpot(side, slot, ball, true);
      p = { x: lerp(p.x, caught.x, 0.55), y: lerp(p.y, caught.y, 0.55) };
    }
    out.set(id, p);
  }
  return out;
}

/** Near the ball, between it and the defender's own goal. */
function pressSpot(ball: Point, side: Side, n: number): Point {
  const gx = ownGoalX(side);
  const dx = gx - ball.x;
  const dy = 50 - ball.y;
  const len = Math.hypot(dx, dy) || 1;
  const lateral = n === 0 ? 0 : n === 1 ? 4 : -4;
  return clampP({ x: ball.x + (dx / len) * 3.4 + (-dy / len) * lateral * 0.5, y: ball.y + (dy / len) * 3.4 + (dx / len) * lateral });
}

/** Was the ball just won in open play (the other side is still out of shape)? */
function counterAt(scene: Scene, j: number): boolean {
  for (let back = 1; back <= 3; back++) {
    const prev = scene.actions[j - back];
    if (!prev) return false;
    if (CHANGE_OF_BALL.has(prev.outcome) && ownerBefore(scene.actions[j]) !== ownerBefore(prev)) return true;
  }
  return false;
}

/** Everyone's position at the start of action j. */
function startState(scene: Scene, j: number): PitchState {
  const a = scene.actions[j];
  const owner = ownerBefore(a);
  const ball = a.from;
  const players = shapes(scene.roster, ball, owner, counterAt(scene, j));
  const holder = holderOf(a);
  if (players.has(holder) && !MARKERS.has(a.type)) players.set(holder, clampP({ x: ball.x + (owner === 'home' ? -1.6 : 1.6), y: ball.y + 1 }));
  if (MARKERS.has(a.type) && players.has(a.playerId)) players.set(a.playerId, clampP({ x: ball.x + (a.side === 'home' ? -1.5 : 1.5), y: ball.y }));
  const defenders = a.type === 'TACKLE' || a.type === 'FOUL' ? [a.playerId] : a.opponentIds;
  defenders.forEach((id, n) => {
    const r = scene.roster.get(id);
    if (r && players.has(id)) players.set(id, pressSpot(ball, r.side, n));
  });
  return { ball, lift: 0, players, holder };
}

/** Everyone's position when action j has finished. */
function endState(scene: Scene, j: number): PitchState {
  if (j + 1 < scene.actions.length) return startState(scene, j + 1);
  const a = scene.actions[j];
  const s = startState(scene, j);
  const ball = a.to ?? a.from;
  const owner = ownerBefore(a);
  const players = shapes(scene.roster, ball, owner, counterAt(scene, j));
  // the actor and the defenders stay close to where it happened
  for (const id of [a.playerId, ...a.opponentIds]) {
    const p = s.players.get(id);
    if (p) players.set(id, p);
  }
  if (a.targetId && players.has(a.targetId)) players.set(a.targetId, clampP({ x: ball.x + (owner === 'home' ? -1.4 : 1.4), y: ball.y + 1 }));
  return { ball, lift: 0, players, holder: a.targetId ?? null };
}

/** The pitch for a frame. */
export function pitchAt(scene: Scene, j: number, k: number): PitchState | null {
  if (j < 0 || !scene.actions[j]) return null;
  const a = scene.actions[j];
  const s = startState(scene, j);
  const e = endState(scene, j);
  const f = ease(k);
  const players = new Map<string, Point>();
  for (const [id, p] of s.players) {
    const q = e.players.get(id) ?? p;
    players.set(id, { x: lerp(p.x, q.x, f), y: lerp(p.y, q.y, f) });
  }
  const to = a.to ?? e.ball;
  // continue from where the previous action left the ball (no jumps)
  const prev = scene.actions[j - 1];
  const from = prev ? prev.to ?? a.from : a.from;
  // the ball travels during the action (dribbles and carries go with the player)
  const bk = PASSES.has(a.type) || a.type === 'SHOOT' || a.type === 'HEADER' || a.type === 'CLEAR' || a.type === 'PENALTY' ? Math.min(1, k * 1.15) : f;
  const ball = { x: lerp(from.x, to.x, ease(bk)), y: lerp(from.y, to.y, ease(bk)) };
  const lofted = a.type === 'LONG_PASS' || a.type === 'CROSS' || a.type === 'CLEAR' || a.type === 'GOAL_KICK' || a.type === 'CORNER';
  const lift = lofted ? Math.sin(Math.PI * Math.min(1, bk)) : 0;
  // the keeper goes towards the shot
  if (a.type === 'SHOOT' || a.type === 'HEADER' || a.type === 'PENALTY') {
    for (const [id, r] of scene.roster)
      if (r.slot === 'GK' && r.side !== a.side) {
        const p = players.get(id)!;
        players.set(id, { x: p.x, y: lerp(p.y, Math.min(56, Math.max(44, to.y)), f) });
      }
  }
  return { ball, lift, players, holder: k < 0.5 ? s.holder : e.holder };
}
