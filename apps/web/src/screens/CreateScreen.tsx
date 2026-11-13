import { useState } from 'react';
import {
  computeOvr,
  newGame,
  validatePersonaInput,
  ACCESSORIES,
  BOOT_COLORS,
  BROWS,
  CELEBRATIONS,
  EYE_COLORS,
  FACIAL_HAIR,
  FEET,
  HAIR_COLORS,
  HAIR_STYLES,
  HEAD_SHAPES,
  NOSES,
  POSITIONS,
  SKIN_TONES,
  SLEEVES,
  STAT_KEYS,
  constants as C,
  type Appearance,
  type GameState,
  type Position,
  type Stats,
} from '@futbolchi/engine';
import { tx } from '../i18n';
import { api } from '../state/api';
import { getUserId } from '../state/store';
import { Avatar } from '../art/Avatar';
import { BOOT_HEX, EYE_HEX, HAIR_HEX, POSE_CYCLE, SKIN_HEX, type Pose } from '../art/avatarRects';

interface Props {
  /** Registered on the main menu. */
  name: string;
  /** Paid (or admin-granted) persona slot that this creation will use. */
  entitlementId: string;
  onCreated: (state: GameState) => void;
}

/** Kit shown in the preview; the real club colour is only known after creation. */
const PREVIEW_KIT = '#2f78b7';
const randomSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0];
const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

type LookTab = 'face' | 'hair' | 'body' | 'kit';
const LOOK_TABS: LookTab[] = ['face', 'hair', 'body', 'kit'];
const TAB_ICONS: Record<LookTab, string> = { face: '🙂', hair: '💇', body: '📏', kit: '👕' };

/** A random, valid look (cosmetic only, so Math.random is fine here). */
function randomLook(prev: Appearance): Appearance {
  const tall = C.HEIGHT_MIN_CM + Math.round(Math.random() * (C.HEIGHT_MAX_CM - C.HEIGHT_MIN_CM));
  // Weight loosely follows height so random players look plausible.
  const base = 55 + (tall - C.HEIGHT_MIN_CM) * 0.75;
  const weight = Math.max(C.WEIGHT_MIN_KG, Math.min(C.WEIGHT_MAX_KG, Math.round(base + (Math.random() - 0.3) * 14)));
  return {
    ...prev,
    headShape: pick(HEAD_SHAPES),
    skinTone: pick(SKIN_TONES),
    hairStyle: pick(HAIR_STYLES),
    hairColor: pick(HAIR_COLORS),
    eyeColor: pick(EYE_COLORS),
    brows: pick(BROWS),
    nose: pick(NOSES),
    facialHair: Math.random() < 0.55 ? 'none' : pick(FACIAL_HAIR),
    heightCm: tall,
    weightKg: weight,
    boots: pick(BOOT_COLORS),
    sleeves: Math.random() < 0.75 ? 'short' : 'long',
    accessory: Math.random() < 0.6 ? 'none' : pick(ACCESSORIES),
    celebration: pick(CELEBRATIONS),
  };
}

function Choice<T extends string>({ label, options, value, names, onChange, cols, inline }: {
  label: string;
  options: readonly T[];
  value: T;
  names: Record<T, string>;
  onChange: (v: T) => void;
  cols?: number;
  /** Label on the left, chips on the right (saves height). */
  inline?: boolean;
}) {
  return (
    <div className={inline ? 'field inline' : 'field'}>
      <span>{label}</span>
      <div className="chips tight" style={cols ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } : undefined}>
        {options.map((o) => (
          <button key={o} type="button" className={o === value ? 'chip on' : 'chip'} aria-pressed={o === value} onClick={() => onChange(o)}>
            {names[o]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Chips that show a small portrait of the player with that option applied. */
function Portraits<K extends 'hairStyle' | 'facialHair' | 'headShape'>({ label, field, options, look, names, onChange }: {
  label: string;
  field: K;
  options: readonly Appearance[K][];
  look: Appearance;
  names: Record<Appearance[K], string>;
  onChange: (v: Appearance[K]) => void;
}) {
  return (
    <div className="field">
      <span>{label}: <b>{names[look[field]]}</b></span>
      <div className="portraits">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            className={o === look[field] ? 'portrait on' : 'portrait'}
            aria-pressed={o === look[field]}
            aria-label={names[o]}
            title={names[o]}
            onClick={() => onChange(o)}
          >
            <Avatar appearance={{ ...look, [field]: o }} kit={PREVIEW_KIT} scale={1.25} crop="bust" />
          </button>
        ))}
      </div>
    </div>
  );
}

function Swatches<T extends string>({ label, options, value, names, colors, onChange }: {
  label: string;
  options: readonly T[];
  value: T;
  names: Record<T, string>;
  colors: Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="field">
      <span>{label}: <b>{names[value]}</b></span>
      <div className="swatches">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            className={o === value ? 'swatch on' : 'swatch'}
            style={{ background: colors[o] }}
            aria-label={names[o]}
            title={names[o]}
            aria-pressed={o === value}
            onClick={() => onChange(o)}
          />
        ))}
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, text, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  text: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="field slider">
      <span>{label}: <b>{text}</b></span>
      <input type="range" min={min} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function CreateScreen({ name, entitlementId, onCreated }: Props) {
  const [look, setLook] = useState<Appearance>({ ...C.DEFAULT_APPEARANCE });
  const [tab, setTab] = useState<LookTab>('face');
  /** Tabs the player has opened; unopened ones are flagged so none is missed. */
  const [seen, setSeen] = useState<Set<LookTab>>(() => new Set(['face']));
  const [pose, setPose] = useState<Pose>('stand');
  const [position, setPosition] = useState<Position>('ST');
  const [bonus, setBonus] = useState<Partial<Stats>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Appearance>(k: K, v: Appearance[K]) => setLook((prev) => ({ ...prev, [k]: v }));

  const openTab = (t: LookTab) => {
    setTab(t);
    setSeen((prev) => new Set(prev).add(t));
  };
  const nextTab = LOOK_TABS[LOOK_TABS.indexOf(tab) + 1];
  /** The ball button walks through football poses and celebrations, then back to standing. */
  const nextPose = () => {
    const i = pose === 'stand' ? -1 : POSE_CYCLE.indexOf(pose as (typeof POSE_CYCLE)[number]);
    setPose(i + 1 < POSE_CYCLE.length ? POSE_CYCLE[i + 1] : 'stand');
  };
  const poseName = pose === 'stand' ? null : (tx.poseNames as Record<string, string>)[pose] ?? tx.celebrations[pose as keyof typeof tx.celebrations];

  const used = STAT_KEYS.reduce((a, k) => a + (bonus[k] ?? 0), 0);
  const left = C.BONUS_POINTS_TOTAL - used;
  const preview = { ...C.STAT_TEMPLATES[position] };
  for (const k of STAT_KEYS) preview[k] += bonus[k] ?? 0;
  const validation = validatePersonaInput({ name, position, bonus, appearance: look });

  const adjust = (k: keyof Stats, d: number) => {
    const v = (bonus[k] ?? 0) + d;
    if (v < 0 || v > C.BONUS_POINTS_PER_STAT_MAX || (d > 0 && left <= 0)) return;
    setBonus({ ...bonus, [k]: v });
  };

  const create = async () => {
    if (validation || busy) return;
    setBusy(true);
    setError(null);
    try {
      const personaId = crypto.randomUUID();
      const state = newGame({ seed: randomSeed(), persona: { id: personaId, name, position, bonus, appearance: look } });
      await api.consume(entitlementId, getUserId(), personaId);
      onCreated(state);
    } catch {
      setError(tx.serverDown);
      setBusy(false);
    }
  };

  return (
    <div className="screen panel create">
      <header className="panel-head create-head">
        <p className="success">{tx.createPaid}</p>
        <h1>{tx.createTitle}</h1>
      </header>

      <div className="panel-body create-grid">
        <section className="create-preview">
          <div className="avatar-stage">
            <button type="button" className="stage-btn left" title={tx.lookRandom} aria-label={tx.lookRandom} onClick={() => setLook((prev) => randomLook(prev))}>🎲</button>
            <button type="button" className="stage-btn right" title={tx.lookPose} aria-label={tx.lookPose} onClick={nextPose}>⚽</button>
            {poseName && <span className="pose-name">{poseName}</span>}
            <Avatar appearance={look} kit={PREVIEW_KIT} scale={2} pose={pose} className="avatar-big" />
            <strong>{name}</strong>
            <span className="muted small">
              {tx.heightValue(look.heightCm)} · {tx.weightValue(look.weightKg)}
            </span>
          </div>
          <div className="preview-ovr">
            <span className="ovr">
              <strong>{Math.round(computeOvr(preview, position))}</strong>
              <small>{tx.ovr}</small>
            </span>
            <span>
              <b>{position}</b> {tx.positions[position]}
            </span>
          </div>
        </section>

        <section className="create-look">
          <div className="look-head">
            <h2>{tx.appearanceTitle}</h2>
            <span className={seen.size === LOOK_TABS.length ? 'look-progress done' : 'look-progress'}>
              {tx.lookProgress(seen.size, LOOK_TABS.length)}
            </span>
          </div>
          <nav className="look-tabs" role="tablist">
            {LOOK_TABS.map((t, i) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={['look-tab', tab === t ? 'on' : '', seen.has(t) ? 'seen' : 'new'].join(' ')}
                onClick={() => openTab(t)}
              >
                <span className="look-icon" aria-hidden>{TAB_ICONS[t]}</span>
                <span className="look-label">
                  <small>{i + 1}</small> {tx.lookTabs[t]}
                </span>
                {!seen.has(t) && <i className="new-dot" aria-hidden />}
              </button>
            ))}
          </nav>

          {tab === 'face' && (
            <>
              <Choice label={tx.headShapeLabel} options={HEAD_SHAPES} value={look.headShape} names={tx.headShapes} onChange={(v) => set('headShape', v)} cols={4} />
              <Swatches label={tx.skinToneLabel} options={SKIN_TONES} value={look.skinTone} names={tx.skinTones} colors={SKIN_HEX} onChange={(v) => set('skinTone', v)} />
              <Swatches label={tx.eyeColorLabel} options={EYE_COLORS} value={look.eyeColor} names={tx.eyeColors} colors={EYE_HEX} onChange={(v) => set('eyeColor', v)} />
              <Choice label={tx.browsLabel} options={BROWS} value={look.brows} names={tx.browsNames} onChange={(v) => set('brows', v)} cols={3} inline />
              <Choice label={tx.noseLabel} options={NOSES} value={look.nose} names={tx.noses} onChange={(v) => set('nose', v)} cols={3} inline />
            </>
          )}

          {tab === 'hair' && (
            <>
              <Portraits label={tx.hairStyleLabel} field="hairStyle" options={HAIR_STYLES} look={look} names={tx.hairStyles} onChange={(v) => set('hairStyle', v)} />
              <Swatches label={tx.hairColorLabel} options={HAIR_COLORS} value={look.hairColor} names={tx.hairColors} colors={HAIR_HEX} onChange={(v) => set('hairColor', v)} />
              <Portraits label={tx.facialHairLabel} field="facialHair" options={FACIAL_HAIR} look={look} names={tx.facialHairNames} onChange={(v) => set('facialHair', v)} />
            </>
          )}

          {tab === 'body' && (
            <>
              <Slider label={tx.heightLabel} value={look.heightCm} min={C.HEIGHT_MIN_CM} max={C.HEIGHT_MAX_CM} text={tx.heightValue(look.heightCm)} onChange={(v) => set('heightCm', v)} />
              <Slider label={tx.weightLabel} value={look.weightKg} min={C.WEIGHT_MIN_KG} max={C.WEIGHT_MAX_KG} text={tx.weightValue(look.weightKg)} onChange={(v) => set('weightKg', v)} />
              <Choice label={tx.footLabel} options={FEET} value={look.foot} names={tx.feet} onChange={(v) => set('foot', v)} cols={2} />
            </>
          )}

          {tab === 'kit' && (
            <>
              <Swatches label={tx.bootsLabel} options={BOOT_COLORS} value={look.boots} names={tx.bootColors} colors={BOOT_HEX} onChange={(v) => set('boots', v)} />
              <Choice label={tx.sleevesLabel} options={SLEEVES} value={look.sleeves} names={tx.sleevesNames} onChange={(v) => set('sleeves', v)} cols={2} />
              <Choice label={tx.accessoryLabel} options={ACCESSORIES} value={look.accessory} names={tx.accessories} onChange={(v) => set('accessory', v)} cols={3} />
              <Choice
                label={tx.celebrationLabel}
                options={CELEBRATIONS}
                value={look.celebration}
                names={tx.celebrations}
                cols={2}
                onChange={(v) => {
                  set('celebration', v);
                  setPose(v);
                }}
              />
              <p className="muted small">{tx.lookKitNote}</p>
            </>
          )}
          {nextTab && (
            <button type="button" className="look-next" onClick={() => openTab(nextTab)}>
              {tx.lookNext(tx.lookTabs[nextTab])} →
            </button>
          )}
        </section>

        <section className="create-skills">
          <h2>{tx.skillsTitle}</h2>
          <div className="field">
            <div className="chips pos-chips" role="group" aria-label={tx.positionLabel}>
              {POSITIONS.map((p) => (
                <button key={p} type="button" className={p === position ? 'chip on' : 'chip'} aria-pressed={p === position} onClick={() => { setPosition(p); setBonus({}); }}>
                  <b>{p}</b> {tx.positions[p]}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>{tx.bonusLabel(left)}</span>
            <ul className="stat-edit">
              {STAT_KEYS.map((k) => (
                <li key={k} className={C.POSITION_WEIGHTS[position][k] >= 0.15 ? 'key' : ''}>
                  <span className="label">{tx.stats[k]}</span>
                  <button type="button" onClick={() => adjust(k, -1)} disabled={!bonus[k]} aria-label={`${tx.stats[k]} −`}>−</button>
                  <span className="val">
                    {preview[k]}
                    {bonus[k] ? <small> +{bonus[k]}</small> : null}
                  </span>
                  <button type="button" onClick={() => adjust(k, 1)} disabled={left <= 0 || (bonus[k] ?? 0) >= C.BONUS_POINTS_PER_STAT_MAX} aria-label={`${tx.stats[k]} +`}>+</button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <footer className="panel-foot">
        {error && <p className="error">{error}</p>}
        {validation && <p className="error">{tx.errors[validation] ?? validation}</p>}
        <button className="primary big" disabled={!!validation || busy} onClick={create}>
          {tx.createButton}
        </button>
      </footer>
    </div>
  );
}
