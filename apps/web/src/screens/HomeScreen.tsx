import { useEffect, useState } from 'react';
import type { GameState } from '@futbolchi/engine';
import { uz } from '../i18n/uz';
import { api, formatUzs } from '../state/api';
import { getUserId, getUserName, setUserName } from '../state/store';
import { PixelArt } from '../art/PixelArt';
import { BALL } from '../art/sprites';

const NAME_MIN = 2;
const NAME_MAX = 24;

interface Props {
  game: GameState | null;
  onContinue: () => void;
  /** Player confirmed they want to drop the current career. */
  onDiscardCareer: () => void;
  /** Name registered; go to payment. */
  onStart: (name: string) => void;
}

/** Main menu. New players enter a name; returning players continue their career. */
export function HomeScreen({ game, onContinue, onDiscardCareer, onStart }: Props) {
  const [name, setName] = useState(() => getUserName());
  const [price, setPrice] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.config().then((c) => setPrice(c.product.amountMinor)).catch(() => undefined);
  }, []);

  const clean = name.trim();
  const valid = clean.length >= NAME_MIN && clean.length <= NAME_MAX;

  const start = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.register(getUserId(), clean);
      setUserName(clean);
      onStart(clean);
    } catch {
      setError(uz.serverDown);
      setBusy(false);
    }
  };

  return (
    <div className="screen center hero">
      <PixelArt sprite={BALL} scale={7} className="ball-logo" />
      <h1>{uz.appName}</h1>
      <p className="tagline">{uz.tagline}</p>

      {game ? (
        <>
          <button className="primary big" onClick={onContinue}>
            {uz.continue} — {game.persona.name}
          </button>
          <button
            className="big"
            onClick={() => {
              if (confirm(uz.confirmNewCareer)) onDiscardCareer();
            }}
          >
            {uz.newCareer}
          </button>
        </>
      ) : (
        <form
          className="name-card"
          onSubmit={(e) => {
            e.preventDefault();
            void start();
          }}
        >
          <h2>{uz.menuNameTitle}</h2>
          <p className="muted">{uz.menuNameHint}</p>
          <label className="name-input">
            <span aria-hidden>@</span>
            <input
              value={name}
              maxLength={NAME_MAX}
              placeholder={uz.menuNamePlaceholder}
              aria-label={uz.menuNameTitle}
              autoComplete="nickname"
              spellCheck={false}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {valid && price !== null && (
            <p className="price-tag">
              <strong>{uz.menuPrice(formatUzs(price))}</strong>
              <span>{uz.menuPriceNote}</span>
            </p>
          )}
          {error && <p className="error">{error}</p>}
          <button className="primary big" type="submit" disabled={!valid || busy}>
            {uz.continue} →
          </button>
        </form>
      )}
    </div>
  );
}
