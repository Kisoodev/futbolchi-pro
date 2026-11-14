import { tx } from '../i18n';
import { FlagUz } from '../art/FlagUz';
import { APP_VERSION, TEAM, TEAM_NAME } from '../content/credits';

/** About the team (Oyinlab.uz), its mission, and the game. */
export function InfoScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen panel info">
      <header className="panel-head">
        <button className="link" onClick={onBack}>{tx.infoBack}</button>
        <h1>{tx.infoTitle}</h1>
      </header>
      <div className="panel-body info-grid">
        <section className="team-card">
          <p className="eyebrow">{tx.infoTeamTitle}</p>
          <h2 className="team-name"><FlagUz /> {TEAM_NAME}</h2>
          <p>{tx.infoTeamText}</p>
          <div className="team-facts">
            <span>📅 {tx.infoFounded}</span>
            <span>👥 {tx.infoTeamSize}</span>
          </div>
          <h2>{tx.infoMissionTitle}</h2>
          <p className="mission">{tx.infoMissionText}</p>
        </section>
        <section>
          <h2>{tx.infoMembersTitle}</h2>
          <ul className="members">
            {TEAM.map((n) => (
              <li key={n}>
                <span className="member-badge" aria-hidden>{n.charAt(0).toUpperCase()}</span>
                <strong>{n}</strong>
              </li>
            ))}
          </ul>
          <h2>{tx.infoAboutTitle}</h2>
          <p>{tx.infoAboutText}</p>
          <p className="legal">{tx.infoLegal}</p>
          <p className="muted small">{tx.infoVersion(APP_VERSION)}</p>
        </section>
      </div>
    </div>
  );
}
