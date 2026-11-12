/**
 * Balance report: simulates many careers with a naive "random offered option"
 * policy and prints aggregate numbers. Run: npx tsx packages/engine/scripts/balance-report.ts [careers] [seasons]
 */
import {
  createRng, currentSeason, newGame, personaOvr, playWeek, seasonFacts, startNextSeason, trainingOffer,
  POSITIONS, type GameState,
} from '../src';

const CAREERS = Number(process.argv[2] ?? 200);
const SEASONS = Number(process.argv[3] ?? 6);

for (const position of POSITIONS) {
  const perSeason = Array.from({ length: SEASONS }, () => ({ apps: 0, goals: 0, rating: 0, rated: 0, ovr: 0, tier: 0, promo: 0, releg: 0, offers: 0 }));
  let goalsTotal = 0, matchesTotal = 0;
  for (let c = 0; c < CAREERS; c++) {
    const rng = createRng(c * 7919);
    let s: GameState = newGame({ seed: c + 1000, persona: { id: 'p', name: 'Test', position, bonus: {} } });
    for (let i = 0; i < SEASONS; i++) {
      while (s.phase === 'training') s = playWeek(s, rng.pick(trainingOffer(s))).state;
      const season = currentSeason(s);
      const f = seasonFacts(s, season.id);
      const row = perSeason[i];
      row.apps += f.apps; row.goals += f.goals; row.ovr += personaOvr(s.persona); row.tier += season.tier;
      if (f.avgRating !== null) { row.rating += f.avgRating; row.rated++; }
      if (season.outcome === 'promoted') row.promo++;
      if (season.outcome === 'relegated') row.releg++;
      if (s.transferOffers.length) row.offers++;
      for (const id of season.matchIds) { const m = s.matches[id]; goalsTotal += m.score[0] + m.score[1]; matchesTotal++; }
      s = startNextSeason(s, s.transferOffers[0]?.clubId ?? null);
    }
  }
  console.log(`\n== ${position} (${CAREERS} careers) — avg goals/match in persona games: ${(goalsTotal / matchesTotal).toFixed(2)}`);
  console.log('season | tier | OVR  | apps | goals | avgRating | promoted | relegated | offers');
  perSeason.forEach((r, i) => console.log(
    `${String(i + 1).padStart(6)} | ${(r.tier / CAREERS).toFixed(2)} | ${(r.ovr / CAREERS).toFixed(1)} | ${(r.apps / CAREERS).toFixed(1).padStart(4)} | ${(r.goals / CAREERS).toFixed(1).padStart(5)} | ${(r.rating / Math.max(1, r.rated)).toFixed(2).padStart(9)} | ${(100 * r.promo / CAREERS).toFixed(0).padStart(7)}% | ${(100 * r.releg / CAREERS).toFixed(0).padStart(8)}% | ${(100 * r.offers / CAREERS).toFixed(0).padStart(5)}%`));
}
