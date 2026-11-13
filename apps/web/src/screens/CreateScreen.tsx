import { useState } from 'react';
import {
  computeOvr,
  newGame,
  validatePersonaInput,
  FEET,
  HAIR_COLORS,
  HAIR_STYLES,
  HEAD_SHAPES,
  POSITIONS,
  SKIN_TONES,
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
import { HAIR_HEX, SKIN_HEX } from '../art/avatarRects';

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

function Choice<T extends string>({ label, options, value, names, onChange }: {
  label: string;
  options: readonly T[];
  value: T;
  names: Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="chips tight">
        {options.map((o) => (
          <button key={o} type="button" className={o === value ? 'chip on' : 'chip'} aria-pressed={o === value} onClick={() => onChange(o)}>
            {names[o]}
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
  const [position, setPosition] = useState<Position>('ST');
  const [bonus, setBonus] = useState<Partial<Stats>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Appearance>(k: K, v: Appearance[K]) => setLook((prev) => ({ ...prev, [k]: v }));

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
            <Avatar appearance={look} kit={PREVIEW_KIT} scale={4} />
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
          <h2>{tx.appearanceTitle}</h2>
          {/* Paired rows keep the whole column on screen at 1366×768 */}
          <div className="look-row head-foot">
            <Choice label={tx.headShapeLabel} options={HEAD_SHAPES} value={look.headShape} names={tx.headShapes} onChange={(v) => set('headShape', v)} />
            <Choice label={tx.footLabel} options={FEET} value={look.foot} names={tx.feet} onChange={(v) => set('foot', v)} />
          </div>
          <Choice label={tx.hairStyleLabel} options={HAIR_STYLES} value={look.hairStyle} names={tx.hairStyles} onChange={(v) => set('hairStyle', v)} />
          <div className="look-row colors">
            <Swatches label={tx.skinToneLabel} options={SKIN_TONES} value={look.skinTone} names={tx.skinTones} colors={SKIN_HEX} onChange={(v) => set('skinTone', v)} />
            <Swatches label={tx.hairColorLabel} options={HAIR_COLORS} value={look.hairColor} names={tx.hairColors} colors={HAIR_HEX} onChange={(v) => set('hairColor', v)} />
          </div>
          <div className="slider-pair">
            <Slider label={tx.heightLabel} value={look.heightCm} min={C.HEIGHT_MIN_CM} max={C.HEIGHT_MAX_CM} text={tx.heightValue(look.heightCm)} onChange={(v) => set('heightCm', v)} />
            <Slider label={tx.weightLabel} value={look.weightKg} min={C.WEIGHT_MIN_KG} max={C.WEIGHT_MAX_KG} text={tx.weightValue(look.weightKg)} onChange={(v) => set('weightKg', v)} />
          </div>
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
