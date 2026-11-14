/**
 * The account level in the top bar (⭐ level + XP bar). Tapping it opens the
 * missions sheet: the three active missions with their progress.
 */
import { useEffect, useState } from 'react';
import { missionProgress, normalizeAccount, xpToNext, type Account } from '@futbolchi/engine';
import { progressTexts } from '../i18n/progress';

export function AccountBadge({ account }: { account: Account | undefined }) {
  const [open, setOpen] = useState(false);
  const t = progressTexts();
  const acc = normalizeAccount(account);
  const need = xpToNext(acc.level);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button type="button" className="account-badge" title={t.accountTitle} aria-label={`${t.accountTitle}: ${t.level(acc.level)}`} onClick={() => setOpen(true)}>
        <span className="lvl-chip">⭐ {acc.level}</span>
        <span className="xp-bar small">
          <i style={{ width: `${(acc.xp / need) * 100}%` }} />
        </span>
      </button>
      {open && (
        <div className="modal" role="dialog" aria-modal="true" aria-label={t.accountTitle} onClick={() => setOpen(false)}>
          <div className="modal-box account-sheet" onClick={(e) => e.stopPropagation()}>
            <h2>
              ⭐ {t.accountTitle}: {acc.level}
            </h2>
            <div className="growth-xp">
              <span className="lvl-chip">⭐ {acc.level}</span>
              <span className="xp-bar">
                <i style={{ width: `${(acc.xp / need) * 100}%` }} />
              </span>
              <b>{t.xpOf(acc.xp, need)}</b>
            </div>
            <p className="muted small">{t.accountText}</p>
            <h3>🎯 {t.missionsTitle}</h3>
            <ul className="mission-list">
              {acc.missions.map((m) => {
                const p = missionProgress(acc, m);
                return (
                  <li key={m.index}>
                    <div className="mission-top">
                      <span>{t.missionNames[p.def.kind](p.def.target)}</span>
                      <b>{t.missionReward(p.def.xp)}</b>
                    </div>
                    <span className="xp-bar mission">
                      <i style={{ width: `${(p.value / p.def.target) * 100}%` }} />
                    </span>
                    <small className="muted">
                      {p.value} / {p.def.target}
                    </small>
                  </li>
                );
              })}
            </ul>
            <p className="muted small">{t.totals(acc.missionsDone, acc.totalXp)}</p>
            <button type="button" className="big" onClick={() => setOpen(false)}>
              {t.close}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
