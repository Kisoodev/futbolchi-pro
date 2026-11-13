import { useState } from 'react';
import {
  currentSeason,
  getTrainingOption,
  personaView,
  seasonWeeks,
  trainingOffer,
  type GameState,
  type StatKey,
  type TrainingId,
} from '@futbolchi/engine';
import { tx } from '../i18n';
import { FatigueMeter, LeagueTable, PersonaHeader, StatBars } from '../components/common';

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

export function WeekScreen({ state, onPlay }: Props) {
  const season = currentSeason(state);
  const offer = trainingOffer(state);
  const [choice, setChoice] = useState<TrainingId | null>(null);
  const persona = personaView(state.persona);
  const club = state.clubs[persona.clubId];
  const fx = season.fixtures.find((f) => f.week === season.week && (f.homeId === club.id || f.awayId === club.id));

  return (
    <div className="screen grid">
      <section className="card persona-card">
        <p className="eyebrow">{tx.seasonWeek(season.index, season.week, seasonWeeks(season))}</p>
        <PersonaHeader persona={persona} club={club} />
        <FatigueMeter value={persona.fatigue} />
        {persona.injuryWeeksLeft > 0 && <p className="warn">{tx.injured(persona.injuryWeeksLeft)}</p>}
        <StatBars persona={persona} />
      </section>

      <section className="card train-card">
        <h2>{tx.trainingTitle}</h2>
        <p className="muted">{tx.trainingHint}</p>
        <div className="options">
          {offer.map((id) => (
            <button key={id} className={`option ${choice === id ? 'on' : ''}`} onClick={() => setChoice(id)}>
              <strong>{tx.trainingNames[id]}</strong>
              <Effects id={id} />
            </button>
          ))}
        </div>
        {fx && <p className="next-match">{tx.nextMatch(state.clubs[fx.homeId].name, state.clubs[fx.awayId].name)}</p>}
        <button className="primary big" disabled={!choice} onClick={() => choice && onPlay(choice)}>
          {tx.playWeek} →
        </button>
      </section>

      <section className="card table-card">
        <h2>{tx.table}</h2>
        <LeagueTable season={season} clubs={state.clubs} highlightId={club.id} />
      </section>
    </div>
  );
}
