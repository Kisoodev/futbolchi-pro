import { lazy, Suspense, useEffect, useState } from 'react';
import { playMatchDay, startNextSeason, trainDay, type GameState, type PersonaOrder, type TrainingId } from '@futbolchi/engine';
import { GrowthReveal, type GrowthData } from './components/GrowthReveal';
import { AccountBadge } from './components/AccountBadge';
import { tx, useLang } from './i18n';
import { api } from './state/api';
import { ADMIN_EVENT, openAdmin, verifiedAdminToken } from './state/admin';
import { clearPending, getUserId, getUserName, introSeen, loadGame, loadPending, markIntroSeen, saveGame, savePending } from './state/store';
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
 *   menu → new career → create (persona) → intro (opening film) → pay (paywall at the climax) → game
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
  | { name: 'create' }
  | { name: 'game' }
  /** The opening film; the game follows (or, for a new career, the payment). */
  | { name: 'intro'; pending?: boolean }
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
  /** A new career that is created but not paid yet. */
  const [pending, setPending] = useState<GameState | null>(() => loadPending());
  const [route, setRoute] = useState<Route>({ name: 'loading' });
  /** The growth animation to show (after a training day, or after a match). */
  const [growth, setGrowth] = useState<GrowthData | null>(null);
  /** Match-day growth waits until the match has been watched. */
  const [afterMatch, setAfterMatch] = useState<GrowthData | null>(null);
  /** The state before the match day and the orders given so far (the match is played again when they change). */
  const [matchRun, setMatchRun] = useState<{ base: GameState; orders: PersonaOrder[] } | null>(null);

  /** Plays the match day (again, when the orders change) and keeps the growth to show afterwards. */
  const runMatchDay = (game: GameState, orders: PersonaOrder[]) => {
    const r = playMatchDay(game, { orders });
    update(r.state);
    const ps = r.state.matches[r.matchId]?.personaStats;
    const played = (ps?.minutes ?? 0) > 0;
    // growth from the performance only (fatigue and recovery are not "growth")
    const before = game.persona.stats;
    const after = { ...before };
    for (const [k, d] of Object.entries(r.deltas)) after[k as keyof typeof after] = before[k as keyof typeof before] + (d ?? 0);
    setAfterMatch({
      kind: 'match',
      name: game.persona.name,
      before,
      after,
      levelBefore: r.levelBefore,
      levelAfter: r.levelAfter,
      milestones: r.milestones,
      rating: ps?.rating ?? null,
      reward: r.reward,
      account: r.state.account,
      benched: !played,
    });
    return r;
  };

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

  const introOf = route.name === 'intro' ? (route.pending ? pending : game) : null;
  if (route.name === 'intro' && introOf) {
    const done = () => {
      // a new career: the film stops at its peak and the payment comes next
      if (route.pending) setRoute({ name: 'pay' });
      else {
        markIntroSeen(introOf.persona.id);
        setRoute({ name: 'game' });
      }
    };
    return (
      <div className="intro-screen">
        <IntroPlayer name={introOf.persona.name} appearance={introOf.persona.appearance} onDone={done} />
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
          hero={pending}
          onRestart={() => {
            clearPending();
            setPending(null);
            setRoute({ name: 'create' });
          }}
          onPaid={(entitlementId) => {
            if (!pending) {
              setRoute({ name: 'create' });
              return;
            }
            // the paid slot belongs to this persona now (best effort: the game starts either way)
            void api.consume(entitlementId, getUserId(), pending.persona.id).catch(() => undefined);
            update({ ...pending, account: game?.account ?? pending.account });
            markIntroSeen(pending.persona.id);
            clearPending();
            setPending(null);
            setRoute({ name: 'game' });
          }}
        />
      );
      break;
    case 'create':
      body = (
        <CreateScreen
          name={userName}
          onCreated={(s) => {
            // kept apart from the current save until the payment goes through
            savePending(s);
            setPending(s);
            setRoute({ name: 'intro', pending: true });
          }}
        />
      );
      break;
    case 'match':
      body = game ? (
        <MatchScreen
          state={game}
          matchId={route.matchId}
          orders={matchRun?.orders ?? []}
          onOrders={
            matchRun
              ? (orders) => {
                  setMatchRun({ ...matchRun, orders });
                  runMatchDay(matchRun.base, orders);
                }
              : undefined
          }
          onContinue={() => {
            setMatchRun(null);
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
                setGrowth({
                  kind: 'training',
                  name: game.persona.name,
                  before: game.persona.stats,
                  after: r.state.persona.stats,
                  levelBefore: r.levelBefore,
                  levelAfter: r.levelAfter,
                  milestones: r.milestones,
                  reward: r.reward,
                  account: r.state.account,
                  rested: opt === 'rest',
                });
              }}
              coachHold={!!growth}
              onPlayMatch={() => {
                const r = runMatchDay(game, []);
                setMatchRun({ base: game, orders: [] });
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
          onNewCareer={() => setRoute(pending ? { name: 'pay' } : { name: 'create' })}
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
