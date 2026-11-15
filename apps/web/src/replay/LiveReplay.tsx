/**
 * The live 2D replay of a v2 match: every highlight is played as the chain of
 * actions that led to it, with all 22 players — small faces, names, kits —
 * moving in their team shape. The persona is drawn in gold.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  constants,
  HAIR_COLORS,
  HAIR_STYLES_BY_GENDER,
  HEAD_SHAPES,
  hashSeed,
  rosterLook,
  type Appearance,
  type CharacterKey,
  type Club,
  type Match,
  type Point,
  type Kit,
  type Side,
} from '@futbolchi/engine';
import { tx } from '../i18n';
import { eventText } from '../i18n/events';
import { replayTexts } from '../i18n/replay';
import { drawAvatar, headBox, SKIN_HEX } from '../art/avatarRects';
import { kitStroke, matchKits, paintShirt } from './kits';
import { buildScenes, liveFrameAt, livePlayers, pitchAt, rebuildLog, type LivePlayer, type PitchState, type Scene } from './liveScenes';
import { COLORS, drawPitchBase, PIXEL_FONT, SPEEDS, useFitPitch, type ReplayProps } from './PitchReplay';
import { Crest } from '../components/Crest';

const GK_KITS = ['#ffd23f', '#ff7a1a'];

/** A deterministic, plain look for players without their own (most NPCs). */
function npcLook(id: string): Appearance {
  const h = hashSeed('look', id);
  const pick = <T,>(xs: readonly T[], salt: number) => xs[hashSeed(h, salt) % xs.length];
  const skins = ['light', 'medium', 'medium', 'tan', 'tan'] as const;
  const hairColors = HAIR_COLORS.filter((c) => c !== 'red' && c !== 'blonde');
  const styles = HAIR_STYLES_BY_GENDER.male.filter((x) => ['short', 'sidepart', 'spiky', 'buzz', 'curly'].includes(x));
  return {
    ...constants.DEFAULT_APPEARANCE,
    gender: 'male',
    headShape: pick(HEAD_SHAPES, 1),
    skinTone: pick(skins, 2),
    hairStyle: pick([...styles, 'short', 'sidepart'], 3),
    hairColor: pick([...hairColors, 'black', 'black'], 4),
    facialHair: 'none',
  };
}

type HeadCache = Map<string, HTMLCanvasElement>;

/** The player's face, cut from the pixel avatar (cached per player). */
function headSprite(cache: HeadCache, p: LivePlayer, look: Appearance, kit: string): HTMLCanvasElement {
  const key = `${p.id}|${kit}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const full = document.createElement('canvas');
  full.width = 128;
  full.height = 256;
  const fctx = full.getContext('2d')!;
  drawAvatar(fctx, look, kit, 0, 0, 2);
  const hb = headBox(look);
  const box = { x: hb.x * 2, y: hb.y * 2, w: hb.w * 2, h: hb.h * 2 };
  const c = document.createElement('canvas');
  c.width = box.w;
  c.height = box.h;
  c.getContext('2d')!.drawImage(full, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
  cache.set(key, c);
  return c;
}

export function LiveReplay({ match, clubs, personaName, personaLook, onFinished, sideTop, sideBottom, hold = false }: ReplayProps) {
  const rt = replayTexts();
  const { areaRef, boardRef, frameW } = useFitPitch();
  const log = useMemo(() => rebuildLog(match) ?? [], [match]);
  const players = useMemo(() => livePlayers(match), [match]);
  const { scenes, total } = useMemo(() => buildScenes(match, log), [match, log]);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(!hold);
  useEffect(() => setPlaying(!hold), [hold]);
  const [speed, setSpeed] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const finishedRef = useRef(false);
  const heads = useRef<HeadCache>(new Map());

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setT((prev) => Math.min(total, prev + dt * speed));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, total]);

  useEffect(() => {
    if (t >= total && !finishedRef.current) {
      finishedRef.current = true;
      setPlaying(false);
      onFinished?.();
    }
  }, [t, total, onFinished]);

  const frame = liveFrameAt(scenes, t);
  const scene: Scene | undefined = scenes[frame.sceneIndex];
  const current = scene?.event;
  const action = scene && frame.j >= 0 ? scene.actions[frame.j] : undefined;
  const state = scene ? pitchAt(scene, frame.j, frame.k) : null;

  const looks = useMemo(() => {
    const m = new Map<string, Appearance>();
    for (const p of players.values()) {
      if (p.persona && personaLook) m.set(p.id, personaLook);
      else if (p.characterKey) m.set(p.id, rosterLook(p.characterKey as CharacterKey));
      else m.set(p.id, npcLook(p.id));
    }
    return m;
  }, [players, personaLook]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const w = wrap.clientWidth;
    const h = Math.round((w * 68) / 105);
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.height = `${h}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    drawPitchBase(ctx, w, h);
    if (state && scene) drawLive(ctx, w, h, state, scene, action?.playerId ?? null, action?.targetId ?? null, players, looks, heads.current, match, clubs);
    if (current?.type === 'goal' && frame.arrived) drawGoalBanner(ctx, w, h, current.actor === 'persona', rt.outcome.GOAL ?? '');
  });

  const visible = scenes.slice(0, frame.sceneIndex + (frame.arrived ? 1 : 0)).map((s) => s.event);
  const home = clubs[match.homeId];
  const away = clubs[match.awayId];
  const done = t >= total;
  const shownScore = done ? match.score : frame.score;
  const minute = done ? 90 : action?.minute ?? current?.minute ?? 0;
  const actorName = action ? players.get(action.playerId)?.name : undefined;
  const targetName = action?.targetId ? players.get(action.targetId)?.name : undefined;
  const isPass = action && ['SHORT_PASS', 'LONG_PASS', 'THROUGH_BALL', 'BACK_PASS', 'KICK_OFF', 'THROW_IN'].includes(action.type);
  const actionLine = action
    ? `${rt.action[action.type]} · ${isPass && actorName && targetName && action.outcome !== 'INTERCEPTED' ? rt.passTo(actorName, targetName) : actorName ?? ''}${frame.k > 0.85 && rt.outcome[action.outcome] ? ` — ${rt.outcome[action.outcome]}` : ''}`
    : '';

  return (
    <div className="replay">
      <div className="replay-main">
        <div ref={areaRef} className="pitch-area">
          <div className="pitch-frame" style={frameW ? { width: frameW } : undefined}>
            <div ref={boardRef} className="scoreboard">
              <span className="team" style={{ borderColor: home.color }}><Crest club={home} size={18} /> {home.name}</span>
              <span className="score">
                {shownScore[0]} : {shownScore[1]}
              </span>
              <span className="team" style={{ borderColor: away.color }}><Crest club={away} size={18} /> {away.name}</span>
              <span className="minute">{done ? tx.fullTime : `${minute}'`}</span>
            </div>
            <div ref={wrapRef} className="pitch-wrap">
              <canvas ref={canvasRef} className="pitch" aria-label={tx.pitchLabel} />
              {action && !frame.arrived && !done && <div className="action-line">{actionLine}</div>}
              {current && frame.arrived && !done && (
                <div className={`caption ${current.actor === 'persona' ? 'me' : ''}`}>
                  {tx.eventIcons[current.type]} {eventText(current, match, clubs, personaName)}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="controls">
          <button onClick={() => (done ? (setT(0), (finishedRef.current = false), setPlaying(true)) : setPlaying(!playing))}>
            {playing ? tx.pause : tx.play}
          </button>
          <button onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}>
            {tx.speed}: {speed}×
          </button>
          <button onClick={() => setT(total)} disabled={done}>
            {tx.skip}
          </button>
        </div>
      </div>
      <aside className="replay-side">
        {sideTop}
        <ol className="event-feed">
          {visible.length === 0 && done && <li className="muted">{tx.noEvents}</li>}
          {visible
            .map((e, i) => ({ e, i }))
            .reverse()
            .map(({ e, i }) => (
              <li
                key={e.id}
                className={e.actor === 'persona' ? 'me' : ''}
                onClick={() => {
                  setT(scenes[i].start);
                  finishedRef.current = false;
                }}
              >
                <span className="min">{e.minute}'</span>
                <span>{tx.eventIcons[e.type]}</span>
                <span>{eventText(e, match, clubs, personaName)}</span>
              </li>
            ))}
        </ol>
        {sideBottom}
      </aside>
    </div>
  );
}

function drawLive(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: PitchState,
  scene: Scene,
  actorId: string | null,
  targetId: string | null,
  players: Map<string, LivePlayer>,
  looks: Map<string, Appearance>,
  heads: HeadCache,
  match: Match,
  clubs: Record<string, Club>,
) {
  const X = (x: number) => (x / 100) * w;
  const Y = (y: number) => (y / 100) * h;
  const u = w / 105; // pixels per metre
  const kits = matchKits(clubs[match.homeId], clubs[match.awayId]);
  const kitOf = (side: Side, gk: boolean): Kit => {
    if (!gk) return kits[side];
    const c = side === 'home' ? GK_KITS[0] : GK_KITS[1];
    return { shirt: c, secondary: '#111111', shorts: '#111111', socks: c, pattern: 'plain' };
  };
  const wide = w >= 480;
  const involved = new Set([actorId, targetId, state.holder, ...(scene.actions.flatMap((a) => a.opponentIds) ?? [])].filter(Boolean) as string[]);

  // farther players first, so the nearer ones overlap them
  const order = [...state.players.entries()].sort((a, b) => a[1].y - b[1].y);
  const headSize = Math.max(9, Math.min(22, u * 2.7));
  const fontPx = Math.max(8, Math.min(12, u * 1.45));
  const labels: { x: number; y: number; text: string; me: boolean; hot: boolean }[] = [];

  for (const [id, p] of order) {
    const info = players.get(id);
    const r = scene.roster.get(id);
    if (!info || !r) continue;
    const gk = r.slot === 'GK';
    const k = kitOf(r.side, gk);
    const kit = k.shirt;
    const cx = X(p.x);
    const cy = Y(p.y);
    const look = looks.get(id);
    const skin = look ? SKIN_HEX[look.skinTone] : '#c98e60';
    const s = headSize * (info.persona ? 1.15 : 1);
    const neck = cy - s * 0.12;
    const feet = neck + s * 1.12;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx, feet, s * 0.5, s * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    // ring: gold for the persona, white for the player on the ball
    if (info.persona || id === state.holder) {
      ctx.strokeStyle = info.persona ? COLORS.sun : '#ffffff';
      ctx.lineWidth = info.persona ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.ellipse(cx, feet, s * 0.68, s * 0.24, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // a little footballer: legs and socks, shorts, shirt with sleeves, hands
    const shorts = k.shorts;
    const leg = s * 0.15;
    for (const dx of [-0.2, 0.06]) {
      ctx.fillStyle = skin;
      ctx.fillRect(cx + dx * s, neck + s * 0.74, leg, s * 0.16);
      ctx.fillStyle = k.socks;
      ctx.fillRect(cx + dx * s, neck + s * 0.88, leg, s * 0.2);
      ctx.fillStyle = '#20232a';
      ctx.fillRect(cx + dx * s - s * 0.02, neck + s * 1.06, leg + s * 0.04, s * 0.07);
    }
    ctx.fillStyle = shorts;
    ctx.fillRect(cx - s * 0.32, neck + s * 0.56, s * 0.64, s * 0.22);
    paintShirt(ctx, k, cx - s * 0.36, neck, s * 0.72, s * 0.58);
    ctx.fillStyle = k.pattern === 'sleeves' ? k.secondary : k.shirt;
    ctx.fillRect(cx - s * 0.52, neck + s * 0.02, s * 0.18, s * 0.24);
    ctx.fillRect(cx + s * 0.34, neck + s * 0.02, s * 0.18, s * 0.24);
    ctx.fillStyle = skin;
    ctx.fillRect(cx - s * 0.5, neck + s * 0.26, s * 0.13, s * 0.22);
    ctx.fillRect(cx + s * 0.37, neck + s * 0.26, s * 0.13, s * 0.22);
    ctx.strokeStyle = kitStroke(kit) === '#ffffff' ? 'rgba(255,255,255,0.5)' : 'rgba(18,50,79,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - s * 0.36, neck, s * 0.72, s * 0.58);
    // face
    if (look) ctx.drawImage(headSprite(heads, info, look, kit), cx - s / 2, neck - s * 0.9, s, s);
    const hot = involved.has(id);
    // on narrow screens: the players around the ball
    const near = Math.hypot(p.x - state.ball.x, (p.y - state.ball.y) * 0.68) < 16;
    if (info.persona || wide || hot || near) labels.push({ x: cx, y: feet + s * 0.25 + fontPx * 0.8, text: info.name, me: info.persona, hot });
  }

  // ball (with a shadow when it is in the air)
  const bx = X(state.ball.x);
  const by = Y(state.ball.y);
  const lift = state.lift * u * 3.2;
  const br = Math.max(3, u * 0.75);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(bx, by + br * 0.6, br, br * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bx, by - lift, br, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // names last, on top of everything
  ctx.textAlign = 'center';
  for (const l of labels) {
    const size = l.me ? fontPx + 2 : l.hot ? fontPx : fontPx - 1;
    ctx.font = `${l.me || l.hot ? 700 : 500} ${size}px ${PIXEL_FONT}`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLORS.ink;
    const half = ctx.measureText(l.text).width / 2 + 2;
    const lx = Math.min(w - half, Math.max(half, l.x));
    const ly = Math.min(h - 3, l.y);
    ctx.strokeText(l.text, lx, ly);
    ctx.fillStyle = l.me ? COLORS.sun : l.hot ? '#ffffff' : 'rgba(255,255,255,0.85)';
    ctx.fillText(l.text, lx, ly);
  }
}

function drawGoalBanner(ctx: CanvasRenderingContext2D, w: number, h: number, mine: boolean, text: string) {
  ctx.fillStyle = 'rgba(18,50,79,0.45)';
  ctx.fillRect(0, h / 2 - 32, w, 64);
  ctx.font = `700 42px ${PIXEL_FONT}`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 6;
  ctx.strokeStyle = COLORS.ink;
  ctx.strokeText(text, w / 2, h / 2 + 14);
  ctx.fillStyle = mine ? COLORS.sun : '#fff';
  ctx.fillText(text, w / 2, h / 2 + 14);
}

export type { Point };

function shadeHex(hex: string, amt: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const c = (v: number) => Math.max(0, Math.min(255, v + amt));
  return '#' + [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
