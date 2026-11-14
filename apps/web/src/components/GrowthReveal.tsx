/**
 * The "you got better" moment after a training day or a match: every stat that
 * grew fills its bar and counts up, the overall rating ticks up, then the XP
 * bar fills, finished missions pop in, and a level-up banner if one happened.
 * Even a +0.3 change is shown, so progress always feels visible.
 */
import { useEffect, useMemo, useState } from 'react';
import { missionAt, normalizeAccount, xpToNext, type Account, type AccountReward, type Stats, type StatKey } from '@futbolchi/engine';
import { tx } from '../i18n';
import { progressTexts } from '../i18n/progress';

export interface GrowthData {
  kind: 'training' | 'match';
  before: Stats;
  after: Stats;
  ovrBefore: number;
  ovrAfter: number;
  reward: AccountReward;
  account: Account | undefined;
  rested?: boolean;
  /** The persona did not get on the pitch. */
  benched?: boolean;
}

const ease = (u: number) => 1 - Math.pow(1 - u, 3);

/** 0 → 1 over `ms`, starting after `delay`. */
function useProgress(ms: number, delay = 0): number {
  const [u, setU] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = () => {
      const v = Math.min(1, Math.max(0, (performance.now() - t0) / ms));
      setU(v);
      if (v < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ms, delay]);
  return u;
}

function StatRow({ k, from, to, delay }: { k: StatKey; from: number; to: number; delay: number }) {
  const u = ease(useProgress(1100, delay));
  const v = from + (to - from) * u;
  const d = to - from;
  return (
    <li className={d >= 0 ? 'grow-row up' : 'grow-row down'} style={{ animationDelay: `${delay}ms` }}>
      <span className="grow-name">{tx.stats[k]}</span>
      <span className="grow-bar">
        <i className="grow-old" style={{ width: `${Math.min(from, to)}%` }} />
        <i className="grow-new" style={{ left: `${Math.min(from, to)}%`, width: `${Math.abs(v - from)}%` }} />
      </span>
      <b className="grow-val">{v.toFixed(1)}</b>
      <em className="grow-delta" style={{ opacity: u }}>
        {d >= 0 ? '+' : '−'}
        {Math.abs(d).toFixed(1)}
      </em>
    </li>
  );
}

export function GrowthReveal({ data, onClose }: { data: GrowthData; onClose: () => void }) {
  const t = progressTexts();
  const rows = useMemo(
    () =>
      (Object.keys(data.after) as StatKey[])
        .map((k) => ({ k, from: data.before[k], to: data.after[k] }))
        .filter((r) => Math.abs(r.to - r.from) >= 0.05)
        .sort((a, b) => b.to - b.from - (a.to - a.from)),
    [data],
  );
  const statsTime = 300 + rows.length * 220 + 1100;
  const ovrU = ease(useProgress(1200, 300));
  const xpU = ease(useProgress(900, statsTime));
  const ovr = data.ovrBefore + (data.ovrAfter - data.ovrBefore) * ovrU;
  const acc = normalizeAccount(data.account);
  const leveled = data.reward.levelAfter > data.reward.levelBefore;
  const need = xpToNext(acc.level);
  // the XP bar fills to the new value (from empty on a level-up)
  const xpStart = leveled ? 0 : Math.max(0, acc.xp - data.reward.xp);
  const xpNow = xpStart + (acc.xp - xpStart) * xpU;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => (e.key === 'Enter' || e.key === 'Escape') && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal growth-modal" role="dialog" aria-modal="true" aria-label={data.kind === 'training' ? t.trainingDone : t.matchGrowth}>
      <div className="modal-box growth-box">
        <h2>{data.kind === 'training' ? `💪 ${t.trainingDone}` : `⚽ ${t.matchGrowth}`}</h2>

        <div className={data.ovrAfter > data.ovrBefore + 0.05 ? 'growth-ovr up' : 'growth-ovr'}>
          <span>{t.ovr}</span>
          <strong>{ovr.toFixed(1)}</strong>
          {data.ovrAfter - data.ovrBefore >= 0.05 && <em>+{(data.ovrAfter - data.ovrBefore).toFixed(1)}</em>}
        </div>

        {rows.length ? (
          <ul className="grow-list">
            {rows.map((r, i) => (
              <StatRow key={r.k} k={r.k} from={r.from} to={r.to} delay={300 + i * 220} />
            ))}
          </ul>
        ) : (
          <p className="muted">{data.rested ? t.restGrowth : data.benched ? t.benched : t.noGrowth}</p>
        )}

        <div className="growth-xp" style={{ opacity: xpU > 0 ? 1 : 0.4 }}>
          <span className="lvl-chip">⭐ {acc.level}</span>
          <span className="xp-bar">
            <i style={{ width: `${(xpNow / need) * 100}%` }} />
          </span>
          <b>{t.xpGained(data.reward.xp)}</b>
        </div>

        {xpU >= 1 && data.reward.missionsDone.length > 0 && (
          <ul className="growth-missions">
            {data.reward.missionsDone.map((m) => (
              <li key={m.index}>
                ✅ <span>{t.missionNames[missionAt(m.index).kind](m.target)}</span> <b>{t.missionReward(m.xp)}</b>
              </li>
            ))}
          </ul>
        )}
        {xpU >= 1 && leveled && <div className="level-up">🎉 {t.levelUp(data.reward.levelAfter)}</div>}

        <button type="button" className="primary big" onClick={onClose}>
          {data.kind === 'training' ? t.toMatchDay : t.continue}
        </button>
      </div>
    </div>
  );
}
