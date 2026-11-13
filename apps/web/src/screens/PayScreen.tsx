/**
 * Manual payment: the player transfers money to the card shown here, uploads
 * the receipt ("chek"), and waits for an admin to confirm. The page polls and
 * moves on by itself as soon as access is granted (approved payment or a free
 * slot granted from the admin panel).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatMoney, tx } from '../i18n';
import { api, type AppConfig } from '../state/api';
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
  const [copied, setCopied] = useState(false);
  const paid = useRef(onPaid);
  paid.current = onPaid;

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
          setNote(state.note);
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
  }, [step, paymentId, checkAccess]);

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

  const copy = async () => {
    if (!config?.card) return;
    try {
      await navigator.clipboard.writeText(config.card.number.replace(/\s/g, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the number is still visible to copy by hand */
    }
  };

  return (
    <div className="screen panel pay">
      <header className="panel-head">
        <button className="link" onClick={onBack}>← {tx.back}</button>
        <p className="eyebrow">{tx.payTitle}</p>
        <h1>{tx.payHello(name)}</h1>
      </header>

      <div className="panel-body">
        {step === 'loading' && <p className="muted">{tx.loading}</p>}

        {step === 'error' && (
          <>
            <p className="error">{tx.serverDown}</p>
            <button className="big" onClick={() => void init()}>{tx.payRetry}</button>
          </>
        )}

        {step === 'instructions' && (
          <div className="pay-grid">
            <section className="pay-step">
              <div className="amount">
                <span>{tx.payAmount}</span>
                <strong>{amount !== null ? formatMoney(amount) : '—'}</strong>
              </div>
              <h2><b>1</b> {tx.payStep1}</h2>
              {config?.card ? (
                <div className="bank-card">
                  <span className="number">{config.card.number}</span>
                  <span className="holder">
                    {tx.payCardHolder}: <b>{config.card.holder}</b>
                  </span>
                  <button type="button" onClick={copy}>{copied ? tx.payCopied : tx.payCopy}</button>
                </div>
              ) : (
                <p className="error">{tx.payNoCard}</p>
              )}
            </section>

            <section className="pay-step">
              <h2><b>2</b> {tx.payStep2}</h2>
              <label className={`upload ${image ? 'has-file' : ''}`}>
                <input type="file" accept={TYPES.join(',')} onChange={(e) => pick(e.target.files?.[0])} />
                {image ? <img src={image} alt="" /> : <span className="plus" aria-hidden>+</span>}
                <span>{image ? tx.payChange : tx.payChoose}</span>
                <small>{tx.payFileHint}</small>
              </label>
              {fileError && <p className="error">{fileError}</p>}
            </section>
          </div>
        )}

        {step === 'review' && (
          <div className="review">
            <div className="spinner" aria-hidden />
            <h2>{tx.payReviewTitle}</h2>
            <p>{tx.payReviewText}</p>
          </div>
        )}

        {step === 'rejected' && (
          <>
            <h2 className="outcome relegated">{tx.payRejectedTitle}</h2>
            {note && <p>{tx.payRejectedNote(note)}</p>}
          </>
        )}
      </div>

      {step === 'instructions' && (
        <footer className="panel-foot">
          <button className="primary big" disabled={!image || sending} onClick={submit}>
            {sending ? tx.paySending : tx.paySubmit}
          </button>
        </footer>
      )}
      {step === 'rejected' && (
        <footer className="panel-foot">
          <button className="primary big" onClick={() => void init()}>{tx.payRetry}</button>
        </footer>
      )}
    </div>
  );
}
