/**
 * Admin panel (owner only, shared token = ADMIN_TOKEN on the server):
 *  - free entry: grant this browser a persona slot without paying
 *  - payments: view uploaded receipts, approve or reject
 *  - highlights: mark match events (no video pipeline yet)
 * The token is kept in memory only, never stored.
 */
import { useCallback, useMemo, useState } from 'react';
import type { MatchEvent } from '@futbolchi/engine';
import { uz } from '../i18n/uz';
import { adminApi, formatUzs, type AdminPayment } from '../state/api';
import { getUserId } from '../state/store';

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
  const [authed, setAuthed] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const admin = useMemo(() => adminApi(token), [token]);

  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [proofs, setProofs] = useState<Record<string, string>>({});
  const [granted, setGranted] = useState(false);

  const [matches, setMatches] = useState<MatchSummary[] | null>(null);
  const [selected, setSelected] = useState<MatchSummary | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [marked, setMarked] = useState<Set<string>>(new Set());

  const loadPayments = useCallback(async () => {
    setPayments((await admin.payments()).payments);
  }, [admin]);

  const login = async () => {
    setMsg(null);
    try {
      await admin.ping();
      setAuthed(true);
      await loadPayments();
    } catch {
      setMsg(uz.adminBadToken);
    }
  };

  const guard = async (fn: () => Promise<void>) => {
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg(`Xato: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const grant = () =>
    guard(async () => {
      await admin.grant(getUserId());
      setGranted(true);
      await loadPayments();
    });

  const decide = (p: AdminPayment, decision: 'approve' | 'reject') =>
    guard(async () => {
      let note: string | undefined;
      if (decision === 'reject') {
        const answer = prompt(uz.adminRejectPrompt);
        if (answer === null) return;
        note = answer.trim() || undefined;
      }
      await admin.decide(p.paymentId, decision, note);
      await loadPayments();
    });

  const showProof = (p: AdminPayment) =>
    guard(async () => {
      const url = await admin.proofUrl(p.paymentId);
      setProofs((prev) => ({ ...prev, [p.paymentId]: url }));
    });

  const loadMatches = () =>
    guard(async () => {
      const res = await fetch('/api/admin/matches', { headers: admin.headers });
      if (!res.ok) throw new Error(String(res.status));
      setMatches(((await res.json()) as { matches: MatchSummary[] }).matches);
    });

  const open = (m: MatchSummary) =>
    guard(async () => {
      setSelected(m);
      const res = await fetch(`/api/admin/matches/${encodeURIComponent(m.matchId)}/events?userId=${encodeURIComponent(m.userId)}`, { headers: admin.headers });
      if (!res.ok) throw new Error(String(res.status));
      const evs = ((await res.json()) as { events: MatchEvent[] }).events;
      setEvents(evs);
      setMarked(new Set(evs.filter((e) => e.highlight).map((e) => e.id)));
    });

  const saveHighlights = () =>
    guard(async () => {
      if (!selected) return;
      const res = await fetch(`/api/admin/matches/${encodeURIComponent(selected.matchId)}/highlights`, {
        method: 'POST',
        headers: { ...admin.headers, 'content-type': 'application/json' },
        body: JSON.stringify({ userId: selected.userId, eventIds: [...marked] }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setMsg(uz.adminSaved);
    });

  if (!authed) {
    return (
      <div className="screen narrow admin">
        <a className="link" href="#/">{uz.adminBackToGame}</a>
        <h1>{uz.adminTitle}</h1>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            void login();
          }}
        >
          <input type="password" placeholder={uz.adminToken} value={token} autoComplete="off" onChange={(e) => setToken(e.target.value)} />
          <button className="primary" type="submit" disabled={!token}>{uz.adminLogin}</button>
        </form>
        {msg && <p className="error">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="screen narrow wide-ish admin">
      <a className="link" href="#/">{uz.adminBackToGame}</a>
      <h1>{uz.adminTitle}</h1>
      {msg && <p className="muted">{msg}</p>}

      <section className="card">
        <h2>{uz.adminFreeTitle}</h2>
        <p className="muted">{uz.adminFreeText}</p>
        {granted ? <p className="success">{uz.adminFreeDone}</p> : <button className="primary" onClick={grant}>{uz.adminFreeButton}</button>}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>{uz.adminPaymentsTitle}</h2>
          <button onClick={() => guard(loadPayments)}>{uz.adminRefresh}</button>
        </div>
        {payments.length === 0 && <p className="muted">{uz.adminPaymentsEmpty}</p>}
        <ul className="pay-list">
          {payments.map((p) => {
            const waiting = p.status === 'pending' && p.proof?.status === 'submitted';
            return (
              <li key={p.paymentId} className={waiting ? 'waiting' : ''}>
                <div className="pay-row">
                  <div>
                    <strong>{p.userName ?? '—'}</strong>
                    <span className="muted small"> · {formatUzs(p.amountMinor)} · {p.provider}</span>
                    <div className="muted small">{new Date(p.createdAt).toLocaleString('uz-UZ')}</div>
                  </div>
                  <span className={`badge ${waiting ? 'waiting' : p.status}`}>{waiting ? uz.adminWaiting : uz.adminStatus[p.status]}</span>
                </div>
                {p.proof ? (
                  proofs[p.paymentId] ? (
                    <a href={proofs[p.paymentId]} target="_blank" rel="noreferrer">
                      <img className="proof" src={proofs[p.paymentId]} alt="" />
                    </a>
                  ) : (
                    <button onClick={() => showProof(p)}>{uz.adminShowProof}</button>
                  )
                ) : (
                  p.provider === 'manual' && <span className="muted small">{uz.adminNoProof}</span>
                )}
                {p.status === 'pending' && p.provider === 'manual' && (
                  <div className="row">
                    <button className="primary" onClick={() => decide(p, 'approve')}>{uz.adminApprove}</button>
                    <button onClick={() => decide(p, 'reject')}>{uz.adminReject}</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>{uz.adminHighlightsTitle}</h2>
          <button onClick={loadMatches}>{uz.adminLoad}</button>
        </div>
        {matches && matches.length === 0 && <p className="muted">{uz.adminNoMatches}</p>}
        {matches && (
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
        )}
        {selected && (
          <>
            <h2 className="small">{selected.matchId}</h2>
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
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="primary" onClick={saveHighlights}>{uz.adminSave}</button>
          </>
        )}
      </section>
    </div>
  );
}
