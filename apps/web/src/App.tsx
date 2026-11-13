import { useEffect, useState } from 'react';
import { playWeek, startNextSeason, type GameState, type TrainingId } from '@futbolchi/engine';
import { uz } from './i18n/uz';
import { api } from './state/api';
import { getUserId, getUserName, loadGame, saveGame } from './state/store';
import { LoadingScreen } from './screens/LoadingScreen';
import { NameScreen } from './screens/NameScreen';
import { MenuScreen } from './screens/MenuScreen';
import { InfoScreen } from './screens/InfoScreen';
import { PayScreen } from './screens/PayScreen';
import { CreateScreen } from './screens/CreateScreen';
import { WeekScreen } from './screens/WeekScreen';
import { MatchScreen } from './screens/MatchScreen';
import { SummaryScreen } from './screens/SummaryScreen';
import { AdminScreen } from './screens/AdminScreen';
import { PixelArt, SkyBackdrop } from './art/PixelArt';
import { BALL } from './art/sprites';

/**
 * Flow: loading (counter) → name (first visit only) → menu
 *   menu → new career → pay (receipt) → create (persona) → game
 *   menu → load game → game
 *   menu → info
 */
type Route =
  | { name: 'loading' }
  | { name: 'name' }
  | { name: 'menu' }
  | { name: 'info' }
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
  const [userName, setUserNameState] = useState(() => getUserName());
  const [route, setRoute] = useState<Route>({ name: 'loading' });

  const update = (next: GameState) => {
    setGame(next);
    saveGame(next);
    void api.syncSave(getUserId(), next);
  };
  const home: Route = userName ? { name: 'menu' } : { name: 'name' };

  if (hash === '#/admin') {
    return (
      <div className="app bare">
        <SkyBackdrop />
        <main>
          <AdminScreen />
        </main>
      </div>
    );
  }

  if (route.name === 'loading') {
    return (
      <div className="app bare">
        <SkyBackdrop />
        <main>
          <LoadingScreen onDone={() => setRoute(home)} />
        </main>
      </div>
    );
  }

  let body: JSX.Element;
  switch (route.name) {
    case 'name':
      body = (
        <NameScreen
          onDone={(n) => {
            setUserNameState(n);
            setRoute({ name: 'menu' });
          }}
        />
      );
      break;
    case 'info':
      body = <InfoScreen onBack={() => setRoute({ name: 'menu' })} />;
      break;
    case 'pay':
      body = (
        <PayScreen
          name={userName}
          onBack={() => setRoute({ name: 'menu' })}
          onPaid={(entitlementId) => setRoute({ name: 'create', entitlementId })}
        />
      );
      break;
    case 'create':
      body = (
        <CreateScreen
          name={userName}
          entitlementId={route.entitlementId}
          onCreated={(s) => {
            update(s);
            setRoute({ name: 'game' });
          }}
        />
      );
      break;
    case 'match':
      body = game ? (
        <MatchScreen state={game} matchId={route.matchId} onContinue={() => setRoute({ name: 'game' })} />
      ) : (
        <></>
      );
      break;
    case 'game':
      if (game) {
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
        break;
      }
    // falls through when there is no game
    default:
      body = (
        <MenuScreen
          name={userName}
          game={game}
          onNewCareer={() => setRoute({ name: 'pay' })}
          onLoadGame={() => setRoute({ name: 'game' })}
          onInfo={() => setRoute({ name: 'info' })}
          onChangeName={() => setRoute({ name: 'name' })}
        />
      );
  }

  return (
    <div className="app">
      <SkyBackdrop />
      <header className="topbar">
        <button className="brand" onClick={() => setRoute(home)}>
          <PixelArt sprite={BALL} scale={2} /> {uz.appName}
        </button>
      </header>
      <main>{body}</main>
    </div>
  );
}
