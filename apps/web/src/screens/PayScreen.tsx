/**
 * Manual payment: the player transfers money to the card shown here, uploads
 * the receipt ("chek"), and waits for an admin to confirm. The page polls and
 * moves on by itself as soon as access is granted (approved payment or a free
 * slot granted from the admin panel).
 *
 * Owner mode: if this browser has a remembered, server-verified admin token,
 * an extra button skips the payment (it grants a free slot, recorded as a
 * 0 so'm receipt). Normal players never see it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatMoney, tx } from '../i18n';
import { adminApi, api, type AppConfig } from '../state/api';
import { verifiedAdminToken } from '../state/admin';
import { getUserId } from '../state/store';

type Step = 'loading' | 'instructions' | 'review' | 'rejected' | 'error';

const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const POLL_MS = 4000;

interface Props {
  name: string;
  onPaid: (entitlementId: string) => void;
  onBack: () => void;
}

/** Which of the 3 stepper dots is active. */
const STAGE: Record<Step, number> = { loading: 0, error: 0, instructions: 1, rejected: 1, review: 3 };

export function PayScreen({ name, onPaid, onBack }: Props) {
  const userId = getUserId();
  const [step, setStep] = useState<Step>('loading');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState<'card' | 'amount' | null>(null);
  const [dragging, setDragging] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [skipping, setSkipping] = useState(false);
  const paid = useRef(onPaid);
  paid.current = onPaid;

  useEffect(() => {
    let alive = true;
    void verifiedAdminToken().then((t) => alive && setAdminToken(t));
    return () => {
      alive = false;
    };
  }, []);

  /** True if the player already has a usable slot (then we leave this page). */
  const checkAccess = useCallback(async (): Promise<boolean> => {
    const { entitlements } = await api.entitlements(userId);
    const free = entitlements.find((e) => e.consumedByPersonaId === null);
    if (free) paid.current(free.id);
    return !!free;
  }, [userId]);

  const init = useCallback(async () => {
    setStep('loading');
    setImage(null);
    setNote(null);
    try {
      if (await checkAccess()) return;
      const [cfg, payment] = await Promise.all([api.config(), api.createPayment(userId)]);
      setConfig(cfg);
      setPaymentId(payment.paymentId);
      setAmount(payment.amountMinor);
      const state = await api.paymentState(payment.paymentId);
      setStep(state.proof === 'submitted' ? 'review' : 'instructions');
    } catch {
      setStep('error');
    }
  }, [checkAccess, userId]);

  useEffect(() => {
    void init();
  }, [init]);

  // Poll for a decision (or a free slot from the admin panel).
  useEffect(() => {
    if (step !== 'instructions' && step !== 'review') return;
    let alive = true;
    const id = setInterval(async () => {
      try {
        if (await checkAccess()) return;
        if (!alive || !paymentId || step !== 'review') return;
        const state = await api.paymentState(paymentId);
        if (alive && state.status === 'failed') {
          // A rejected payment is closed; open a new one so the player can send another receipt here.
          const next = await api.createPayment(userId);
          if (!alive) return;
          setPaymentId(next.paymentId);
          setAmount(next.amountMinor);
          setNote(state.note);
          setImage(null);
          setStep('rejected');
        }
      } catch {
        /* temporary network error: keep polling */
      }
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [step, paymentId, checkAccess, userId]);

  const pick = (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    if (!TYPES.includes(file.type)) return setFileError(tx.payFileBad);
    if (file.size > MAX_BYTES) return setFileError(tx.payFileTooBig);
    const reader = new FileReader();
    reader.onload = () => setImage(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => setFileError(tx.payFileBad);
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!paymentId || !image || sending) return;
    setSending(true);
    setFileError(null);
    try {
      await api.uploadProof(paymentId, userId, image);
      setStep('review');
    } catch {
      setFileError(tx.serverDown);
    } finally {
      setSending(false);
    }
  };

  const copy = async (what: 'card' | 'amount') => {
    const text = what === 'card' ? config?.card?.number.replace(/\s/g, '') : amount !== null ? String(amount / 100) : null;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked: the value is still visible to copy by hand */
    }
  };

  const skip = async () => {
    if (!adminToken || skipping) return;
    setSkipping(true);
    try {
      const { entitlement } = await adminApi(adminToken).grant(userId);
      paid.current(entitlement.id);
    } catch {
      setFileError(tx.serverDown);
      setSkipping(false);
    }
  };

  const stage = STAGE[step];
  const adminSkip = adminToken && step !== 'loading' && (
    <button type="button" className="admin-skip" disabled={skipping} onClick={skip} title={tx.payAdminSkipHint}>
      ★ {tx.payAdminSkip}
    </button>
  );

  return (
    <div className="screen panel pay">
      <header className="panel-head pay-head">
        <div>
          <button className="link" onClick={onBack}>← {tx.back}</button>
          <p className="eyebrow">{tx.payTitle}</p>
          <h1>{tx.payHello(name)}</h1>
        </div>
        <ol className="stepper" aria-label={tx.payTitle}>
          {tx.payStages.map((label, i) => (
            <li key={label} className={stage > i + 1 ? 'done' : stage === i + 1 ? 'on' : ''}>
              <b>{stage > i + 1 ? '✓' : i + 1}</b>
              <span>{label}</span>
            </li>
          ))}
        </ol>
      </header>

      <div className="panel-body">
        {step === 'loading' && <p className="muted">{tx.loading}</p>}

        {step === 'error' && (
          <>
            <p className="error">{tx.serverDown}</p>
            <button className="big" onClick={() => void init()}>{tx.payRetry}</button>
          </>
        )}

        {(step === 'instructions' || step === 'rejected') && (
          <>
            {step === 'rejected' && (
              <div className="pay-alert" role="alert">
                <strong>{tx.payRejectedTitle}</strong>
                <span>{note ? tx.payRejectedNote(note) : tx.payRejectedHint}</span>
              </div>
            )}
            <div className="pay-grid">
              <section className="pay-step">
                <h2><b>1</b> {tx.payStep1}</h2>
                <div className="amount">
                  <span>{tx.payAmount}</span>
                  <strong>{amount !== null ? formatMoney(amount) : '—'}</strong>
                  <button type="button" className="small-btn" onClick={() => copy('amount')}>
                    {copied === 'amount' ? tx.payCopied : tx.payCopy}
                  </button>
                </div>
                {config?.card ? (
                  <div className="bank-card">
                    <span className="number">{config.card.number}</span>
                    <span className="holder">
                      {tx.payCardHolder}: <b>{config.card.holder}</b>
                    </span>
                    <button type="button" onClick={() => copy('card')}>{copied === 'card' ? tx.payCopied : tx.payCopy}</button>
                  </div>
                ) : (
                  <p className="error">{tx.payNoCard}</p>
                )}
                <p className="muted small">{tx.payExactHint}</p>
              </section>

              <section className="pay-step">
                <h2><b>2</b> {tx.payStep2}</h2>
                <label
                  className={`upload ${image ? 'has-file' : ''} ${dragging ? 'drag' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    pick(e.dataTransfer.files?.[0]);
                  }}
                >
                  <input type="file" accept={TYPES.join(',')} onChange={(e) => pick(e.target.files?.[0])} />
                  {image ? <img src={image} alt="" /> : <span className="plus" aria-hidden>+</span>}
                  <span>{image ? tx.payChange : tx.payChoose}</span>
                  <small>{tx.payFileHint}</small>
                </label>
                {fileError && <p className="error">{fileError}</p>}
              </section>
            </div>
          </>
        )}

        {step === 'review' && (
          <div className="review">
            {image ? <img className="review-proof" src={image} alt="" /> : <div className="spinner" aria-hidden />}
            <div>
              <h2><span className="dot-pulse" aria-hidden /> {tx.payReviewTitle}</h2>
              <p>{tx.payReviewText}</p>
              {fileError && <p className="error">{fileError}</p>}
            </div>
          </div>
        )}
      </div>

      {step === 'instructions' && (
        <footer className="panel-foot">
          {adminSkip}
          <button className="primary big" disabled={!image || sending} onClick={submit}>
            {sending ? tx.paySending : tx.paySubmit}
          </button>
        </footer>
      )}
      {step === 'rejected' && (
        <footer className="panel-foot">
          {adminSkip}
          <button className="primary big" disabled={!image || sending} onClick={submit}>
            {sending ? tx.paySending : tx.paySubmit}
          </button>
        </footer>
      )}
      {(step === 'review' || step === 'error') && (
        <footer className="panel-foot">
          {adminSkip}
          <button className="big" onClick={onBack}>{tx.payBackToMenu}</button>
        </footer>
      )}
    </div>
  );
}
