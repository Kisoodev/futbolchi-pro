import { useMemo, useState } from 'react';
import { currentSeason, seasonFacts, seasonStory, type GameState } from '@futbolchi/engine';
import { lang, tx } from '../i18n';
import { LeagueTable } from '../components/common';
import { renderShareCard, shareOrDownload } from '../share/ShareCard';

interface Props {
  state: GameState;
  onNextSeason: (acceptClubId: string | null) => void;
}

export function SummaryScreen({ state, onNextSeason }: Props) {
  const season = currentSeason(state);
  const facts = useMemo(() => seasonFacts(state, season.id), [state, season.id]);
  // Rebuilt from facts so it always follows the current language.
  const story = seasonStory(facts, lang);
  const club = state.clubs[state.persona.clubId];
  const [preview, setPreview] = useState<string | null>(null);

  const card = () => renderShareCard(facts, story, club.color, state.persona.appearance);
  const share = async () =>
    shareOrDownload(await card(), `futbolchi-${season.index}-mavsum.png`, tx.shareText(facts.personaName));
  const showPreview = async () => setPreview((await card()).toDataURL('image/png'));

  return (
    <div className="screen split summary">
      <div className="panel">
        <header className="panel-head">
          <p className="eyebrow">{tx.summaryTitle(season.index)}</p>
          <h1 className={`outcome ${facts.outcome}`}>
            {tx.finalPosition(facts.finalPosition)} · {tx.outcomes[facts.outcome]}
          </h1>
        </header>
        <div className="panel-body">
          <p className="story">{story}</p>
          <div className="tiles">
            <div><strong>{facts.apps}</strong><span>{tx.sumApps}</span></div>
            {facts.position === 'GK' ? (
              <div><strong>{facts.saves}</strong><span>{tx.sumSaves}</span></div>
            ) : (
              <div><strong>{facts.goals}</strong><span>{tx.sumGoals}</span></div>
            )}
            <div><strong>{facts.assists}</strong><span>{tx.sumAssists}</span></div>
            <div><strong>{facts.avgRating?.toFixed(1) ?? '—'}</strong><span>{tx.sumRating}</span></div>
          </div>
          <div className="row">
            <button onClick={share}>{tx.share}</button>
            <button onClick={showPreview}>{tx.downloadCard}</button>
          </div>
          {state.transferOffers.length > 0 && (
            <section className="card transfer">
              <h2>{tx.transferTitle}</h2>
              <p>{tx.transferText}</p>
              {state.transferOffers.map((o) => (
                <button key={o.clubId} className="primary" onClick={() => onNextSeason(o.clubId)}>
                  {tx.transferAccept(state.clubs[o.clubId].name)}
                </button>
              ))}
            </section>
          )}
        </div>
        <footer className="panel-foot">
          <button className="primary big" onClick={() => onNextSeason(null)}>
            {state.transferOffers.length > 0 ? tx.stay(club.name) : tx.nextSeason} →
          </button>
        </footer>
      </div>

      <section className="card table-card">
        <h2>{tx.table}</h2>
        <LeagueTable season={season} clubs={state.clubs} highlightId={season.clubIds.includes(club.id) ? club.id : ''} />
      </section>

      {preview && (
        <div className="modal" role="dialog" aria-modal="true" aria-label={tx.downloadCard} onClick={() => setPreview(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <img className="card-preview" src={preview} alt={tx.summaryTitle(season.index)} />
            <div className="row">
              <a className="button primary" href={preview} download={`futbolchi-${season.index}-mavsum.png`}>
                {tx.downloadCard}
              </a>
              <button onClick={() => setPreview(null)}>{tx.close}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
