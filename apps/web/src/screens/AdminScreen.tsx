/**
 * Admin panel (owner only; token = ADMIN_TOKEN on the server).
 *
 * Ways in: the hidden nickname on the name screen, Ctrl+Shift+A, or #/admin.
 * After one successful login the token is remembered in this browser, so the
 * panel opens straight away and the payment page offers a "skip" button.
 *
 * Tabs:
 *  - payments: receipts waiting for review first, approve / reject inline
 *  - free access: a free persona slot for this browser
 *  - highlights: mark match events (no video pipeline yet)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MatchEvent } from '@futbolchi/engine';
import { formatMoney, tx } from '../i18n';
import { adminApi, api, type AdminPayment } from '../state/api';
import { clearAdminToken, getAdminToken, setAdminToken } from '../state/admin';
import { getUserId } from '../state/store';

interface MatchSummary {
  matchId: string;
  userId: string;
  week: number;
  home: string;
  away: string;
  score: [number, number];
}

type Tab = 'payments' | 'free' | 'highlights';
type Filter = 'waiting' | 'all';

/** New receipts show up within a few seconds. */
const REFRESH_MS = 4000;
const isWaiting = (p: AdminPayment) => p.status === 'pending' && p.proof?.status === 'submitted';

const ALERTS_KEY = 'futbolchi.adminAlerts';
const readAlerts = () => {
  try {
    return localStorage.getItem(ALERTS_KEY) !== '0';
  } catch {
    return true;
  }
};

/** Short two-tone chime for a new receipt. */
function chime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);
    gain.gain.value = 0.05;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.28);
    osc.onended = () => void ctx.close();
  } catch {
    /* no audio: the badge and the title still show it */
  }
}

export function AdminScreen() {
  const [token, setToken] = useState(() => getAdminToken() ?? '');
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(() => !!getAdminToken());
  const [msg, setMsg] = useState<string | null>(null);
  const admin = useMemo(() => adminApi(token), [token]);
  const [tab, setTab] = useState<Tab>('payments');

  const [players, setPlayers] = useState<number | null>(null);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [filter, setFilter] = useState<Filter>('waiting');
  const [proofs, setProofs] = useState<Record<string, string>>({});
  const [zoom, setZoom] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [granted, setGranted] = useState(false);
  const [alerts, setAlerts] = useState(readAlerts);
  /** Receipts already seen; null until the first load (no alert for old ones). */
  const known = useRef<Set<string> | null>(null);

  const [matches, setMatches] = useState<MatchSummary[] | null>(null);
  const [selected, setSelected] = useState<MatchSummary | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [marked, setMarked] = useState<Set<string>>(new Set());

  const loadPayments = useCallback(async () => {
    const [list, stats] = await Promise.all([admin.payments(), api.stats().catch(() => null)]);
    setPayments(list.payments);
    if (stats) setPlayers(stats.registered);
  }, [admin]);

  const login = useCallback(
    async (silent = false) => {
      setMsg(null);
      try {
        await admin.ping();
        setAdminToken(token);
        setAuthed(true);
        await loadPayments();
      } catch {
        if (silent) clearAdminToken();
        else setMsg(tx.adminBadToken);
      } finally {
        setChecking(false);
      }
    },
    [admin, token, loadPayments],
  );

  // Remembered token: log in by itself.
  useEffect(() => {
    if (checking) void login(true);
    // Only on first open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the payment list fresh on every tab, so a new receipt is noticed at once.
  useEffect(() => {
    if (!authed) return;
    const id = setInterval(() => void loadPayments().catch(() => null), REFRESH_MS);
    return () => clearInterval(id);
  }, [authed, loadPayments]);

  // New receipt: chime + system notification (if allowed) + count in the tab title.
  const waitingIds = payments.filter(isWaiting).map((p) => p.paymentId);
  const waitingKey = waitingIds.join(',');
  useEffect(() => {
    if (!authed) return;
    const fresh = known.current ? waitingIds.filter((id) => !known.current!.has(id)) : [];
    known.current = new Set([...(known.current ?? []), ...waitingIds]);
    if (fresh.length && alerts) {
      chime();
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(tx.adminTitle, { body: tx.adminNewReceipts(waitingIds.length), tag: 'futbolchi-receipt' });
        } catch {
          /* some mobile browsers only allow notifications from a service worker */
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, waitingKey]);
  useEffect(() => {
    const base = document.title;
    if (waitingIds.length) document.title = `(${waitingIds.length}) ${tx.adminTitle} · ${tx.appName}`;
    return () => {
      document.title = base;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingIds.length]);

  const toggleAlerts = () => {
    const next = !alerts;
    setAlerts(next);
    try {
      localStorage.setItem(ALERTS_KEY, next ? '1' : '0');
    } catch {
      /* private mode: the choice lasts for this visit */
    }
    if (next && 'Notification' in window && Notification.permission === 'default') void Notification.requestPermission();
    if (next) chime();
  };

  // Escape closes the receipt preview.
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setZoom(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

  // Receipts waiting for review show their image right away.
  useEffect(() => {
    if (!authed) return;
    for (const p of payments) {
      if (isWaiting(p) && !proofs[p.paymentId]) {
        void admin
          .proofUrl(p.paymentId)
          .then((url) => setProofs((prev) => ({ ...prev, [p.paymentId]: url })))
          .catch(() => null);
      }
    }
  }, [authed, payments, proofs, admin]);

  const logout = () => {
    clearAdminToken();
    setAuthed(false);
    setToken('');
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

  const decide = (p: AdminPayment, decision: 'approve' | 'reject', note?: string) =>
    guard(async () => {
      setBusy(p.paymentId);
      try {
        await admin.decide(p.paymentId, decision, note?.trim() || undefined);
        setRejecting(null);
        setReason('');
        await loadPayments();
      } finally {
        setBusy(null);
      }
    });

  const showProof = (p: AdminPayment) =>
    guard(async () => {
      const url = proofs[p.paymentId] ?? (await admin.proofUrl(p.paymentId));
      setProofs((prev) => ({ ...prev, [p.paymentId]: url }));
      setZoom(url);
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

  // Load matches the first time the highlights tab opens.
  useEffect(() => {
    if (authed && tab === 'highlights' && matches === null) void loadMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, tab]);

  if (!authed) {
    return (
      <div className="screen narrow admin login">
        <a className="link" href="#/">{tx.adminBackToGame}</a>
        <h1>{tx.adminTitle}</h1>
        {checking ? (
          <p className="muted">{tx.loading}</p>
        ) : (
          <>
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                void login();
              }}
            >
              <input type="password" placeholder={tx.adminToken} value={token} autoComplete="off" autoFocus onChange={(e) => setToken(e.target.value)} />
              <button className="primary" type="submit" disabled={!token}>{tx.adminLogin}</button>
            </form>
            <p className="muted small">{tx.adminRememberHint}</p>
            {msg && <p className="error">{msg}</p>}
          </>
        )}
      </div>
    );
  }

  const waiting = payments.filter(isWaiting);
  const paid = payments.filter((p) => p.status === 'paid');
  const revenue = paid.reduce((sum, p) => sum + p.amountMinor, 0);
  const shown = filter === 'waiting' ? waiting : payments;

  return (
    <div className="screen panel admin">
      <header className="panel-head admin-head">
        <div className="admin-top">
          <h1>{tx.adminTitle}</h1>
          <div className="row">
            <a className="button" href="#/">{tx.adminBackToGame}</a>
            <button onClick={logout}>{tx.adminLogout}</button>
          </div>
        </div>
        <div className="admin-stats">
          <div><span>{tx.adminStatPlayers}</span><strong>{players ?? '—'}</strong></div>
          <div className={waiting.length ? 'hot' : ''}><span>{tx.adminStatWaiting}</span><strong>{waiting.length}</strong></div>
          <div><span>{tx.adminStatPaid}</span><strong>{paid.length}</strong></div>
          <div><span>{tx.adminStatRevenue}</span><strong>{formatMoney(revenue)}</strong></div>
        </div>
        <nav className="admin-tabs" role="tablist">
          {(['payments', 'free', 'highlights'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {tx.adminTabs[t]}
              {t === 'payments' && waiting.length > 0 && <span className="count">{waiting.length}</span>}
            </button>
          ))}
        </nav>
        {msg && <p className="muted small">{msg}</p>}
      </header>

      <div className="panel-body">
        {tab === 'payments' && (
          <section>
            <div className="card-head">
              <div className="row">
                {(['waiting', 'all'] as const).map((f) => (
                  <button key={f} className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
                    {tx.adminFilter[f]}
                  </button>
                ))}
              </div>
              <div className="row">
                <button className={`alert-toggle ${alerts ? 'on' : ''}`} aria-pressed={alerts} onClick={toggleAlerts}>
                  {alerts ? tx.adminAlertsOn : tx.adminAlertsOff}
                </button>
                <button onClick={() => guard(loadPayments)}>{tx.adminRefresh}</button>
              </div>
            </div>
            {shown.length === 0 && <p className="muted">{filter === 'waiting' ? tx.adminNothingWaiting : tx.adminPaymentsEmpty}</p>}
            <ul className="pay-list">
              {shown.map((p) => {
                const w = isWaiting(p);
                const thumb = proofs[p.paymentId];
                return (
                  <li key={p.paymentId} className={w ? 'waiting' : ''}>
                    {p.proof && (
                      <button className="proof-thumb" onClick={() => showProof(p)} title={tx.adminShowProof}>
                        {thumb ? <img src={thumb} alt="" /> : <span>{tx.adminShowProof}</span>}
                      </button>
                    )}
                    <div className="pay-info">
                      <div className="pay-row">
                        <strong>{p.userName ?? '—'}</strong>
                        <span className={`badge ${w ? 'waiting' : p.status}`}>{w ? tx.adminWaiting : tx.adminStatus[p.status]}</span>
                      </div>
                      <div className="muted small">
                        {formatMoney(p.amountMinor)} · {tx.adminProvider[p.provider] ?? p.provider} ·{' '}
                        {new Date(p.proof?.uploadedAt ?? p.createdAt).toLocaleString(tx.dateLocale)}
                      </div>
                      {!p.proof && p.provider === 'manual' && p.status === 'pending' && <div className="muted small">{tx.adminNoProof}</div>}
                      {p.status === 'pending' && p.provider === 'manual' && p.proof && (
                        rejecting === p.paymentId ? (
                          <form
                            className="row reject-form"
                            onSubmit={(e) => {
                              e.preventDefault();
                              void decide(p, 'reject', reason);
                            }}
                          >
                            <input value={reason} maxLength={200} autoFocus placeholder={tx.adminRejectPrompt} onChange={(e) => setReason(e.target.value)} />
                            <button type="submit" className="danger" disabled={busy === p.paymentId}>{tx.adminReject}</button>
                            <button type="button" onClick={() => setRejecting(null)}>{tx.adminCancel}</button>
                          </form>
                        ) : (
                          <div className="row">
                            <button className="primary" disabled={busy === p.paymentId} onClick={() => decide(p, 'approve')}>✓ {tx.adminApprove}</button>
                            <button
                              onClick={() => {
                                setRejecting(p.paymentId);
                                setReason('');
                              }}
                            >
                              ✕ {tx.adminReject}
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {tab === 'free' && (
          <section className="admin-free">
            <h2>{tx.adminFreeTitle}</h2>
            <p>{tx.adminFreeText}</p>
            <ul className="admin-tips">
              {tx.adminWaysIn.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {granted ? (
              <>
                <p className="success">{tx.adminFreeDone}</p>
                <a className="button primary" href="#/">{tx.adminBackToGame}</a>
              </>
            ) : (
              <button className="primary big" onClick={grant}>{tx.adminFreeButton}</button>
            )}
          </section>
        )}

        {tab === 'highlights' && (
          <section>
            <div className="card-head">
              <h2>{tx.adminMatches}</h2>
              <button onClick={loadMatches}>{tx.adminRefresh}</button>
            </div>
            {matches && matches.length === 0 && <p className="muted">{tx.adminNoMatches}</p>}
            <div className="hl-grid">
              {matches && matches.length > 0 && (
                <ul className="admin-list">
                  {matches.map((m) => (
                    <li key={`${m.userId}/${m.matchId}`}>
                      <button className={selected?.matchId === m.matchId && selected.userId === m.userId ? 'on' : ''} onClick={() => open(m)}>
                        {tx.adminMatchRow(m.week, m.home, m.away, m.score[0], m.score[1])}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {selected && (
                <div>
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
                  <div className="hl-save"><button className="primary" onClick={saveHighlights}>{tx.adminSave}</button></div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {zoom && (
        <div className="modal" role="dialog" aria-modal="true" onClick={() => setZoom(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <img className="proof-big" src={zoom} alt="" />
            <button onClick={() => setZoom(null)}>{tx.close}</button>
          </div>
        </div>
      )}
    </div>
  );
}
