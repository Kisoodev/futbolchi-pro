import { uz } from '../i18n/uz';
import { APP_VERSION, CREDITS } from '../content/credits';

/** About the game and the people who made it. */
export function InfoScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen panel info">
      <header className="panel-head">
        <button className="link" onClick={onBack}>{uz.infoBack}</button>
        <h1>{uz.infoTitle}</h1>
      </header>
      <div className="panel-body info-grid">
        <section>
          <h2>{uz.infoAboutTitle}</h2>
          <p>{uz.infoAboutText}</p>
          <p className="legal">{uz.infoLegal}</p>
          <p className="muted small">{uz.infoVersion(APP_VERSION)}</p>
        </section>
        <section>
          <h2>{uz.infoCreditsTitle}</h2>
          <dl className="credits">
            {CREDITS.map((g) => (
              <div key={g.role}>
                <dt>{g.role}</dt>
                {g.names.length > 0 ? g.names.map((n) => <dd key={n}>{n}</dd>) : <dd className="tba">{uz.infoTba}</dd>}
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
