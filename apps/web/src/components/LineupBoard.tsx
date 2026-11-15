/**
 * The team sheet before a match (docs/CHARACTERS.md, feature 4): the XI on a
 * pitch in the 4-3-3, the player's own name in gold, the rival (Odil) and the
 * friend (Abu) marked, and the bench below.
 */
import { useEffect } from 'react';
import type { MatchLineup, SlotId } from '@futbolchi/engine';
import { progressTexts } from '../i18n/progress';

/** Where each slot sits on a portrait pitch (own goal at the bottom), in %. */
const SPOT: Record<SlotId, [number, number]> = {
  GK: [50, 90],
  LB: [14, 70],
  LCB: [37, 75],
  RCB: [63, 75],
  RB: [86, 70],
  CDM: [50, 58],
  CM: [30, 45],
  CAM: [70, 42],
  LW: [16, 22],
  ST: [50, 15],
  RW: [84, 22],
};

const mark = (key?: string) => (key === 'odil' ? 'rival' : key === 'abu' ? 'friend' : key === 'sardor' ? 'captain' : '');

export function LineupBoard({ lineup, onClose }: { lineup: MatchLineup; onClose: () => void }) {
  const t = progressTexts();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal lineup-modal" role="dialog" aria-modal="true" aria-label={t.lineupTitle} onClick={onClose}>
      <div className="modal-box lineup-box" onClick={(e) => e.stopPropagation()}>
        <h2>📋 {t.lineupTitle}</h2>
        <div className="lineup-pitch">
          {lineup.starters.map((p) => {
            const [x, y] = SPOT[p.slot ?? 'CM'];
            const m = mark(p.characterKey);
            return (
              <span key={p.id} className={`lineup-chip ${p.persona ? 'me' : ''} ${m}`} style={{ left: `${x}%`, top: `${y}%` }}>
                <b>{p.persona ? `⭐ ${p.name}` : p.name}</b>
                <small>
                  {p.slot} · {p.ovr}
                </small>
              </span>
            );
          })}
        </div>
        <p className="lineup-legend">
          <span className="me">⭐ {t.lineupYou}</span> <span className="rival">{t.lineupRival}</span> <span className="friend">{t.lineupFriend}</span>
        </p>
        <h3>{t.lineupBench}</h3>
        <ul className="lineup-bench">
          {lineup.bench.map((p) => (
            <li key={p.id} className={mark(p.characterKey)}>
              {p.name} <small>{p.position} · {p.ovr}</small>
            </li>
          ))}
        </ul>
        <button type="button" className="primary big" onClick={onClose}>
          {t.close}
        </button>
      </div>
    </div>
  );
}
