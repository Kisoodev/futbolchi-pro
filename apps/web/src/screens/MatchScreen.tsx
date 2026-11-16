import { useCallback, useState } from 'react';
import type { GameState, PersonaOrder } from '@futbolchi/engine';
import { tx } from '../i18n';
import { PitchReplay } from '../replay/PitchReplay';
import { CoachGuide } from '../coach/CoachGuide';

interface Props {
  state: GameState;
  matchId: string;
  onContinue: () => void;
  /** The orders given to the persona so far, and how to give new ones (the match is played again). */
  orders?: PersonaOrder[];
  onOrders?: (orders: PersonaOrder[]) => void;
}

export function MatchScreen({ state, matchId, onContinue, orders, onOrders }: Props) {
  const match = state.matches[matchId];
  const [finished, setFinished] = useState(false);
  const onFinished = useCallback(() => setFinished(true), []);
  if (!match) return null;
  const ps = match.personaStats;

  return (
    <div className="screen panel match">
      <PitchReplay
        match={match}
        clubs={state.clubs}
        personaName={state.persona.name}
        personaPosition={state.persona.position}
        personaLook={state.persona.appearance}
        orders={orders}
        onOrders={onOrders}
        onFinished={onFinished}
        sideTop={
          <div className="match-head">
            <p className="eyebrow">{tx.matchTitle(match.week)}</p>
            {ps && <p className="role">{tx.roles[ps.role]}</p>}
          </div>
        }
        sideBottom={
          <div className="match-foot">
            {finished && ps && ps.rating !== null && (
              <div className="result">
                <span className="rating">
                  {tx.rating}: <strong>{ps.rating.toFixed(1)}</strong>
                </span>
                <span className="muted small">{tx.personaLine(ps.minutes, ps.goals, ps.assists)}</span>
              </div>
            )}
            <button className={finished ? 'primary big' : 'big'} onClick={onContinue}>
              {tx.afterMatch} →
            </button>
          </div>
        }
      />
      <CoachGuide lesson="match" vars={{ name: state.persona.name, g: state.persona.appearance.gender }} delay={900} />
    </div>
  );
}
