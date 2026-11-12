import { useEffect, useState } from 'react';
import { playWeek, startNextSeason, type GameState, type TrainingId } from '@futbolchi/engine';
import { uz } from './i18n/uz';
import { api } from './state/api';
import { clearGame, getUserId, getUserName, loadGame, saveGame } from './state/store';
import { LoadingScreen } from './screens/LoadingScreen';
import { HomeScreen } from './screens/HomeScreen';
import { PayScreen } from './screens/PayScreen';
import { CreateScreen } from './screens/CreateScreen';
import { WeekScreen } from './screens/WeekScreen';
import { MatchScreen } from './screens/MatchScreen';
import { SummaryScreen } from './screens/SummaryScreen';
import { AdminScreen } from './screens/AdminScreen';
import { PixelArt, SkyBackdrop } from './art/PixelArt';
import { BALL } from './art/sprites';

/**
 * New player flow: loading (counter) → home (name) → pay (receipt) → create (persona) → game.
 */
type Route =
  | { name: 'loading' }
  | { name: 'home' }
  | { name: 'pay' }
  | { name: 'create'; entitlementId: string }
  | { name: 'game' }
  | { name: 'match'; matchId: string };

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
  const [route, setRoute] = useState<Route>({ name: 'loading' });

  const update = (next: GameState) => {
    setGame(next);
    saveGame(next);
    void api.syncSave(getUserId(), next);
  };

  if (hash === '#/admin') {
    return (
      <div className="app">
        <SkyBackdrop />
        <main>
          <AdminScreen />
        </main>
      </div>
    );
  }

  if (route.name === 'loading') {
    return (
      <div className="app">
        <SkyBackdrop />
        <main>
          <LoadingScreen onDone={() => setRoute({ name: 'home' })} />
        </main>
      </div>
    );
  }

  let body: JSX.Element;
  if (route.name === 'pay') {
    body = (
      <PayScreen
        name={getUserName()}
        onBack={() => setRoute({ name: 'home' })}
        onPaid={(entitlementId) => setRoute({ name: 'create', entitlementId })}
      />
    );
  } else if (route.name === 'create') {
    body = (
      <CreateScreen
        name={getUserName()}
        entitlementId={route.entitlementId}
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
      <HomeScreen
        game={game}
        onContinue={() => setRoute({ name: 'game' })}
        onDiscardCareer={() => {
          clearGame();
          setGame(null);
        }}
        onStart={() => setRoute({ name: 'pay' })}
      />
    );
  }

  return (
    <div className="app">
      <SkyBackdrop />
      <header className="topbar">
        <button className="brand" onClick={() => setRoute({ name: 'home' })}>
          <PixelArt sprite={BALL} scale={2} /> {uz.appName}
        </button>
      </header>
      <main>{body}</main>
    </div>
  );
}
