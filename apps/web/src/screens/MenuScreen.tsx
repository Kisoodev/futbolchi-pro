import { useEffect, useState } from 'react';
import { currentSeason, type GameState } from '@futbolchi/engine';
import { formatMoney, tx } from '../i18n';
import { api } from '../state/api';
import { PixelArt } from '../art/PixelArt';
import { BALL } from '../art/sprites';

interface Props {
  name: string;
  game: GameState | null;
  onNewCareer: () => void;
  onLoadGame: () => void;
  onInfo: () => void;
  onChangeName: () => void;
}

/** Main menu: new career (primary), load game, info. */
export function MenuScreen({ name, game, onNewCareer, onLoadGame, onInfo, onChangeName }: Props) {
  const [price, setPrice] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    api.config().then((c) => setPrice(c.product.amountMinor)).catch(() => undefined);
  }, []);

  const season = game ? currentSeason(game) : null;
  const saveLabel =
    game && season
      ? game.phase === 'seasonSummary'
        ? tx.menuLoadGameSummary(game.persona.name, season.index)
        : tx.menuLoadGameOf(game.persona.name, season.index, season.week)
      : tx.menuNoSave;

  return (
    <div className="screen center hero menu">
      <PixelArt sprite={BALL} scale={5} className="ball-logo" />
      <h1>{tx.menuHello(name)}</h1>
      <p className="tagline">{tx.menuSub}</p>

      {confirming && game ? (
        <div className="menu-card confirm" role="alertdialog" aria-labelledby="replace-title">
          <h2 id="replace-title">{tx.menuReplaceTitle}</h2>
          <p>{tx.menuReplaceText(game.persona.name)}</p>
          <button className="primary big" onClick={onNewCareer}>{tx.menuReplaceYes}</button>
          <button className="big" onClick={() => setConfirming(false)}>{tx.menuReplaceNo}</button>
        </div>
      ) : (
        <nav className="menu-card" aria-label={tx.navMenu}>
          <button className="primary big menu-btn" onClick={() => (game ? setConfirming(true) : onNewCareer())}>
            <span>▶ {tx.menuNewCareer}</span>
            {price !== null && <small>{tx.menuPrice(formatMoney(price))}</small>}
          </button>
          <button className="big menu-btn" onClick={onLoadGame} disabled={!game}>
            <span>{tx.menuLoadGame}</span>
            <small>{saveLabel}</small>
          </button>
          <button className="big menu-btn" onClick={onInfo}>
            <span>{tx.menuInfo}</span>
            <small>{tx.menuInfoNote}</small>
          </button>
          <button className="link change-name" onClick={onChangeName}>
            {tx.menuChangeName}
          </button>
        </nav>
      )}
    </div>
  );
}
