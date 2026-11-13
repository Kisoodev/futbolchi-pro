import { useEffect, useState } from 'react';
import { currentSeason, type GameState } from '@futbolchi/engine';
import { uz } from '../i18n/uz';
import { api, formatUzs } from '../state/api';
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
        ? uz.menuLoadGameSummary(game.persona.name, season.index)
        : uz.menuLoadGameOf(game.persona.name, season.index, season.week)
      : uz.menuNoSave;

  return (
    <div className="screen center hero menu">
      <PixelArt sprite={BALL} scale={5} className="ball-logo" />
      <h1>{uz.menuHello(name)}</h1>
      <p className="tagline">{uz.menuSub}</p>

      {confirming && game ? (
        <div className="menu-card confirm" role="alertdialog" aria-labelledby="replace-title">
          <h2 id="replace-title">{uz.menuReplaceTitle}</h2>
          <p>{uz.menuReplaceText(game.persona.name)}</p>
          <button className="primary big" onClick={onNewCareer}>{uz.menuReplaceYes}</button>
          <button className="big" onClick={() => setConfirming(false)}>{uz.menuReplaceNo}</button>
        </div>
      ) : (
        <nav className="menu-card" aria-label="Menyu">
          <button className="primary big menu-btn" onClick={() => (game ? setConfirming(true) : onNewCareer())}>
            <span>▶ {uz.menuNewCareer}</span>
            {price !== null && <small>{uz.menuPrice(formatUzs(price))}</small>}
          </button>
          <button className="big menu-btn" onClick={onLoadGame} disabled={!game}>
            <span>{uz.menuLoadGame}</span>
            <small>{saveLabel}</small>
          </button>
          <button className="big menu-btn" onClick={onInfo}>
            <span>{uz.menuInfo}</span>
            <small>{uz.menuInfoNote}</small>
          </button>
          <button className="link change-name" onClick={onChangeName}>
            {uz.menuChangeName}
          </button>
        </nav>
      )}
    </div>
  );
}
