import { tx } from '../i18n';
import { APP_VERSION, CREDITS } from '../content/credits';

/** About the game and the people who made it. */
export function InfoScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen panel info">
      <header className="panel-head">
        <button className="link" onClick={onBack}>{tx.infoBack}</button>
        <h1>{tx.infoTitle}</h1>
      </header>
      <div className="panel-body info-grid">
        <section>
          <h2>{tx.infoAboutTitle}</h2>
          <p>{tx.infoAboutText}</p>
          <p className="legal">{tx.infoLegal}</p>
          <p className="muted small">{tx.infoVersion(APP_VERSION)}</p>
        </section>
        <section>
          <h2>{tx.infoCreditsTitle}</h2>
          <dl className="credits">
            {CREDITS.map((g) => (
              <div key={g.role}>
                <dt>{tx.creditRoles[g.role]}</dt>
                {g.names.length > 0 ? g.names.map((n) => <dd key={n}>{n}</dd>) : <dd className="tba">{tx.infoTba}</dd>}
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
