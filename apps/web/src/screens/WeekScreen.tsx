import { useState } from 'react';
import {
  captainOf,
  squadAvg,
  nextLineup,
  currentSeason,
  dayOf,
  getTrainingOption,
  personaLevel,
  personaView,
  sortTable,
  tierName,
  seasonWeeks,
  trainingOffer,
  type GameState,
  type TrainingId,
} from '@futbolchi/engine';
import { lang, tx } from '../i18n';
import { FatigueMeter, LeagueTable, PersonaHeader, StatBars } from '../components/common';
import { Avatar } from '../art/Avatar';
import { CoachGuide } from '../coach/CoachGuide';
import { progressTexts } from '../i18n/progress';
import { RatingCard } from '../components/RatingCard';
import { LeaguePath } from '../components/LeaguePath';
import { LineupBoard } from '../components/LineupBoard';
import { Crest } from '../components/Crest';

interface Props {
  state: GameState;
  /** Day 1: the chosen training (one of the three offered). */
  onTrain: (option: TrainingId) => void;
  /** Day 2: play the match. */
  onPlayMatch: () => void;
  /** The coach waits while another sheet is open. */
  coachHold?: boolean;
}

/** What a training strengthens, how tiring it is and whether it risks an injury — in words. */
function Effects({ id }: { id: TrainingId }) {
  const opt = getTrainingOption(id);
  const pt = progressTexts();
  const chips: { text: string; tone: 'good' | 'bad' | 'mid' }[] = [];
  for (const k of opt.focus) chips.push({ text: `▲ ${tx.stats[k]}`, tone: 'good' });
  const f = opt.fatigue;
  chips.push(
    f < 0
      ? { text: pt.fatigue.down, tone: 'good' }
      : f <= 5
        ? { text: pt.fatigue.low, tone: 'mid' }
        : f <= 10
          ? { text: pt.fatigue.mid, tone: 'mid' }
          : { text: pt.fatigue.high, tone: 'bad' },
  );
  if (opt.injuryRisk > 0) chips.push({ text: pt.injuryRisk, tone: 'bad' });
  return (
    <span className="effects">
      {chips.map((c) => (
        <span key={c.text} className={`eff ${c.tone}`}>
          {c.text}
        </span>
      ))}
    </span>
  );
}

/** Phone: one section at a time, picked from the bottom bar. PC shows all three. */
type View = 'me' | 'train' | 'table';
const VIEW_ICONS: Record<View, string> = { me: '👤', train: '⚽', table: '🏆' };

export function WeekScreen({ state, onTrain, onPlayMatch, coachHold }: Props) {
  const [view, setView] = useState<View>('train');
  const season = currentSeason(state);
  const offer = trainingOffer(state);
  const [choice, setChoice] = useState<TrainingId | null>(null);
  const [board, setBoard] = useState(false);
  const persona = personaView(state.persona);
  const club = state.clubs[persona.clubId];
  const fx = season.fixtures.find((f) => f.week === season.week && (f.homeId === club.id || f.awayId === club.id));
  const weekLine = tx.seasonWeek(season.index, season.week, seasonWeeks(season));
  const fatigue = Math.round(persona.fatigue);
  const fatigueLevel = fatigue >= 70 ? 'high' : fatigue >= 40 ? 'mid' : 'low';
  // Table places and the club's recent form, for the phone home view.
  const rows = sortTable(season.table, state.clubs);
  const placeOf = (id: string) => rows.findIndex((r) => r.clubId === id) + 1;
  const form = season.matchIds
    .map((id) => state.matches[id])
    .filter((m): m is NonNullable<typeof m> => !!m)
    .slice(-5)
    .map((m) => {
      const [mine, theirs] = m.homeId === club.id ? m.score : [m.score[1], m.score[0]];
      return mine > theirs ? 'W' : mine < theirs ? 'L' : 'D';
    }) as ('W' | 'D' | 'L')[];
  const atHome = fx ? fx.homeId === club.id : false;
  const pt = progressTexts();
  const day = dayOf(state);
  const lastTraining = (season.trainingLog.find((l) => l.week === season.week)?.optionId as TrainingId | undefined) ?? null;
  const level = personaLevel(persona);
  const captain = club.squad?.length ? captainOf(club.squad) : undefined;
  const gap = captain ? captain.ovr - level : null;
  // the rival from the bible (Odil), when he is in this squad
  const rival = club.squad?.find((p) => p.characterKey === 'odil');
  // how much the squad has grown this season (teamGrowth: faster when the persona trains)
  const teamNow = club.squad?.length ? squadAvg(club.squad) : null;
  const teamDelta = teamNow !== null ? teamNow - (season.teamStartOvr ?? teamNow) : 0;

  return (
    <div className={`screen grid week view-${view} day-${day}`}>
      {/* Phone: who you are and where you stand, on the training and table tabs */}
      <header className="m-status" style={{ borderColor: club.color }}>
        <Avatar appearance={persona.appearance} kit={club.color} scale={1} crop="bust" className="m-status-avatar" />
        <div className="m-status-main">
          <strong>{persona.name}</strong>
          <span>
            <b className="m-pos">{persona.position}</b> {club.name}
          </span>
          <span>{weekLine}</span>
        </div>
        <div className="m-status-side">
          <RatingCard level={level} size="sm" />
          <span className="m-place">🏆 {tx.tablePlace(placeOf(club.id), rows.length)}</span>
          <span className={`m-fatigue ${fatigueLevel}`} title={tx.fatigue} aria-label={`${tx.fatigue}: ${fatigue}`}>
            <i style={{ width: `${fatigue}%` }} />
          </span>
        </div>
      </header>

      <section className={`card persona-card ${view === 'me' ? 'm-on' : ''}`}>
        <p className="eyebrow">{weekLine}</p>
        <PersonaHeader persona={persona} club={club} />
        <FatigueMeter value={persona.fatigue} />
        {persona.injuryWeeksLeft > 0 && <p className="warn">{tx.injured(persona.injuryWeeksLeft)}</p>}
        <StatBars persona={persona} />
        {gap !== null && <p className="captain-gap">👑 {gap > 0 ? pt.captainGap(gap) : pt.captainAbove(-gap)}</p>}
        {rival && <p className="captain-gap rival-line">{pt.rivalLine(rival.name, rival.ovr, level)}</p>}
        {teamNow !== null && (
          <p className="captain-gap team-line">
            {pt.teamLine(teamNow.toFixed(1), `${teamDelta >= 0 ? '▲' : '▼'}${Math.abs(teamDelta).toFixed(1)}`)}
          </p>
        )}
      </section>

      <section className={`card train-card ${view === 'train' ? 'm-on' : ''}`}>
        {fx && (
          <div className="fixture" aria-label={tx.nextMatch(state.clubs[fx.homeId].name, state.clubs[fx.awayId].name)}>
            <div className="fixture-top">
              <span className="eyebrow">{tx.weekNextMatch}</span>
              <span className="fixture-league">{tierName(season.tier, lang)}</span>
            </div>
            <div className="fixture-teams">
              {[fx.homeId, fx.awayId].map((id, i) => (
                <span key={id} className={`fixture-team ${id === club.id ? 'me' : ''} ${i ? 'away' : 'home'}`}>
                  <Crest club={state.clubs[id]} size={22} />
                  <span className="fixture-name">{state.clubs[id].name}</span>
                  <small>#{placeOf(id)}</small>
                </span>
              ))}
            </div>
            {(() => {
              const opp = state.clubs[atHome ? fx.awayId : fx.homeId];
              return opp.style ? (
                <p className="fixture-style">
                  {pt.opponentStyle}: <b>{pt.clubStyles[opp.style]}</b>
                </p>
              ) : null;
            })()}
            <div className="fixture-foot">
              <span className="venue">{atHome ? `🏠 ${tx.homeLabel}` : `✈️ ${tx.awayLabel}`}</span>
              <span className="form" aria-label={tx.formLabel}>
                {form.length ? (
                  form.map((r, i) => (
                    <i key={i} className={`form-${r}`} title={tx.formNames[r]}>
                      {tx.formLetters[r]}
                    </i>
                  ))
                ) : (
                  <em>{tx.formNone}</em>
                )}
              </span>
            </div>
          </div>
        )}
        <LeaguePath tier={season.tier} />
        <span className={`day-chip ${day}`}>{pt.dayChip(day === 'training' ? 1 : 2)}</span>
        {day === 'match' ? (
          <div className="match-day">
            <h2>{pt.matchDayTitle}</h2>
            <p className="muted">{pt.matchDayText}</p>
            <p className="trained-line">{lastTraining === 'rest' || lastTraining === null ? pt.todayRested : pt.todayTrained(tx.trainingNames[lastTraining as TrainingId])}</p>
            <button type="button" className="lineup-btn" onClick={() => setBoard(true)}>
              {pt.lineupButton}
            </button>
            <button className="primary big play-btn" onClick={onPlayMatch}>
              {pt.playMatch}
            </button>
          </div>
        ) : (
          <>
        <h2>{tx.trainingTitle}</h2>
        <p className="muted">{pt.trainHint}</p>
        <div className="options" role="radiogroup" aria-label={tx.trainingTitle}>
          {offer.map((id) => (
            <button key={id} type="button" role="radio" aria-checked={choice === id} className={`option ${choice === id ? 'on' : ''}`} onClick={() => setChoice(id)}>
              <span className="radio" aria-hidden />
              <strong>{tx.trainingNames[id]}</strong>
              <Effects id={id} />
            </button>
          ))}
        </div>
        <button className="primary big play-btn" disabled={!choice} onClick={() => choice && onTrain(choice)}>
          {pt.trainButton} →
        </button>
          </>
        )}
      </section>

      <section className={`card table-card ${view === 'table' ? 'm-on' : ''}`}>
        <h2>{tx.table}</h2>
        <LeagueTable season={season} clubs={state.clubs} highlightId={club.id} />
      </section>

      {board && (() => {
        const l = nextLineup(state);
        return l ? <LineupBoard lineup={l} onClose={() => setBoard(false)} /> : null;
      })()}

      {/* First week: the coach explains the screen (once, skippable) */}
      <CoachGuide key={day} lesson={day === 'training' ? 'week' : 'matchDay'} vars={{ name: persona.name, g: persona.appearance.gender }} onView={setView} hold={coachHold} />

      <nav className="m-tabs" aria-label={tx.navMenu}>
        {(['me', 'train', 'table'] as const).map((v) => (
          <button key={v} className={view === v ? 'on' : ''} aria-pressed={view === v} onClick={() => setView(v)}>
            <span aria-hidden>{v === 'train' && day === 'match' ? '🏟️' : VIEW_ICONS[v]}</span>
            {v === 'train' ? pt.tabToday[day] : tx.weekTabs[v]}
          </button>
        ))}
      </nav>
    </div>
  );
}
