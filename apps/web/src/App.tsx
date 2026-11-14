import { lazy, Suspense, useEffect, useState } from 'react';
import { playMatchDay, startNextSeason, trainDay, type GameState, type TrainingId } from '@futbolchi/engine';
import { GrowthReveal, type GrowthData } from './components/GrowthReveal';
import { AccountBadge } from './components/AccountBadge';
import { tx, useLang } from './i18n';
import { api } from './state/api';
import { ADMIN_EVENT, openAdmin, verifiedAdminToken } from './state/admin';
import { getUserId, getUserName, introSeen, loadGame, markIntroSeen, saveGame } from './state/store';
import { IntroPlayer } from './intro/IntroPlayer';
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
import { LangSwitch } from './components/LangSwitch';
import { SettingsButton } from './components/Settings';

/**
 * Flow: loading (counter) → name (first visit only) → menu
 *   menu → new career → pay (receipt) → create (persona) → game
 *   menu → load game → game
 *   create → intro (opening film, once per persona) → game
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
  /** The opening film; the game follows. */
  | { name: 'intro' }
  | { name: 'match'; matchId: string };

/**
 * The video recorder is for the owner only: its code is a separate chunk that
 * is downloaded and mounted only after the server accepts the admin token.
 */
const RecorderDock = lazy(() => import('./recorder/RecorderDock'));

function useIsAdmin(): boolean {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    let alive = true;
    const check = () => void verifiedAdminToken().then((t) => alive && setAdmin(!!t));
    check();
    window.addEventListener(ADMIN_EVENT, check);
    return () => {
      alive = false;
      window.removeEventListener(ADMIN_EVENT, check);
    };
  }, []);
  return admin;
}

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
  // Re-render the whole tree when the language changes.
  useLang();
  const hash = useHash();
  const isAdmin = useIsAdmin();
  // a screen recording started in the admin panel keeps its small REC indicator while the owner plays
  const [recActive, setRecActive] = useState(false);
  useEffect(() => {
    const on = (e: Event) => setRecActive(!!(e as CustomEvent<{ active: boolean }>).detail?.active);
    window.addEventListener('futbolchi-rec', on);
    return () => window.removeEventListener('futbolchi-rec', on);
  }, []);
  const recorder = isAdmin && (hash === '#/admin' || recActive) ? (
    <Suspense fallback={null}>
      <RecorderDock />
    </Suspense>
  ) : null;
  const [game, setGame] = useState<GameState | null>(() => loadGame());
  const [userName, setUserNameState] = useState(() => getUserName());
  const [route, setRoute] = useState<Route>({ name: 'loading' });
  /** The growth animation to show (after a training day, or after a match). */
  const [growth, setGrowth] = useState<GrowthData | null>(null);
  /** Match-day growth waits until the match has been watched. */
  const [afterMatch, setAfterMatch] = useState<GrowthData | null>(null);

  const update = (next: GameState) => {
    setGame(next);
    saveGame(next);
    void api.syncSave(getUserId(), next);
  };
  // Hidden owner shortcut: Ctrl+Shift+A opens the admin panel (login is still required).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyA') {
        e.preventDefault();
        openAdmin();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const home: Route = userName ? { name: 'menu' } : { name: 'name' };

  if (hash === '#/admin') {
    return (
      <div className="app bare">
        <SkyBackdrop />
        <LangSwitch floating />
        <main>
          <AdminScreen />
        </main>
        {recorder}
      </div>
    );
  }

  if (route.name === 'intro' && game) {
    const done = () => {
      markIntroSeen(game.persona.id);
      setRoute({ name: 'game' });
    };
    return (
      <div className="intro-screen">
        <IntroPlayer name={game.persona.name} appearance={game.persona.appearance} onDone={done} />
        {recorder}
      </div>
    );
  }

  if (route.name === 'loading') {
    return (
      <div className="app bare">
        <SkyBackdrop />
        <LangSwitch floating />
        <main>
          <LoadingScreen onDone={() => setRoute(home)} />
        </main>
      </div>
    );
  }

  let body: JSX.Element;
  /**
   * The language switch shows only at the entrance (loading, name, main menu).
   * Once the game has started it would distract, so it is hidden there.
   */
  let showLangSwitch = false;
  switch (route.name) {
    case 'name':
      showLangSwitch = true;
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
            update({ ...s, account: game?.account ?? s.account });
            setRoute({ name: 'intro' });
          }}
        />
      );
      break;
    case 'match':
      body = game ? (
        <MatchScreen
          state={game}
          matchId={route.matchId}
          onContinue={() => {
            setRoute({ name: 'game' });
            if (afterMatch) setGrowth(afterMatch);
            setAfterMatch(null);
          }}
        />
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
              onTrain={(opt: TrainingId) => {
                const r = trainDay(game, opt);
                update(r.state);
                setGrowth({ kind: 'training', before: game.persona.stats, after: r.state.persona.stats, ovrBefore: r.ovrBefore, ovrAfter: r.ovrAfter, reward: r.reward, account: r.state.account, rested: opt === 'rest' });
              }}
              coachHold={!!growth}
              onPlayMatch={() => {
                const r = playMatchDay(game);
                update(r.state);
                const before = game.persona.stats;
                // growth from the performance only (fatigue and recovery are not "growth")
                const after = { ...before };
                for (const [k, d] of Object.entries(r.deltas)) after[k as keyof typeof after] = before[k as keyof typeof before] + (d ?? 0);
                const played = (r.state.matches[r.matchId]?.personaStats?.minutes ?? 0) > 0;
                setAfterMatch({ kind: 'match', before, after, ovrBefore: r.ovrBefore, ovrAfter: r.ovrAfter, reward: r.reward, account: r.state.account, benched: !played });
                setRoute({ name: 'match', matchId: r.matchId });
              }}
            />
          );
        break;
      }
    // falls through when there is no game
    default:
      showLangSwitch = true;
      body = (
        <MenuScreen
          name={userName}
          game={game}
          onNewCareer={() => setRoute({ name: 'pay' })}
          onLoadGame={() => setRoute(game && !introSeen(game.persona.id) ? { name: 'intro' } : { name: 'game' })}
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
          <PixelArt sprite={BALL} scale={2} /> {tx.appName}
        </button>
        <span className="topbar-right">
          {game && !showLangSwitch && <AccountBadge account={game.account} />}
          {showLangSwitch ? <LangSwitch /> : <SettingsButton onReplayIntro={game ? () => setRoute({ name: 'intro' }) : undefined} />}
        </span>
      </header>
      <main>{body}</main>
      {growth && <GrowthReveal data={growth} onClose={() => setGrowth(null)} />}
      {recorder}
    </div>
  );
}
