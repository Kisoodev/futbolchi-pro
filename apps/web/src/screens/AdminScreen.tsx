/**
 * Admin panel (owner only, shared token = ADMIN_TOKEN on the server):
 *  - free entry: grant this browser a persona slot without paying
 *  - payments: view uploaded receipts, approve or reject
 *  - highlights: mark match events (no video pipeline yet)
 * The token is kept in memory only, never stored.
 */
import { useCallback, useMemo, useState } from 'react';
import type { MatchEvent } from '@futbolchi/engine';
import { formatMoney, tx } from '../i18n';
import { adminApi, type AdminPayment } from '../state/api';
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
      setMsg(tx.adminBadToken);
    }
  };

  const guard = async (fn: () => Promise<void>) => {
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg(tx.adminError(e instanceof Error ? e.message : String(e)));
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
        const answer = prompt(tx.adminRejectPrompt);
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
      setMsg(tx.adminSaved);
    });

  if (!authed) {
    return (
      <div className="screen narrow admin login">
        <a className="link" href="#/">{tx.adminBackToGame}</a>
        <h1>{tx.adminTitle}</h1>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            void login();
          }}
        >
          <input type="password" placeholder={tx.adminToken} value={token} autoComplete="off" onChange={(e) => setToken(e.target.value)} />
          <button className="primary" type="submit" disabled={!token}>{tx.adminLogin}</button>
        </form>
        {msg && <p className="error">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="screen panel admin">
      <header className="panel-head">
        <a className="link" href="#/">{tx.adminBackToGame}</a>
        <h1>{tx.adminTitle}</h1>
        {msg && <p className="muted">{msg}</p>}
      </header>
      <div className="panel-body">

      <section className="card">
        <h2>{tx.adminFreeTitle}</h2>
        <p className="muted">{tx.adminFreeText}</p>
        {granted ? <p className="success">{tx.adminFreeDone}</p> : <button className="primary" onClick={grant}>{tx.adminFreeButton}</button>}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>{tx.adminPaymentsTitle}</h2>
          <button onClick={() => guard(loadPayments)}>{tx.adminRefresh}</button>
        </div>
        {payments.length === 0 && <p className="muted">{tx.adminPaymentsEmpty}</p>}
        <ul className="pay-list">
          {payments.map((p) => {
            const waiting = p.status === 'pending' && p.proof?.status === 'submitted';
            return (
              <li key={p.paymentId} className={waiting ? 'waiting' : ''}>
                <div className="pay-row">
                  <div>
                    <strong>{p.userName ?? '—'}</strong>
                    <span className="muted small"> · {formatMoney(p.amountMinor)} · {p.provider}</span>
                    <div className="muted small">{new Date(p.createdAt).toLocaleString(tx.dateLocale)}</div>
                  </div>
                  <span className={`badge ${waiting ? 'waiting' : p.status}`}>{waiting ? tx.adminWaiting : tx.adminStatus[p.status]}</span>
                </div>
                {p.proof ? (
                  proofs[p.paymentId] ? (
                    <a href={proofs[p.paymentId]} target="_blank" rel="noreferrer">
                      <img className="proof" src={proofs[p.paymentId]} alt="" />
                    </a>
                  ) : (
                    <button onClick={() => showProof(p)}>{tx.adminShowProof}</button>
                  )
                ) : (
                  p.provider === 'manual' && <span className="muted small">{tx.adminNoProof}</span>
                )}
                {p.status === 'pending' && p.provider === 'manual' && (
                  <div className="row">
                    <button className="primary" onClick={() => decide(p, 'approve')}>{tx.adminApprove}</button>
                    <button onClick={() => decide(p, 'reject')}>{tx.adminReject}</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>{tx.adminHighlightsTitle}</h2>
          <button onClick={loadMatches}>{tx.adminLoad}</button>
        </div>
        {matches && matches.length === 0 && <p className="muted">{tx.adminNoMatches}</p>}
        {matches && (
          <ul className="admin-list">
            {matches.map((m) => (
              <li key={`${m.userId}/${m.matchId}`}>
                <button className={selected?.matchId === m.matchId && selected.userId === m.userId ? 'on' : ''} onClick={() => open(m)}>
                  {tx.adminMatchRow(m.week, m.home, m.away, m.score[0], m.score[1])}
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
                    <td>{tx.eventIcons[e.type]} {e.type}</td>
                    <td>{e.team}</td>
                    <td>{e.actor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="primary" onClick={saveHighlights}>{tx.adminSave}</button>
          </>
        )}
      </section>
      </div>
    </div>
  );
}
