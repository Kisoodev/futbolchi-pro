import { useEffect, useState } from 'react';
import { playWeek, startNextSeason, type GameState, type TrainingId } from '@futbolchi/engine';
import { uz } from './i18n/uz';
import { api } from './state/api';
import { clearGame, getUserId, loadGame, saveGame } from './state/store';
import { CreateScreen } from './screens/CreateScreen';
import { WeekScreen } from './screens/WeekScreen';
import { MatchScreen } from './screens/MatchScreen';
import { SummaryScreen } from './screens/SummaryScreen';
import { AdminScreen } from './screens/AdminScreen';

type Route = { name: 'home' } | { name: 'create' } | { name: 'game' } | { name: 'match'; matchId: string };

const useHash = () => {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
};

export function App() {
  const hash = useHash();
  const [game, setGame] = useState<GameState | null>(() => loadGame());
  const [route, setRoute] = useState<Route>({ name: 'home' });

  const update = (next: GameState) => {
    setGame(next);
    saveGame(next);
    void api.syncSave(getUserId(), next);
  };

  if (hash === '#/admin') return <AdminScreen />;

  let body: JSX.Element;
  if (route.name === 'create') {
    body = (
      <CreateScreen
        onBack={() => setRoute({ name: 'home' })}
        onCreated={(s) => {
          update(s);
          setRoute({ name: 'game' });
        }}
      />
    );
  } else if (route.name === 'match' && game) {
    body = <MatchScreen state={game} matchId={route.matchId} onContinue={() => setRoute({ name: 'game' })} />;
  } else if (route.name === 'game' && game) {
    body =
      game.phase === 'seasonSummary' ? (
        <SummaryScreen state={game} onNextSeason={(clubId) => update(startNextSeason(game, clubId))} />
      ) : (
        <WeekScreen
          state={game}
          onPlay={(opt: TrainingId) => {
            const r = playWeek(game, opt);
            update(r.state);
            setRoute({ name: 'match', matchId: r.matchId });
          }}
        />
      );
  } else {
    body = (
      <div className="screen center hero">
        <div className="ball-logo" aria-hidden>⚽</div>
        <h1>{uz.appName}</h1>
        <p className="tagline">{uz.tagline}</p>
        {game && (
          <button className="primary big" onClick={() => setRoute({ name: 'game' })}>
            {uz.continue} — {game.persona.name}
          </button>
        )}
        <button
          className={game ? 'big' : 'primary big'}
          onClick={() => {
            if (game && !confirm(uz.confirmNewCareer)) return;
            if (game) {
              clearGame();
              setGame(null);
            }
            setRoute({ name: 'create' });
          }}
        >
          {game ? uz.newCareer : uz.start}
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setRoute({ name: 'home' })}>
          ⚽ {uz.appName}
        </button>
      </header>
      <main>{body}</main>
    </div>
  );
}
