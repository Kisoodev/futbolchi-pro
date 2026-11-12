import { useEffect, useState } from 'react';
import {
  computeOvr,
  newGame,
  validatePersonaInput,
  POSITIONS,
  STAT_KEYS,
  constants as C,
  type GameState,
  type Position,
  type Stats,
} from '@futbolchi/engine';
import { uz } from '../i18n/uz';
import { api, formatUzs } from '../state/api';
import { getUserId, rememberEntitlement } from '../state/store';

type Step = 'checking' | 'pay' | 'checkout' | 'waiting' | 'form';

interface Props {
  onCreated: (state: GameState) => void;
  onBack: () => void;
}

const randomSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0];

export function CreateScreen({ onCreated, onBack }: Props) {
  const userId = getUserId();
  const [step, setStep] = useState<Step>('checking');
  const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [entitlementId, setEntitlementId] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [position, setPosition] = useState<Position>('ST');
  const [bonus, setBonus] = useState<Partial<Stats>>({});
  const [busy, setBusy] = useState(false);

  // Is there already a paid, unused persona slot?
  useEffect(() => {
    (async () => {
      try {
        const [{ entitlements }, product] = await Promise.all([api.entitlements(userId), api.product()]);
        setPrice(product.amountMinor);
        const free = entitlements.find((e) => e.consumedByPersonaId === null);
        if (free) {
          setEntitlementId(free.id);
          setStep('form');
        } else setStep('pay');
      } catch {
        setError(uz.serverDown);
        setStep('pay');
      }
    })();
  }, [userId]);

  const startPayment = async () => {
    setError(null);
    try {
      const p = await api.createPayment(userId);
      setPaymentId(p.paymentId);
      // TODO(payme/click): redirect to p.checkoutUrl instead of showing the mock panel.
      setStep('checkout');
    } catch {
      setError(uz.serverDown);
    }
  };

  const mockCheckout = async (outcome: 'success' | 'fail') => {
    if (!paymentId) return;
    setStep('waiting');
    try {
      await api.mockPay(paymentId, outcome);
      for (let i = 0; i < 20; i++) {
        const { status } = await api.paymentStatus(paymentId);
        if (status === 'paid') {
          const [{ entitlements }, { receipts }] = await Promise.all([api.entitlements(userId), api.receipts(userId)]);
          const ent = entitlements.find((e) => e.paymentId === paymentId);
          setEntitlementId(ent?.id ?? null);
          setReceiptId(receipts.find((r) => r.paymentId === paymentId)?.id ?? null);
          setStep('form');
          return;
        }
        if (status === 'failed') break;
        await new Promise((r) => setTimeout(r, 400));
      }
      setError(uz.payFailed);
      setStep('pay');
    } catch {
      setError(uz.serverDown);
      setStep('pay');
    }
  };

  const used = STAT_KEYS.reduce((a, k) => a + (bonus[k] ?? 0), 0);
  const left = C.BONUS_POINTS_TOTAL - used;
  const preview = { ...C.STAT_TEMPLATES[position] };
  for (const k of STAT_KEYS) preview[k] += bonus[k] ?? 0;
  const validation = validatePersonaInput({ name, position, bonus });

  const adjust = (k: keyof Stats, d: number) => {
    const v = (bonus[k] ?? 0) + d;
    if (v < 0 || v > C.BONUS_POINTS_PER_STAT_MAX || (d > 0 && left <= 0)) return;
    setBonus({ ...bonus, [k]: v });
  };

  const create = async () => {
    if (validation || !entitlementId) return;
    setBusy(true);
    setError(null);
    try {
      const personaId = crypto.randomUUID();
      const state = newGame({ seed: randomSeed(), persona: { id: personaId, name, position, bonus } });
      await api.consume(entitlementId, userId, personaId);
      rememberEntitlement(null);
      onCreated(state);
    } catch {
      setError(uz.serverDown);
      setBusy(false);
    }
  };

  if (step === 'checking') return <div className="screen center">{uz.loading}</div>;

  if (step !== 'form') {
    return (
      <div className="screen narrow">
        <button className="link" onClick={onBack}>← {uz.back}</button>
        <h1>{uz.payTitle}</h1>
        <p>{uz.payText}</p>
        {price !== null && <p className="price">{uz.payPrice(formatUzs(price))}</p>}
        {error && <p className="error">{error}</p>}
        {step === 'pay' && (
          <button className="primary big" onClick={startPayment}>
            {uz.payButton}
          </button>
        )}
        {step === 'checkout' && (
          <div className="mock-checkout">
            <p className="notice">{uz.payMockNotice}</p>
            <div className="row">
              <button className="primary" onClick={() => mockCheckout('success')}>{uz.payConfirm}</button>
              <button onClick={() => mockCheckout('fail')}>{uz.payDecline}</button>
            </div>
          </div>
        )}
        {step === 'waiting' && <p className="muted">{uz.payWaiting}</p>}
      </div>
    );
  }

  return (
    <div className="screen narrow">
      <button className="link" onClick={onBack}>← {uz.back}</button>
      {receiptId && (
        <p className="success">
          {uz.payDone} <span className="muted small">{uz.receipt(receiptId.slice(0, 8))}</span>
        </p>
      )}
      <h1>{uz.createTitle}</h1>
      <label className="field">
        <span>{uz.nameLabel}</span>
        <input value={name} maxLength={24} placeholder={uz.namePlaceholder} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="field">
        <span>{uz.positionLabel}</span>
        <div className="chips">
          {POSITIONS.map((p) => (
            <button key={p} className={p === position ? 'chip on' : 'chip'} onClick={() => { setPosition(p); setBonus({}); }}>
              <b>{p}</b> {uz.positions[p]}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>{uz.bonusLabel(left)}</span>
        <ul className="stat-edit">
          {STAT_KEYS.map((k) => (
            <li key={k} className={C.POSITION_WEIGHTS[position][k] >= 0.15 ? 'key' : ''}>
              <span className="label">{uz.stats[k]}</span>
              <button onClick={() => adjust(k, -1)} disabled={!bonus[k]} aria-label="−">−</button>
              <span className="val">
                {preview[k]}
                {bonus[k] ? <small> +{bonus[k]}</small> : null}
              </span>
              <button onClick={() => adjust(k, 1)} disabled={left <= 0 || (bonus[k] ?? 0) >= C.BONUS_POINTS_PER_STAT_MAX} aria-label="+">+</button>
            </li>
          ))}
        </ul>
        <p className="muted small">
          {uz.ovr}: {Math.round(computeOvr(preview, position))}
        </p>
      </div>
      {error && <p className="error">{error}</p>}
      {name.length > 0 && validation && <p className="error">{uz.errors[validation]}</p>}
      <button className="primary big" disabled={!!validation || busy} onClick={create}>
        {uz.createButton}
      </button>
    </div>
  );
}
