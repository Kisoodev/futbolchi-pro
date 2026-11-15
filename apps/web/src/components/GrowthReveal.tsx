/**
 * The "you got better" moment after a training day or a match. Each attribute
 * that grew shows its bar filling and "54 → 55"; the overall rating card ticks
 * up; milestones (60, 65 … 100) get a banner with a share button; then the
 * account ⭐ bar and finished missions.
 */
import { useEffect, useMemo, useState } from 'react';
import { missionAt, normalizeAccount, xpToNext, type Account, type AccountReward, type Stats, type StatKey } from '@futbolchi/engine';
import { tx } from '../i18n';
import { progressTexts } from '../i18n/progress';
import { RatingCard } from './RatingCard';

export interface GrowthData {
  kind: 'training' | 'match';
  name: string;
  before: Stats;
  after: Stats;
  levelBefore: number;
  levelAfter: number;
  milestones: number[];
  /** Match rating (match only). */
  rating?: number | null;
  reward: AccountReward;
  account: Account | undefined;
  benched?: boolean;
  rested?: boolean;
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
  const t = progressTexts();
  const u = ease(useProgress(1000, delay));
  const now = from + (to - from) * u;
  const a = Math.floor(from);
  const b = Math.floor(to);
  return (
    <li className="grow-row" style={{ animationDelay: `${delay}ms` }}>
      <span className="grow-name">{tx.stats[k]}</span>
      <span className="grow-bar" aria-hidden>
        <i className="grow-old" style={{ width: `${from}%` }} />
        <i className="grow-new" style={{ left: `${from}%`, width: `${now - from}%` }} />
      </span>
      <b className="grow-val">{b > a && u >= 1 ? <>{a} → <em>{b}</em></> : Math.floor(now)}</b>
      <span className="grow-note">{b > a ? (u >= 1 ? t.pointUp(b - a) : '') : t.almost}</span>
    </li>
  );
}

export function GrowthReveal({ data, onClose }: { data: GrowthData; onClose: () => void }) {
  const t = progressTexts();
  const rows = useMemo(
    () =>
      (Object.keys(data.after) as StatKey[])
        .map((k) => ({ k, from: data.before[k], to: data.after[k] }))
        .filter((r) => r.to - r.from > 0.005)
        .sort((x, y) => y.to - y.from - (x.to - x.from)),
    [data],
  );
  const statsDone = 300 + rows.length * 200 + 1000;
  const ovrU = useProgress(1, statsDone);
  const accU = ease(useProgress(800, statsDone + 300));
  const acc = normalizeAccount(data.account);
  const leveled = data.reward.levelAfter > data.reward.levelBefore;
  const need = xpToNext(acc.level);
  const accStart = leveled ? 0 : Math.max(0, acc.xp - data.reward.xp);
  const accNow = accStart + (acc.xp - accStart) * accU;
  const ratingUp = data.levelAfter > data.levelBefore;
  const milestone = data.milestones[data.milestones.length - 1];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => (e.key === 'Enter' || e.key === 'Escape') && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const share = async () => {
    const text = t.milestoneShare(data.name, milestone);
    try {
      if (navigator.share) await navigator.share({ text, url: location.origin });
      else await navigator.clipboard?.writeText(`${text} ${location.origin}`);
    } catch {
      /* the player closed the share sheet */
    }
  };

  return (
    <div className="modal growth-modal" role="dialog" aria-modal="true" aria-label={data.kind === 'training' ? t.trainingDone : t.matchGrowth}>
      <div className="modal-box growth-box">
        <h2>{data.kind === 'training' ? `💪 ${t.trainingDone}` : `⚽ ${t.matchGrowth}`}</h2>

        <div className="growth-ovr">
          <RatingCard level={ovrU >= 1 ? data.levelAfter : data.levelBefore} size="md" />
          <div>
            <span className="muted">{t.ovr}</span>
            <b className={ratingUp && ovrU >= 1 ? 'ovr-line up' : 'ovr-line'}>
              {ratingUp && ovrU >= 1 ? t.ratingUp(data.levelAfter) : t.ratingSame}
            </b>
            {data.kind === 'match' && typeof data.rating === 'number' && <small className="muted">{t.matchXpLine(data.rating.toFixed(1))}</small>}
          </div>
        </div>

        {rows.length ? (
          <>
            <ul className="grow-list">
              {rows.map((r, i) => (
                <StatRow key={r.k} k={r.k} from={r.from} to={r.to} delay={300 + i * 200} />
              ))}
            </ul>
            <p className="muted small grow-hint">{t.growHint}</p>
          </>
        ) : (
          <p className="muted">{data.rested ? t.restGrowth : data.benched ? t.benched : t.noGrowth}</p>
        )}

        {ovrU >= 1 && milestone !== undefined && (
          <div className="milestone">
            <b>{t.milestone(milestone)}</b>
            <button type="button" onClick={() => void share()}>
              {t.share}
            </button>
          </div>
        )}

        <div className="growth-xp" style={{ opacity: accU > 0 ? 1 : 0.4 }}>
          <span className="lvl-chip">⭐ {acc.level}</span>
          <span className="xp-bar">
            <i style={{ width: `${(accNow / need) * 100}%` }} />
          </span>
          <b>{t.xpGained(data.reward.xp)}</b>
        </div>

        {accU >= 1 && data.reward.missionsDone.length > 0 && (
          <ul className="growth-missions">
            {data.reward.missionsDone.map((m) => (
              <li key={m.index}>
                ✅ <span>{t.missionNames[missionAt(m.index).kind](m.target)}</span> <b>{t.missionReward(m.xp)}</b>
              </li>
            ))}
          </ul>
        )}
        {accU >= 1 && leveled && <div className="level-up">🎉 {t.levelUp(data.reward.levelAfter)}</div>}

        <button type="button" className="primary big" onClick={onClose}>
          {data.kind === 'training' ? t.toMatchDay : t.continue}
        </button>
      </div>
    </div>
  );
}
