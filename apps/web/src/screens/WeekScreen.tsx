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
import { uz } from '../i18n/uz';
import { FatigueMeter, LeagueTable, PersonaHeader, StatBars } from '../components/common';

interface Props {
  state: GameState;
  onPlay: (option: TrainingId) => void;
}

function Effects({ id }: { id: TrainingId }) {
  const opt = getTrainingOption(id);
  const chips: { text: string; tone: 'good' | 'bad' }[] = [];
  for (const [k, v] of Object.entries(opt.gains) as [StatKey, number][]) {
    chips.push({ text: `${uz.stats[k]} ${v > 0 ? (v >= 0.5 ? '++' : '+') : '−'}`, tone: v > 0 ? 'good' : 'bad' });
  }
  if (Object.keys(opt.gains).length === 0) chips.push({ text: uz.effNoGrowth, tone: 'bad' });
  if (opt.fatigue !== 0) chips.push({ text: uz.effFatigue(opt.fatigue), tone: opt.fatigue < 0 ? 'good' : 'bad' });
  if (opt.injuryRisk > 0) chips.push({ text: uz.effInjury(Math.round(opt.injuryRisk * 100)), tone: 'bad' });
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
      <section className="card">
        <p className="eyebrow">{uz.seasonWeek(season.index, season.week, seasonWeeks(season))}</p>
        <PersonaHeader persona={persona} club={club} />
        <FatigueMeter value={persona.fatigue} />
        {persona.injuryWeeksLeft > 0 && <p className="warn">{uz.injured(persona.injuryWeeksLeft)}</p>}
        <StatBars persona={persona} />
      </section>

      <section className="card">
        <h2>{uz.trainingTitle}</h2>
        <p className="muted">{uz.trainingHint}</p>
        <div className="options">
          {offer.map((id) => (
            <button key={id} className={`option ${choice === id ? 'on' : ''}`} onClick={() => setChoice(id)}>
              <strong>{uz.trainingNames[id]}</strong>
              <Effects id={id} />
            </button>
          ))}
        </div>
        {fx && <p className="next-match">{uz.nextMatch(state.clubs[fx.homeId].name, state.clubs[fx.awayId].name)}</p>}
        <button className="primary big" disabled={!choice} onClick={() => choice && onPlay(choice)}>
          {uz.playWeek} →
        </button>
      </section>

      <section className="card">
        <h2>{uz.table}</h2>
        <LeagueTable season={season} clubs={state.clubs} highlightId={club.id} />
      </section>
    </div>
  );
}
