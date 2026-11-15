/**
 * Calibration of the match engine (docs/MATCH_ENGINE.md §9).
 *   npx tsx packages/engine/scripts/calibrate.ts            → prints the table
 *   npx tsx packages/engine/scripts/calibrate.ts --write    → also writes docs/MATCH_ENGINE_CALIBRATION.md
 */
import { writeFileSync } from 'node:fs';
import { createRng } from '../src/rng';
import { runMatch, type TeamMatchStats } from '../src/sim/engine';
import { team } from './calibrate-team';


interface Agg {
  n: number;
  t: TeamMatchStats;
  goalsTotal: number;
  possStrong: number;
  strongGames: number;
  wins: number;
  draws: number;
  ms: number;
}

function run(label: string, n: number, pick: (i: number) => [number, number]): Agg {
  const t: TeamMatchStats = { goals: 0, shots: 0, onTarget: 0, passes: 0, passesDone: 0, dribbles: 0, dribblesWon: 0, corners: 0, fouls: 0, yellows: 0, reds: 0, tackles: 0, possession: 0, penalties: 0 };
  const agg: Agg = { n, t, goalsTotal: 0, possStrong: 0, strongGames: 0, wins: 0, draws: 0, ms: 0 };
  for (let i = 0; i < n; i++) {
    const [a, b] = pick(i);
    // the stronger team plays at home half of the time
    const homeStrong = i % 2 === 0;
    const [h, w] = homeStrong ? [a, b] : [b, a];
    const t0 = performance.now();
    const r = runMatch({ matchId: `${label}${i}`, seed: 1000 + i, lineups: { home: team('h', h, i * 7 + 1), away: team('a', w, i * 7 + 2) } });
    agg.ms += performance.now() - t0;
    for (const side of ['home', 'away'] as const) for (const k of Object.keys(t) as (keyof TeamMatchStats)[]) t[k] += r.stats[side][k];
    agg.goalsTotal += r.score[0] + r.score[1];
    if (a - b >= 3) {
      agg.strongGames++;
      const strong = homeStrong ? 'home' : 'away';
      const ps = r.stats[strong].possession / (r.stats.home.possession + r.stats.away.possession);
      agg.possStrong += ps;
      const [sg, wg] = homeStrong ? r.score : [r.score[1], r.score[0]];
      if (sg > wg) agg.wins++;
      else if (sg === wg) agg.draws++;
    } else if (r.score[0] === r.score[1]) agg.draws++;
  }
  return agg;
}

const per = (a: Agg, k: keyof TeamMatchStats) => a.t[k] / (a.n * 2);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const fmt = (x: number) => x.toFixed(2);

const N = Number(process.argv.find((x) => x.startsWith('--n='))?.slice(4) ?? 1000);
const academy = run('ac', N, (i) => {
  const r = createRng(9000 + i);
  return [Math.round(r.range(55, 62)), Math.round(r.range(55, 62))].sort((x, y) => y - x) as [number, number];
});
const first = run('fl', N, (i) => {
  const r = createRng(19000 + i);
  const a = r.range(65, 82);
  return [Math.round(a), Math.round(Math.min(82, Math.max(65, a + r.range(-8, 8))))].sort((x, y) => y - x) as [number, number];
});
const diff5 = run('d5', N, (i) => [62 + (i % 3), 57 + (i % 3)]);
const diff15 = run('d15', N, (i) => [70 + (i % 3), 55 + (i % 3)]);
const even = run('ev', N, () => [60, 60]);

type Row = [string, (a: Agg) => number, (x: number) => string, [number, number], [number, number]];
const rows: Row[] = [
  ['Goals (both teams)', (a) => a.goalsTotal / a.n, fmt, [2.6, 3.2], [2.4, 2.9]],
  ['Shots', (a) => per(a, 'shots'), fmt, [10, 14], [11, 15]],
  ['Shots on target', (a) => per(a, 'onTarget'), fmt, [3.5, 5], [4, 5.5]],
  ['Conversion', (a) => a.t.goals / a.t.shots, pct, [0.09, 0.13], [0.09, 0.12]],
  ['Pass accuracy', (a) => a.t.passesDone / a.t.passes, pct, [0.7, 0.78], [0.78, 0.86]],
  ['Dribble success', (a) => a.t.dribblesWon / a.t.dribbles, pct, [0.4, 0.5], [0.45, 0.55]],
  ['Corners', (a) => per(a, 'corners'), fmt, [4, 6], [4, 6]],
  ['Fouls', (a) => per(a, 'fouls'), fmt, [11, 15], [10, 13]],
  ['Yellow cards', (a) => per(a, 'yellows'), fmt, [1.5, 2.5], [1.5, 2.2]],
  ['Possession (stronger team, OVR gap ≥ 3)', (a) => (a.strongGames ? a.possStrong / a.strongGames : 0.5), pct, [0.52, 0.62], [0.52, 0.62]],
];
const ok = (x: number, [lo, hi]: [number, number]) => (x >= lo - 1e-9 && x <= hi + 1e-9 ? '✅' : '❌');
const lines: string[] = [];
lines.push('| Metric (per team, per match) | Academy (55–62) | Target | | First league (65–82) | Target | |');
lines.push('|---|---|---|---|---|---|---|');
for (const [name, f, show, ta, tf] of rows) {
  const va = f(academy);
  const vf = f(first);
  lines.push(`| ${name} | ${show(va)} | ${show(ta[0])}–${show(ta[1])} | ${ok(va, ta)} | ${show(vf)} | ${show(tf[0])}–${show(tf[1])} | ${ok(vf, tf)} |`);
}
const strength: string[] = [];
strength.push('| Match-up | Stronger wins | Target | | Draws | Target | |');
strength.push('|---|---|---|---|---|---|---|');
const sw = (a: Agg) => a.wins / a.strongGames;
const dr = (a: Agg) => a.draws / a.n;
strength.push(`| OVR difference 5 | ${pct(sw(diff5))} | 55%–60% | ${ok(sw(diff5), [0.55, 0.6])} | ${pct(dr(diff5))} | 22%–28% | ${ok(dr(diff5), [0.22, 0.28])} |`);
strength.push(`| OVR difference 15 | ${pct(sw(diff15))} | 80%–85% | ${ok(sw(diff15), [0.8, 0.85])} | ${pct(dr(diff15))} | | |`);
strength.push(`| Equal teams (60 v 60) | | | | ${pct(dr(even))} | 22%–28% | ${ok(dr(even), [0.22, 0.28])} |`);
const extra = `Average time per match: ${(academy.ms / academy.n).toFixed(2)} ms (target < 50 ms). Penalties per team per match: ${fmt(per(academy, 'penalties'))}. Red cards per team per match: ${fmt(per(academy, 'reds'))}. Tackles per team per match: ${fmt(per(academy, 'tackles'))}. Passes per team per match: ${fmt(per(academy, 'passes'))}.`;

const out = [lines.join('\n'), '', strength.join('\n'), '', extra].join('\n');
console.log(out);
if (process.argv.includes('--write')) {
  const doc = `# Match engine calibration\n\nGenerated by \`npx tsx packages/engine/scripts/calibrate.ts --write\` — ${N} simulated matches per row group (docs/MATCH_ENGINE.md §9). Teams are built per slot around the given average OVR (±3), with a 7-player bench; the stronger team plays at home in half of the matches.\n\n## Statistics\n\n${lines.join('\n')}\n\n## Strength check\n\n${strength.join('\n')}\n\n${extra}\n`;
  writeFileSync(new URL('../../../docs/MATCH_ENGINE_CALIBRATION.md', import.meta.url), doc);
  console.log('written docs/MATCH_ENGINE_CALIBRATION.md');
}
