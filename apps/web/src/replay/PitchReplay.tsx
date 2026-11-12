import { useEffect, useMemo, useRef, useState } from 'react';
import type { Club, Match, MatchEvent, PitchPoint, Position } from '@futbolchi/engine';
import { uz } from '../i18n/uz';
import { eventText } from '../i18n/events';
import { buildTimeline, frameAt, type Frame } from './timeline';

/** Home formation (home attacks towards x = 100). Away is mirrored. */
const FORMATION: { pos: Position; x: number; y: number }[] = [
  { pos: 'GK', x: 5, y: 50 },
  { pos: 'CB', x: 20, y: 38 },
  { pos: 'CB', x: 20, y: 62 },
  { pos: 'FB', x: 24, y: 14 },
  { pos: 'FB', x: 24, y: 86 },
  { pos: 'CM', x: 40, y: 34 },
  { pos: 'CM', x: 40, y: 66 },
  { pos: 'CM', x: 46, y: 50 },
  { pos: 'W', x: 62, y: 16 },
  { pos: 'W', x: 62, y: 84 },
  { pos: 'ST', x: 68, y: 50 },
];

interface Props {
  match: Match;
  clubs: Record<string, Club>;
  personaName: string;
  personaPosition: Position;
  onFinished?: () => void;
}

const SPEEDS = [1, 2, 4];

export function PitchReplay({ match, clubs, personaName, personaPosition, onFinished }: Props) {
  const events = match.events;
  const { segments, total } = useMemo(() => buildTimeline(events), [events]);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const finishedRef = useRef(false);

  // Animation clock
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

  const frame = frameAt(events, segments, t);
  const current: MatchEvent | undefined = events[frame.eventIndex];

  // Draw
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
    drawFrame(ctx, w, h, frame, current, match, clubs, personaName, personaPosition);
  });

  const visible = events.slice(0, frame.eventIndex + (frame.arrived ? 1 : 0));
  const home = clubs[match.homeId];
  const away = clubs[match.awayId];
  const done = t >= total;
  const shownScore = done ? match.score : frame.score;
  const minute = done ? 90 : current?.minute ?? 0;

  return (
    <div className="replay">
      <div className="scoreboard">
        <span className="team" style={{ borderColor: home.color }}>{home.name}</span>
        <span className="score">
          {shownScore[0]} : {shownScore[1]}
        </span>
        <span className="team" style={{ borderColor: away.color }}>{away.name}</span>
        <span className="minute">{done ? uz.fullTime : `${minute}'`}</span>
      </div>
      <div ref={wrapRef} className="pitch-wrap">
        <canvas ref={canvasRef} className="pitch" aria-label="2D o'yin ko'rinishi" />
        {current && frame.arrived && !done && (
          <div className={`caption ${current.actor === 'persona' ? 'me' : ''}`}>
            {uz.eventIcons[current.type]} {eventText(current, match, clubs, personaName)}
          </div>
        )}
      </div>
      <div className="controls">
        <button onClick={() => (done ? (setT(0), (finishedRef.current = false), setPlaying(true)) : setPlaying(!playing))}>
          {playing ? uz.pause : uz.play}
        </button>
        <button onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}>
          {uz.speed}: {speed}×
        </button>
        <button onClick={() => setT(total)} disabled={done}>
          {uz.skip}
        </button>
      </div>
      <ol className="event-feed">
        {visible.length === 0 && done && <li className="muted">{uz.noEvents}</li>}
        {visible
          .map((e, i) => ({ e, i }))
          .reverse()
          .map(({ e, i }) => (
            <li
              key={e.id}
              className={e.actor === 'persona' ? 'me' : ''}
              onClick={() => {
                setT(segments[i].start);
                finishedRef.current = false;
              }}
            >
              <span className="min">{e.minute}'</span>
              <span>{uz.eventIcons[e.type]}</span>
              <span>{eventText(e, match, clubs, personaName)}</span>
            </li>
          ))}
      </ol>
    </div>
  );
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: Frame,
  current: MatchEvent | undefined,
  match: Match,
  clubs: Record<string, Club>,
  personaName: string,
  personaPosition: Position,
) {
  const X = (x: number) => (x / 100) * w;
  const Y = (y: number) => (y / 100) * h;

  // Grass
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 ? '#2f8f46' : '#2a8540';
    ctx.fillRect((i * w) / 10, 0, w / 10 + 1, h);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  const m = 4;
  ctx.strokeRect(m, m, w - 2 * m, h - 2 * m);
  ctx.beginPath();
  ctx.moveTo(w / 2, m);
  ctx.lineTo(w / 2, h - m);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, h * 0.13, 0, Math.PI * 2);
  ctx.stroke();
  for (const side of [0, 1]) {
    const bx = side ? w - m - w * 0.16 : m;
    ctx.strokeRect(bx, h * 0.2, w * 0.16, h * 0.6);
    const sx = side ? w - m - w * 0.055 : m;
    ctx.strokeRect(sx, h * 0.37, w * 0.055, h * 0.26);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(side ? w - m : 0, h * 0.44, m, h * 0.12);
  }

  // Players drift with the ball.
  const ball = frame.ball;
  const shiftX = (ball.x - 50) * 0.35;
  const shiftY = (ball.y - 50) * 0.15;
  const personaSide = match.personaSide;
  const personaSlot = FORMATION.findIndex((f) => f.pos === personaPosition);
  const personaPlaying = match.personaStats && match.personaStats.minutes > 0;
  const personaActing = current?.actor === 'persona';

  const drawTeam = (side: 'home' | 'away') => {
    const club = clubs[side === 'home' ? match.homeId : match.awayId];
    FORMATION.forEach((f, i) => {
      const bx = side === 'home' ? f.x : 100 - f.x;
      const by = side === 'home' ? f.y : 100 - f.y;
      let p: PitchPoint = {
        x: Math.min(97, Math.max(3, bx + (f.pos === 'GK' ? shiftX * 0.15 : shiftX))),
        y: Math.min(96, Math.max(4, by + shiftY)),
      };
      const isPersona = personaPlaying && side === personaSide && i === personaSlot;
      if (isPersona && personaActing && current && current.type !== 'substitution') {
        p = { x: ball.x - (side === 'home' ? 2 : -2), y: ball.y + 2 };
      }
      ctx.beginPath();
      ctx.arc(X(p.x), Y(p.y), isPersona ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = club.color;
      ctx.fill();
      ctx.lineWidth = isPersona ? 3 : 1.5;
      ctx.strokeStyle = isPersona ? '#ffd23f' : 'rgba(255,255,255,0.9)';
      ctx.stroke();
      if (isPersona) {
        ctx.font = '600 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd23f';
        ctx.fillText(personaName, X(p.x), Y(p.y) - 12);
      }
    });
  };
  drawTeam('home');
  drawTeam('away');

  // Ball
  ctx.beginPath();
  ctx.arc(X(ball.x), Y(ball.y), 5, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (current?.type === 'goal' && frame.arrived) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, h / 2 - 28, w, 56);
    ctx.font = '800 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = current.actor === 'persona' ? '#ffd23f' : '#fff';
    ctx.fillText('GOL!', w / 2, h / 2 + 12);
  }
}
