import { useEffect, useRef, useState } from 'react';
import { tx } from '../i18n';
import { api } from '../state/api';
import { PixelArt } from '../art/PixelArt';
import { BALL } from '../art/sprites';

const MIN_MS = 2600;
const FETCH_TIMEOUT_MS = 2500;
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Slot-machine style counter: every digit is a reel that rolls to its value. */
function RollingCounter({ value }: { value: number }) {
  const [rolled, setRolled] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setRolled(true)));
    return () => cancelAnimationFrame(id);
  }, []);
  const digits = String(Math.max(0, Math.floor(value))).split('').map(Number);
  return (
    <div className="counter" role="img" aria-label={String(value)}>
      {digits.map((d, i) => {
        const fromRight = digits.length - i;
        return (
          <span key={i} className={`reel ${fromRight % 3 === 0 && i !== 0 ? 'gap' : ''}`} aria-hidden>
            <span
              className="strip"
              style={{ transform: `translateY(-${rolled ? 10 + d : 0}em)`, transitionDelay: `${i * 120}ms` }}
            >
              {[...DIGITS, ...DIGITS].map((n, k) => (
                <span key={k}>{n}</span>
              ))}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** First thing a visitor sees: how many players have registered, while the game loads. */
export function LoadingScreen({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState<number | null>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    let alive = true;
    const started = performance.now();
    const timeout = new Promise<null>((r) => setTimeout(() => r(null), FETCH_TIMEOUT_MS));
    let timer: ReturnType<typeof setTimeout> | undefined;
    void Promise.race([api.stats().catch(() => null), timeout]).then((s) => {
      if (!alive) return;
      if (s) setCount(s.registered);
      timer = setTimeout(() => alive && done.current(), Math.max(0, MIN_MS - (performance.now() - started)));
    });
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <div className="screen center loading">
      <div className="loading-brand">
        <PixelArt sprite={BALL} scale={3} /> {tx.appName}
      </div>
      {count !== null && (
        <>
          <p className="counter-label">{tx.loadingCounterLabel}</p>
          <RollingCounter value={count} />
        </>
      )}
      <div className="progress" aria-hidden>
        <span style={{ animationDuration: `${MIN_MS}ms` }} />
      </div>
      <p className="loading-text">{tx.loadingText}</p>
    </div>
  );
}
