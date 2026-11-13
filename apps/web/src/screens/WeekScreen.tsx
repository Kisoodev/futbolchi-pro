import { useState } from 'react';
import {
  currentSeason,
  getTrainingOption,
  personaOvr,
  personaView,
  sortTable,
  tierName,
  seasonWeeks,
  trainingOffer,
  type GameState,
  type StatKey,
  type TrainingId,
} from '@futbolchi/engine';
import { lang, tx } from '../i18n';
import { FatigueMeter, LeagueTable, PersonaHeader, StatBars } from '../components/common';
import { Avatar } from '../art/Avatar';

interface Props {
  state: GameState;
  onPlay: (option: TrainingId) => void;
}

function Effects({ id }: { id: TrainingId }) {
  const opt = getTrainingOption(id);
  const chips: { text: string; tone: 'good' | 'bad' }[] = [];
  for (const [k, v] of Object.entries(opt.gains) as [StatKey, number][]) {
    chips.push({ text: `${tx.stats[k]} ${v > 0 ? (v >= 0.5 ? '++' : '+') : '−'}`, tone: v > 0 ? 'good' : 'bad' });
  }
  if (Object.keys(opt.gains).length === 0) chips.push({ text: tx.effNoGrowth, tone: 'bad' });
  if (opt.fatigue !== 0) chips.push({ text: tx.effFatigue(opt.fatigue), tone: opt.fatigue < 0 ? 'good' : 'bad' });
  if (opt.injuryRisk > 0) chips.push({ text: tx.effInjury(Math.round(opt.injuryRisk * 100)), tone: 'bad' });
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

export function WeekScreen({ state, onPlay }: Props) {
  const [view, setView] = useState<View>('train');
  const season = currentSeason(state);
  const offer = trainingOffer(state);
  const [choice, setChoice] = useState<TrainingId | null>(null);
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

  return (
    <div className={`screen grid week view-${view}`}>
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
          <span className="m-ovr" title={tx.ovr}>
            <b>{Math.round(personaOvr(persona))}</b>
            <small>{tx.ovrShort}</small>
          </span>
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
                  <i style={{ background: state.clubs[id].color }} />
                  <span className="fixture-name">{state.clubs[id].name}</span>
                  <small>#{placeOf(id)}</small>
                </span>
              ))}
            </div>
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
        <h2>{tx.trainingTitle}</h2>
        <p className="muted">{tx.trainingHint}</p>
        <div className="options" role="radiogroup" aria-label={tx.trainingTitle}>
          {offer.map((id) => (
            <button
              key={id}
              role="radio"
              aria-checked={choice === id}
              className={`option ${choice === id ? 'on' : ''}`}
              onClick={() => setChoice(id)}
            >
              <span className="radio" aria-hidden />
              <strong>{tx.trainingNames[id]}</strong>
              <Effects id={id} />
            </button>
          ))}
        </div>
        {fx && <p className="next-match">{tx.nextMatch(state.clubs[fx.homeId].name, state.clubs[fx.awayId].name)}</p>}
        <button className="primary big play-btn" disabled={!choice} onClick={() => choice && onPlay(choice)}>
          {tx.playWeek} →
        </button>
      </section>

      <section className={`card table-card ${view === 'table' ? 'm-on' : ''}`}>
        <h2>{tx.table}</h2>
        <LeagueTable season={season} clubs={state.clubs} highlightId={club.id} />
      </section>

      <nav className="m-tabs" aria-label={tx.navMenu}>
        {(['me', 'train', 'table'] as const).map((v) => (
          <button key={v} className={view === v ? 'on' : ''} aria-pressed={view === v} onClick={() => setView(v)}>
            <span aria-hidden>{VIEW_ICONS[v]}</span>
            {tx.weekTabs[v]}
          </button>
        ))}
      </nav>
    </div>
  );
}
