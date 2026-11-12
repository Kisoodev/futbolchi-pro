import { useCallback, useState } from 'react';
import type { GameState } from '@futbolchi/engine';
import { uz } from '../i18n/uz';
import { PitchReplay } from '../replay/PitchReplay';

interface Props {
  state: GameState;
  matchId: string;
  onContinue: () => void;
}

export function MatchScreen({ state, matchId, onContinue }: Props) {
  const match = state.matches[matchId];
  const [finished, setFinished] = useState(false);
  const onFinished = useCallback(() => setFinished(true), []);
  if (!match) return null;
  const ps = match.personaStats;

  return (
    <div className="screen narrow wide-ish">
      <p className="eyebrow">{uz.matchTitle(match.week)}</p>
      {ps && <p className="role">{uz.roles[ps.role]}</p>}
      <PitchReplay
        match={match}
        clubs={state.clubs}
        personaName={state.persona.name}
        personaPosition={state.persona.position}
        onFinished={onFinished}
      />
      {finished && ps && ps.rating !== null && (
        <div className="card result">
          <span className="rating">
            {uz.rating}: <strong>{ps.rating.toFixed(1)}</strong>
          </span>
          <span className="muted">{uz.personaLine(ps.minutes, ps.goals, ps.assists)}</span>
        </div>
      )}
      <button className={finished ? 'primary big' : 'big'} onClick={onContinue}>
        {uz.afterMatch} →
      </button>
    </div>
  );
}
