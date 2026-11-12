import {
  personaOvr,
  sortTable,
  STAT_KEYS,
  constants as C,
  type Club,
  type PersonaView,
  type Season,
} from '@futbolchi/engine';
import { uz } from '../i18n/uz';

export function StatBars({ persona }: { persona: PersonaView }) {
  const w = C.POSITION_WEIGHTS[persona.position];
  return (
    <ul className="stat-bars">
      {STAT_KEYS.map((k) => (
        <li key={k} className={w[k] >= 0.15 ? 'key' : ''}>
          <span className="label">{uz.stats[k]}</span>
          <span className="bar">
            <span style={{ width: `${persona.stats[k]}%` }} />
          </span>
          <span className="val">{Math.round(persona.stats[k])}</span>
        </li>
      ))}
    </ul>
  );
}

export function PersonaHeader({ persona, club }: { persona: PersonaView; club: Club }) {
  return (
    <div className="persona-header" style={{ borderColor: club.color }}>
      <div className="ovr">
        <strong>{Math.round(personaOvr(persona))}</strong>
        <small>{uz.ovr}</small>
      </div>
      <div>
        <h2>{persona.name}</h2>
        <p className="muted">
          {uz.positions[persona.position]} · {club.name} · {uz.age(persona.age)}
        </p>
        <p className="muted small">{uz.careerLine(persona.career.apps, persona.career.goals, persona.career.assists)}</p>
      </div>
    </div>
  );
}

export function FatigueMeter({ value }: { value: number }) {
  const level = value >= 70 ? 'high' : value >= 40 ? 'mid' : 'low';
  return (
    <div className="fatigue">
      <span>{uz.fatigue}</span>
      <span className={`meter ${level}`}>
        <span style={{ width: `${value}%` }} />
      </span>
      <span className="val">{Math.round(value)}</span>
    </div>
  );
}

export function LeagueTable({ season, clubs, highlightId }: { season: Season; clubs: Record<string, Club>; highlightId: string }) {
  const rows = sortTable(season.table, clubs);
  const n = rows.length;
  return (
    <table className="league">
      <thead>
        <tr>
          <th>{uz.tableCols.pos}</th>
          <th className="club">{uz.tableCols.club}</th>
          <th>{uz.tableCols.p}</th>
          <th>{uz.tableCols.gd}</th>
          <th>{uz.tableCols.pts}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const zone =
            season.tier > 1 && i < C.PROMOTION_SPOTS ? 'up' : season.tier < 4 && i >= n - C.RELEGATION_SPOTS ? 'down' : '';
          return (
            <tr key={r.clubId} className={`${zone} ${r.clubId === highlightId ? 'me' : ''}`}>
              <td>{i + 1}</td>
              <td className="club">
                <span className="dot" style={{ background: clubs[r.clubId].color }} />
                {clubs[r.clubId].name}
              </td>
              <td>{r.played}</td>
              <td>{r.gf - r.ga > 0 ? `+${r.gf - r.ga}` : r.gf - r.ga}</td>
              <td>
                <strong>{r.points}</strong>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
