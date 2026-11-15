/**
 * The intro film as a list of scenes. Each scene is data plus a painter:
 * how long it lasts, its music mood and ambience, sound cues, subtitles,
 * a camera path and a paint() that draws one frame for time t.
 *
 * Story arc: talent (the hook) → dream → conflict with the parents → doubt and
 * resolve → the father's blessing → the academy gate → the career begins.
 *
 * To add another story (a transfer, the first goal, an injury), write a new
 * Scene[] in this format and give it to <IntroPlayer scenes={...}>.
 */
import type { IntroLineKey, IntroScript } from '../i18n/intro';
import type { Ambience, Mood, Sfx } from './audio';
import { ball, academy, bucket, chalkGoal, dastarxon, glow, hovliWall, ishkom, moon, phone, room, shadow, sky, skyline, sori, stars, tint, vignette, yard } from './sets';
import { breathe, camKeys, clamp01, keys, lerp, person, walkBob, type Cam, type Paint } from './stage';

export type Speaker = 'narrator' | 'thought' | 'hero' | 'dad' | 'mom' | 'kid' | 'coach';

export interface Line {
  at: number;
  end: number;
  who: Speaker;
  key: IntroLineKey;
}

export interface Scene {
  id: string;
  duration: number;
  /** Music mood changes during the scene: [time ms, mood]. */
  moods: [number, Mood][];
  ambience: Ambience;
  cues: { at: number; sfx: Sfx }[];
  lines: Line[];
  camera: (t: number) => Cam;
  paint: (p: Paint, script: IntroScript) => void;
  /** Full-resolution drawing on top of the frame (titles). */
  overlay?: (o: Overlay) => void;
}

export interface Overlay {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  t: number;
  script: IntroScript;
  tagline: string;
}

/** Faces in world units, for close-ups. */
const HERO_FACE = -72;
const DAD_FACE = -72;
const MOM_FACE = -65;
/** Camera height for a wide shot of standing people. */
const WIDE_Y = -58;

/** A short pixel-font text in the world (counters, "TAK!"). */
function worldText(p: Paint, text: string, x: number, y: number, size: number, color: string, alpha = 1) {
  p.world(1);
  const ctx = p.ctx;
  ctx.globalAlpha = alpha;
  ctx.font = `700 ${size}px "Pixelify Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1b1620';
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.globalAlpha = 1;
}

/** Hanging bulb under the trellis. */
function bulb(p: Paint, x: number, y: number) {
  p.world(1);
  p.ctx.fillStyle = '#2a2228';
  p.ctx.fillRect(x, -178, 1, y + 178);
  p.ctx.fillStyle = '#fff3b0';
  p.ctx.fillRect(x - 2, y, 5, 6);
}

// ------------------------------------------------------------------ 1. the yard at night (hook)
const BOUNCE = 520;
const JUGGLES = 12;
const KICK = 6800;
const HIT = 8800;
/** Hero's spot and the chalk goal on the wall (close enough for a vertical frame). */
const HX = 20;
const GOAL_X = -104;
const TARGET_X = -72;

const yardNight: Scene = {
  id: 'yard',
  duration: 12000,
  moods: [[0, 'warm']],
  ambience: 'crickets',
  cues: [
    ...Array.from({ length: JUGGLES + 1 }, (_, k) => ({ at: k * BOUNCE, sfx: 'bounce' as Sfx })),
    { at: KICK, sfx: 'kick' },
    { at: KICK + 120, sfx: 'whoosh' },
    { at: HIT, sfx: 'thud' },
    { at: HIT + 520, sfx: 'bounce' },
  ],
  lines: [
    { at: 1800, end: 5800, who: 'narrator', key: 'place' },
    { at: 9200, end: 11800, who: 'narrator', key: 'night' },
  ],
  camera: camKeys(
    [[0, HX], [2600, HX], [5200, -10], [KICK, -20], [KICK + 1000, -26], [HIT - 200, -30], [HIT, -48], [10200, -40], [12000, -26]],
    [[0, -38], [2600, -48], [5200, -70], [KICK, -56], [HIT, -48], [10200, -60], [12000, -80]],
    [[0, 3.6], [2600, 2.3], [5200, 1], [KICK, 1.3], [HIT - 200, 1.3], [HIT, 1.75], [9400, 1.65], [12000, 1]],
  ),
  paint(p) {
    const { t, cast } = p;
    const L = 0.22;
    sky(p, '#05081a', '#1a2044');
    stars(p);
    moon(p, -50, -112);
    skyline(p, '#0a0f24', '#16306a');
    hovliWall(p, L);
    chalkGoal(p, GOAL_X, L + 0.25);
    ishkom(p, L, -330, 60);
    sori(p, -330, L);
    yard(p, L);
    bucket(p, 92, L);
    // the hero juggles under the bulb
    const hx = HX;
    shadow(p, hx, 16);
    person(p.ctx, cast.heroSprite('stand'), hx, 0, { bob: breathe(t) });
    // the ball
    let bx: number;
    let by: number;
    let spin = t / 90;
    if (t < JUGGLES * BOUNCE) {
      const u = (t % BOUNCE) / BOUNCE;
      bx = hx + 6 + Math.sin(t / 700) * 2;
      by = -10 - 54 * 4 * u * (1 - u);
    } else if (t < KICK) {
      bx = hx + 8;
      by = -6;
      spin = 0;
    } else if (t < HIT) {
      // slow motion: the flight takes two full seconds
      const u = (t - KICK) / (HIT - KICK);
      bx = lerp(hx + 8, TARGET_X, u);
      by = -6 - 80 * 4 * u * (1 - u) - 30 * u;
      spin = t / 40;
    } else {
      const v = Math.min(1, (t - HIT) / 700);
      bx = TARGET_X + 14 * v;
      by = Math.min(-6, -36 + 40 * v * v);
    }
    shadow(p, bx, 5, 0.25);
    ball(p, bx, by, spin);
    // juggling counter pops next to the ball
    if (t < JUGGLES * BOUNCE) {
      const k = Math.floor(t / BOUNCE);
      const pop = 1 - ((t % BOUNCE) / BOUNCE) * 0.5;
      worldText(p, String(37 + k), hx + 22, -58, 8 + 3 * pop, '#f2c84b', pop);
    }
    if (t >= HIT && t < HIT + 900) worldText(p, 'TAK!', TARGET_X, -66, 14, '#ffffff', 1 - (t - HIT) / 900);
    bulb(p, HX - 10, -150);
    glow(p, HX - 10, -146, 170, '#ffcf7a', 0.55);
    glow(p, HX - 10, -146, 34, '#fff1c4', 0.5);
    vignette(p, 0.6);
  },
};

// ------------------------------------------------------------------ 2. the dream (the phone)
const dream: Scene = {
  id: 'dream',
  duration: 8000,
  moods: [[0, 'dream']],
  ambience: 'room',
  cues: [
    { at: 300, sfx: 'phone' },
    { at: 4400, sfx: 'whoosh' },
  ],
  lines: [{ at: 900, end: 7600, who: 'thought', key: 'dream' }],
  camera: camKeys([[0, 0], [8000, 0]], [[0, HERO_FACE + 8], [8000, HERO_FACE + 2]], [[0, 2.6], [3000, 2.8], [8000, 3.7]]),
  paint(p) {
    const { t, cast } = p;
    room(p, 0.18);
    person(p.ctx, cast.heroSprite('stand'), 0, 0, { bob: breathe(t, 300) });
    phone(p, 6, -44, 0.55);
    // light from the screen on the face, and a sparkle in the eyes
    glow(p, 0, HERO_FACE + 6, 50, '#4a8fd6', 0.4);
    if (t > 4600) {
      const a = 0.5 + 0.5 * Math.sin((t - 4600) / 160);
      p.world(1);
      p.ctx.globalAlpha = a;
      p.ctx.fillStyle = '#ffffff';
      for (const x of [-4.4, 3.2]) p.ctx.fillRect(x, HERO_FACE - 0.8, 0.8, 0.8);
      p.ctx.globalAlpha = 1;
    }
    vignette(p, 0.7);
  },
  overlay({ ctx, w, h, t, script }) {
    // what the hero sees: the academy's call-up on the phone
    const a = t < 300 ? t / 300 : t < 2700 ? 1 : Math.max(0, 1 - (t - 2700) / 500);
    if (a <= 0) return;
    const pw = Math.min(w * 0.62, h * 0.32);
    const ph = pw * 1.9;
    const x = w / 2 - pw / 2;
    const y = h * 0.44 - ph / 2 + (1 - a) * h * 0.05;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#111317';
    ctx.beginPath();
    ctx.roundRect(x, y, pw, ph, pw * 0.12);
    ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, y + ph);
    g.addColorStop(0, '#2f78b7');
    g.addColorStop(1, '#16365e');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x + pw * 0.05, y + pw * 0.06, pw * 0.9, ph - pw * 0.12, pw * 0.08);
    ctx.fill();
    ctx.fillStyle = '#f2c84b';
    ctx.fillRect(x + pw * 0.12, y + ph * 0.12, pw * 0.76, pw * 0.03);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    script.phone.forEach((line, i) => {
      ctx.font = `700 ${Math.round(pw * (i < 2 ? 0.11 : 0.085))}px "Pixelify Sans", sans-serif`;
      ctx.fillText(line, w / 2, y + ph * (0.27 + i * 0.12), pw * 0.84);
    });
    // a ball icon under the text
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w / 2, y + ph * 0.8, pw * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b1620';
    ctx.fillRect(w / 2 - pw * 0.03, y + ph * 0.8 - pw * 0.03, pw * 0.06, pw * 0.06);
    ctx.restore();
  },
};

// ------------------------------------------------------------------ 3. the talk with the parents
const DAD_X = -50;
const MOM_X = 50;
const LEAVE = 17200;

const talk: Scene = {
  id: 'talk',
  duration: 19500,
  moods: [[0, 'tense']],
  ambience: 'room',
  cues: [
    { at: 5000, sfx: 'heart' },
    { at: 15000, sfx: 'whoosh' },
    { at: LEAVE, sfx: 'step' },
    { at: LEAVE + 500, sfx: 'step' },
    { at: 18600, sfx: 'door' },
  ],
  lines: [
    { at: 1500, end: 4900, who: 'hero', key: 'heroAsk' },
    { at: 5100, end: 8400, who: 'dad', key: 'dad1' },
    { at: 8500, end: 12400, who: 'dad', key: 'dad2' },
    { at: 12500, end: 14900, who: 'mom', key: 'mom1' },
    { at: 15000, end: 17400, who: 'hero', key: 'heroHurt' },
  ],
  camera: camKeys(
    [[0, 0], [1100, 0], [1700, 0], [4900, 0], [5300, DAD_X], [12400, DAD_X], [12800, MOM_X], [14900, MOM_X], [15200, 0], [LEAVE, 0], [18400, 0], [19500, 0]],
    [[0, WIDE_Y], [1100, WIDE_Y], [1700, HERO_FACE], [4900, HERO_FACE], [5300, DAD_FACE], [12400, DAD_FACE], [12800, MOM_FACE], [14900, MOM_FACE], [15200, HERO_FACE], [LEAVE, HERO_FACE], [18400, WIDE_Y], [19500, WIDE_Y]],
    [[0, 1], [1100, 1], [1700, 2.6], [4900, 2.6], [5300, 2.6], [8500, 2.7], [12400, 3.1], [12800, 2.8], [14900, 2.8], [15200, 3.2], [LEAVE, 3.2], [18400, 1.05], [19500, 1]],
  ),
  paint(p) {
    const { t, cast } = p;
    room(p, 1);
    person(p.ctx, cast.dad(), DAD_X, 0, { bob: breathe(t, 0) });
    person(p.ctx, cast.mom(), MOM_X, 0, { bob: breathe(t, 500) });
    // the hero walks out to the right after the outburst
    const leaving = clamp01((t - LEAVE) / 1500);
    const hx = lerp(0, 280, leaving);
    if (hx < 260) person(p.ctx, cast.heroSprite('stand'), hx, 0, { bob: leaving > 0 && leaving < 1 ? walkBob(t) : breathe(t, 900) });
    dastarxon(p, 0, 1);
    // warm lamp light from above
    glow(p, 0, -220, 260, '#ffd89a', 0.25);
    vignette(p, 0.5);
    if (t > 18600) tint(p, '#000000', 0.25 * clamp01((t - 18600) / 600));
  },
};

// ------------------------------------------------------------------ 4. alone at night: doubt and resolve
const RESOLVE = 6000;
const alone: Scene = {
  id: 'alone',
  duration: 10000,
  moods: [[0, 'night'], [RESOLVE, 'hope']],
  ambience: 'wind',
  cues: [
    { at: 5200, sfx: 'heart' },
    { at: RESOLVE, sfx: 'hit' },
  ],
  lines: [
    { at: 1400, end: 4800, who: 'thought', key: 'doubt' },
    { at: RESOLVE + 200, end: 9700, who: 'thought', key: 'prove' },
  ],
  camera: camKeys(
    [[0, 40], [RESOLVE, 40], [10000, 40]],
    [[0, -80], [RESOLVE - 400, HERO_FACE], [10000, HERO_FACE]],
    [[0, 1.1], [RESOLVE - 400, 2.6], [RESOLVE, 3.3], [RESOLVE + 300, 3.1], [10000, 3.4]],
  ),
  paint(p) {
    const { t, cast } = p;
    const L = 0.12;
    sky(p, '#03050f', '#141a38');
    stars(p, 0.8);
    moon(p, 30, -112);
    skyline(p, '#070a18', '#101f44');
    hovliWall(p, L);
    yard(p, L);
    shadow(p, 40, 16, 0.35);
    person(p.ctx, cast.heroSprite(t < RESOLVE ? 'ball_arm' : 'hands_hips'), 40, 0, { bob: breathe(t, 200) });
    // cold moonlight, then a warmer light on the face at the moment of resolve
    glow(p, 40, -150, 260, '#8fa8ff', 0.18);
    if (t > RESOLVE) glow(p, 40, HERO_FACE, 70, '#ffcf7a', 0.25 * clamp01((t - RESOLVE) / 800));
    tint(p, '#0a1230', 0.25);
    vignette(p, 0.75);
  },
};

// ------------------------------------------------------------------ 5. dawn: the gift and the blessing
const MOM_IN = 3000;
const GIFT = 6400;
const DAD_TALK = 8200;
const DOOR_X = 130;

const gift: Scene = {
  id: 'gift',
  duration: 14500,
  moods: [[0, 'hope']],
  ambience: 'birds',
  cues: [
    { at: 400, sfx: 'step' },
    { at: 1200, sfx: 'step' },
    { at: 2000, sfx: 'step' },
    { at: GIFT, sfx: 'cloth' },
    { at: DAD_TALK, sfx: 'whoosh' },
    { at: 11400, sfx: 'heart' },
  ],
  lines: [
    { at: MOM_IN, end: GIFT + 600, who: 'mom', key: 'momGift' },
    { at: DAD_TALK - 600, end: 12600, who: 'mom', key: 'momFather' },
  ],
  // the father does not come out: the camera looks at the closed gate, then back at the hero
  camera: camKeys(
    [[0, -60], [MOM_IN, -50], [GIFT + 600, -40], [7600, DOOR_X - 30], [DAD_TALK, DOOR_X - 10], [10600, DOOR_X - 10], [11400, -20], [14500, -20]],
    [[0, WIDE_Y], [MOM_IN, -66], [GIFT + 600, -56], [DAD_TALK, -70], [10600, -70], [11400, HERO_FACE], [14500, HERO_FACE]],
    [[0, 1], [MOM_IN, 1.7], [GIFT + 600, 2], [7600, 1.6], [DAD_TALK, 1.9], [10600, 2], [11400, 2.8], [14500, 3.1]],
  ),
  paint(p) {
    const { t, cast } = p;
    const L = 0.85;
    sky(p, '#f2a65a', '#ffd9a0');
    skyline(p, '#c27a5a', '#3a6aa8');
    hovliWall(p, L);
    ishkom(p, L, -330, 60);
    sori(p, -300, L);
    yard(p, L);
    // mother walks in from the left with some money for the road
    const mx = lerp(-190, -70, clamp01(t / MOM_IN));
    person(p.ctx, cast.mom(), mx, 0, { bob: t < MOM_IN ? walkBob(t) : breathe(t, 400) });
    const hx = -20;
    const nod = t > 13000 && t < 13600 ? 1 : 0;
    const bob = breathe(t, 700) - nod;
    person(p.ctx, cast.heroSprite('stand'), hx, 0, { bob });
    p.world(1);
    // the bag on the hero's shoulder
    p.ctx.drawImage(cast.bag(), hx + 6, -66 - bob, 22, 16);
    // the money passes from her hands to the hero's
    const u = clamp01((t - GIFT) / 600);
    const bx = lerp(mx - 7, hx - 9, u);
    const by = lerp(-38, -42, u);
    p.ctx.drawImage(cast.money(), bx, by, 15, 9);
    glow(p, -200, -260, 320, '#ffcf8a', 0.25);
    vignette(p, 0.35);
  },
};

// ------------------------------------------------------------------ 6. the academy gate
const LAUGH = 4000;
const LOOK = 6500;
const gate: Scene = {
  id: 'gate',
  duration: 11000,
  moods: [[0, 'hope'], [LOOK, 'rise']],
  ambience: 'pitch',
  cues: [
    { at: 300, sfx: 'step' },
    { at: 900, sfx: 'step' },
    { at: 1500, sfx: 'step' },
    { at: 2100, sfx: 'step' },
    { at: LAUGH + 100, sfx: 'laugh' },
    { at: LOOK + 100, sfx: 'heart' },
    { at: LOOK + 600, sfx: 'hit' },
  ],
  lines: [
    { at: 500, end: 3400, who: 'narrator', key: 'academy' },
    { at: LAUGH, end: LOOK - 100, who: 'kid', key: 'kidLaugh' },
    { at: LOOK + 600, end: 10700, who: 'thought', key: 'promise' },
  ],
  camera: camKeys(
    [[0, -120], [3500, -40], [LAUGH, 150], [LOOK - 200, 150], [LOOK, -30], [11000, -30]],
    [[0, -70], [3500, WIDE_Y], [LAUGH, -66], [LOOK - 200, -66], [LOOK, HERO_FACE], [11000, HERO_FACE]],
    [[0, 1.1], [3500, 1.3], [LAUGH, 1.9], [LOOK - 200, 2.1], [LOOK, 3.3], [11000, 3.8]],
  ),
  paint(p, s) {
    const { t, cast } = p;
    sky(p, '#7ec3f0', '#d8f0ff');
    academy(p, s.academySign);
    // academy kids warming up behind the gate line
    person(p.ctx, cast.kid(0), 120, 0, { bob: breathe(t, 100) });
    person(p.ctx, cast.kid(1, 'arms_crossed'), 170, 0, { bob: t > LAUGH && t < LOOK ? walkBob(t * 1.6) : breathe(t, 600) });
    person(p.ctx, cast.kid(2), 220, 0, { bob: breathe(t, 900) });
    const kb = Math.abs(Math.sin(t / 300)) * 26;
    ball(p, 132, -8 - kb, t / 80);
    // the hero walks in with a bag on the shoulder
    const hx = lerp(-260, -30, clamp01(t / 3500));
    shadow(p, hx, 16);
    person(p.ctx, cast.heroSprite('stand'), hx, 0, { bob: t < 3500 ? walkBob(t) : breathe(t) });
    p.world(1);
    p.ctx.drawImage(cast.bag(), hx + 6, -66 - (t < 3500 ? walkBob(t) : 0), 22, 16);
    if (t > LAUGH && t < LOOK) {
      const a = Math.sin(((t - LAUGH) / (LOOK - LAUGH)) * Math.PI);
      for (let k = 0; k < 2; k++) {
        const ly = -112 - k * 10 - ((t / 20) % 10);
        p.ctx.globalAlpha = a;
        p.ctx.font = '700 7px "Pixelify Sans", sans-serif';
        p.ctx.fillStyle = '#1b1620';
        p.ctx.fillText('ha', 182 + k * 8, ly);
        p.ctx.globalAlpha = 1;
      }
    }
    glow(p, -300, -300, 400, '#fff2c8', 0.25);
    vignette(p, 0.35);
  },
};

// ------------------------------------------------------------------ 7. the coach
const COACH_X = 62;
const COACH_FACE = -72;
const COACH_IN = 2400;
const JUGGLE_AT = 10900;
const JUGGLE_END = 12500;

const coach: Scene = {
  id: 'coach',
  duration: 16600,
  moods: [[0, 'tense'], [JUGGLE_AT, 'hope']],
  ambience: 'pitch',
  cues: [
    ...[300, 900, 1500, 2100].map((at) => ({ at, sfx: 'step' as Sfx })),
    { at: COACH_IN + 100, sfx: 'heart' },
    ...Array.from({ length: 4 }, (_, k) => ({ at: JUGGLE_AT + k * 400, sfx: 'bounce' as Sfx })),
    { at: JUGGLE_END + 200, sfx: 'hit' },
  ],
  lines: [
    { at: COACH_IN, end: 4800, who: 'coach', key: 'coachStop' },
    { at: 4900, end: 6300, who: 'coach', key: 'coachAsk' },
    { at: 6400, end: 7600, who: 'hero', key: 'heroAnswer' },
    { at: 7700, end: 10800, who: 'coach', key: 'coachIntro' },
    { at: JUGGLE_END, end: 16400, who: 'coach', key: 'coachVerdict' },
  ],
  camera: camKeys(
    [[0, 140], [COACH_IN, COACH_X], [6300, COACH_X], [6500, -30], [7600, -30], [7800, COACH_X], [10600, COACH_X], [JUGGLE_AT, 16], [JUGGLE_END, 16], [12800, COACH_X], [16600, COACH_X]],
    [[0, WIDE_Y], [COACH_IN, COACH_FACE], [6300, COACH_FACE], [6500, HERO_FACE], [7600, HERO_FACE], [7800, COACH_FACE], [10600, COACH_FACE], [JUGGLE_AT, -54], [JUGGLE_END, -54], [12800, COACH_FACE], [16600, COACH_FACE]],
    [[0, 1.1], [COACH_IN, 2.6], [6300, 2.7], [6500, 2.9], [7600, 3], [7800, 2.7], [10600, 2.9], [JUGGLE_AT, 1.35], [JUGGLE_END, 1.35], [12800, 2.7], [16600, 3]],
  ),
  paint(p, s) {
    const { t, cast } = p;
    sky(p, '#7ec3f0', '#d8f0ff');
    academy(p, s.academySign);
    // the kids go quiet when the coach arrives
    person(p.ctx, cast.kid(0), 150, 0, { bob: breathe(t, 100) });
    person(p.ctx, cast.kid(1, 'arms_crossed'), 195, 0, { bob: t < COACH_IN ? walkBob(t * 1.6) : breathe(t, 600) });
    person(p.ctx, cast.kid(2), 240, 0, { bob: breathe(t, 900) });
    // the coach walks in from the right
    const cx = lerp(300, COACH_X, clamp01(t / COACH_IN));
    shadow(p, cx, 16);
    person(p.ctx, cast.coach(), cx, 0, { bob: t < COACH_IN ? walkBob(t) : breathe(t, 300) });
    // the hero, and a few touches of the ball when asked
    const hx = -30;
    shadow(p, hx, 16);
    person(p.ctx, cast.heroSprite('stand'), hx, 0, { bob: breathe(t) });
    p.world(1);
    p.ctx.drawImage(cast.bag(), hx - 40, -16, 22, 16);
    if (t >= JUGGLE_AT && t < JUGGLE_END + 600) {
      const k = Math.min(1, (t - JUGGLE_AT) / (JUGGLE_END - JUGGLE_AT));
      const u = ((t - JUGGLE_AT) % 400) / 400;
      const by = t < JUGGLE_END ? -10 - 46 * 4 * u * (1 - u) : -6;
      ball(p, hx + 8, by, t / 70);
      if (t < JUGGLE_END) worldText(p, String(1 + Math.floor(k * 4)), hx + 26, -58, 10, '#f2c84b');
    } else ball(p, hx + 10, -6, 0);
    glow(p, -300, -300, 400, '#fff2c8', 0.25);
    vignette(p, 0.35);
  },
};

// ------------------------------------------------------------------ 8. title: the career begins
const title: Scene = {
  id: 'title',
  duration: 7000,
  moods: [[0, 'title']],
  ambience: 'pitch',
  cues: [{ at: 300, sfx: 'hit' }],
  lines: [],
  camera: camKeys([[0, 0], [7000, 0]], [[0, HERO_FACE + 10], [7000, -90]], [[0, 2.6], [7000, 1.05]]),
  paint(p, s) {
    const { t, cast } = p;
    sky(p, '#ffb36a', '#ffe7b8');
    academy(p, s.academySign);
    person(p.ctx, cast.heroSprite('hands_hips'), -16, 0, { bob: breathe(t) });
    person(p.ctx, cast.coachMatch(), 34, 0, { bob: breathe(t, 500) });
    glow(p, 0, -320, 420, '#ffd27a', 0.35);
    vignette(p, 0.45);
  },
  overlay({ ctx, w, h, t, tagline }) {
    const a = clamp01((t - 600) / 900);
    const big = Math.round(Math.min(w * 0.12, h * 0.09));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${big}px "Pixelify Sans", sans-serif`;
    ctx.fillStyle = 'rgba(10,20,40,0.55)';
    ctx.fillText('FUTBOLCHI PRO', w / 2 + big * 0.06, h * 0.2 + big * 0.06);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('FUTBOLCHI PRO', w / 2, h * 0.2);
    const b = clamp01((t - 1800) / 800);
    ctx.globalAlpha = b;
    ctx.font = `700 ${Math.round(big * 0.38)}px "Nunito", sans-serif`;
    ctx.fillStyle = '#1b2a44';
    ctx.fillText(tagline, w / 2, h * 0.2 + big * 0.95);
    ctx.restore();
  },
};

/** The opening story, in order. */
export const OPENING: Scene[] = [yardNight, dream, talk, alone, gift, gate, coach, title];

/** Total length of a film in ms. */
export const filmLength = (scenes: Scene[]) => scenes.reduce((s, sc) => s + sc.duration, 0);

export { keys };
