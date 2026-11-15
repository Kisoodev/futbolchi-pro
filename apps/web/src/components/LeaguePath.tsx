/**
 * Where the player stands on the road Akademiya → 2-liga → 1-liga, and what
 * the goal of this stage is (win the league to go up).
 */
import { constants as C, tierName, type Tier } from '@futbolchi/engine';
import { lang } from '../i18n';
import { progressTexts } from '../i18n/progress';

export function LeaguePath({ tier }: { tier: Tier }) {
  const t = progressTexts();
  // bottom first: Akademiya, 2-liga, 1-liga
  const road = [...C.TIERS].reverse();
  const stage = road.indexOf(tier);
  return (
    <div className="league-path" aria-label={t.stage(stage + 1, road.length)}>
      <ol>
        {road.map((x, i) => (
          <li key={x} className={i < stage ? 'done' : i === stage ? 'now' : ''}>
            {i < stage ? '✓ ' : ''}
            {tierName(x, lang)}
          </li>
        ))}
      </ol>
      <p>
        <b>{t.stage(stage + 1, road.length)}</b> · {tier === C.TOP_TIER ? t.goalTop : t.goalUp(tierName(tier, lang), tierName((tier - 1) as Tier, lang))}
      </p>
    </div>
  );
}
