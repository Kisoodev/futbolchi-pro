/**
 * Minimal admin stub: list match events for a match and mark highlights.
 * No video pipeline yet. Auth is a shared token (ADMIN_TOKEN on the server).
 */
import { useState } from 'react';
import type { MatchEvent } from '@futbolchi/engine';
import { uz } from '../i18n/uz';

interface MatchSummary {
  matchId: string;
  userId: string;
  week: number;
  home: string;
  away: string;
  score: [number, number];
}

export function AdminScreen() {
  const [token, setToken] = useState('');
  const [matches, setMatches] = useState<MatchSummary[] | null>(null);
  const [selected, setSelected] = useState<MatchSummary | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);

  const headers = { 'x-admin-token': token, 'content-type': 'application/json' };

  const loadMatches = async () => {
    setMsg(null);
    const res = await fetch('/api/admin/matches', { headers });
    if (!res.ok) return setMsg(`Xato: ${res.status}`);
    setMatches(((await res.json()) as { matches: MatchSummary[] }).matches);
  };

  const open = async (m: MatchSummary) => {
    setSelected(m);
    setMsg(null);
    const res = await fetch(`/api/admin/matches/${encodeURIComponent(m.matchId)}/events?userId=${encodeURIComponent(m.userId)}`, { headers });
    if (!res.ok) return setMsg(`Xato: ${res.status}`);
    const evs = ((await res.json()) as { events: MatchEvent[] }).events;
    setEvents(evs);
    setMarked(new Set(evs.filter((e) => e.highlight).map((e) => e.id)));
  };

  const save = async () => {
    if (!selected) return;
    const res = await fetch(`/api/admin/matches/${encodeURIComponent(selected.matchId)}/highlights`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId: selected.userId, eventIds: [...marked] }),
    });
    setMsg(res.ok ? uz.adminSaved : `Xato: ${res.status}`);
  };

  return (
    <div className="screen narrow admin">
      <h1>{uz.adminTitle}</h1>
      <div className="row">
        <input type="password" placeholder={uz.adminToken} value={token} onChange={(e) => setToken(e.target.value)} />
        <button onClick={loadMatches}>{uz.adminLoad}</button>
      </div>
      {msg && <p className="muted">{msg}</p>}
      {matches && (
        <section className="card">
          <h2>{uz.adminMatches}</h2>
          {matches.length === 0 && <p className="muted">{uz.adminNoMatches}</p>}
          <ul className="admin-list">
            {matches.map((m) => (
              <li key={`${m.userId}/${m.matchId}`}>
                <button className={selected?.matchId === m.matchId && selected.userId === m.userId ? 'on' : ''} onClick={() => open(m)}>
                  {m.week}-hafta: {m.home} {m.score[0]}:{m.score[1]} {m.away}
                  <small className="muted"> · {m.matchId}</small>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {selected && (
        <section className="card">
          <h2>{selected.matchId}</h2>
          <table className="events">
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={marked.has(e.id)}
                      onChange={(ev) => {
                        const next = new Set(marked);
                        if (ev.target.checked) next.add(e.id);
                        else next.delete(e.id);
                        setMarked(next);
                      }}
                    />
                  </td>
                  <td>{e.minute}'</td>
                  <td>{uz.eventIcons[e.type]} {e.type}</td>
                  <td>{e.team}</td>
                  <td>{e.actor}</td>
                  <td className="muted small">{e.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="primary" onClick={save}>{uz.adminSave}</button>
        </section>
      )}
    </div>
  );
}
