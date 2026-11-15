/**
 * Plays whole academy seasons with a sensible player (picks the training that
 * fits their position, rests when tired) and reports who wins the league,
 * where Etiqod finishes, and how the persona and Odil grow.
 *   npx tsx packages/engine/scripts/season-sim.ts [seasons=60] [position=W]
 */
import {
  constants as C,
  currentSeason,
  dayOf,
  ETIQOD,
  getTrainingOption,
  newGame,
  personaLevel,
  playMatchDay,
  PROGRESSION_CONFIG,
  sortTable,
  squadAvg,
  trainDay,
  trainingOffer,
  type GameState,
  type Position,
} from '../src';

const N = Number(process.argv[2] ?? 60);
const position = (process.argv[3] ?? 'W') as Position;
/** smart = trains what fits the position; lazy = always rests when offered. */
const policy = process.argv[4] ?? 'smart';
const W = PROGRESSION_CONFIG.WEIGHTS[position];

function pick(s: GameState) {
  const offer = trainingOffer(s);
  if (policy === 'lazy' && offer.includes('rest')) return 'rest';
  if (s.persona.fatigue >= 60 && offer.includes('rest')) return 'rest';
  const score = (id: string) => getTrainingOption(id).focus.reduce((t, k) => t + W[k], 0);
  return offer.slice().sort((a, b) => score(b) - score(a))[0];
}

const champions: Record<string, number> = {};
const etiqodPos: number[] = [];
let ovrStart = 0, ovrEnd = 0, teamStart = 0, teamEnd = 0, beatOdil = 0, odilEnd = 0;
const passWeeks: number[] = [];
for (let seed = 1; seed <= N; seed++) {
  let s = newGame({ seed, persona: { id: 'me', name: 'Aziz', position, bonus: {} } });
  ovrStart += personaLevel(s.persona);
  teamStart += squadAvg(s.clubs[ETIQOD].squad);
  let passed = 0;
  while (s.phase === 'training') {
    if (dayOf(s) === 'training') s = trainDay(s, pick(s)).state;
    const wk = currentSeason(s).week;
    s = playMatchDay(s).state;
    const o = s.clubs[ETIQOD].squad.find((p) => p.characterKey === 'odil');
    if (!passed && o && personaLevel(s.persona) > o.ovr) passed = wk;
  }
  if (passed) passWeeks.push(passed);
  const season = currentSeason(s);
  const table = sortTable(season.table, s.clubs);
  champions[s.clubs[table[0].clubId].name] = (champions[s.clubs[table[0].clubId].name] ?? 0) + 1;
  etiqodPos.push(table.findIndex((r) => r.clubId === ETIQOD) + 1);
  const lvl = personaLevel(s.persona);
  ovrEnd += lvl;
  const odil = s.clubs[ETIQOD]?.squad.find((p) => p.characterKey === 'odil') ?? Object.values(s.clubs).flatMap((c) => c.squad).find((p) => p.characterKey === 'odil');
  if (odil && lvl > odil.ovr) beatOdil++;
  teamEnd += squadAvg(s.clubs[ETIQOD].squad);
  odilEnd += odil?.ovr ?? 0;
}
const dist = Array.from({ length: 16 }, (_, i) => etiqodPos.filter((p) => p === i + 1).length);
console.log(`seasons ${N}, persona ${position}`);
console.log('champions', Object.entries(champions).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${((v / N) * 100).toFixed(0)}%`).join(', '));
console.log('Etiqod finish 1..16', dist.join(' '), `| avg ${(etiqodPos.reduce((a, b) => a + b, 0) / N).toFixed(1)}`);
console.log(`persona OVR ${(ovrStart / N).toFixed(1)} → ${(ovrEnd / N).toFixed(1)} | Odil → ${(odilEnd / N).toFixed(1)} | ahead of Odil at season end ${((beatOdil / N) * 100).toFixed(0)}% (passed him at week ~${passWeeks.length ? (passWeeks.reduce((a, b) => a + b, 0) / passWeeks.length).toFixed(0) : '-'}) | Etiqod squad avg ${(teamStart / N).toFixed(1)} → ${(teamEnd / N).toFixed(1)}`);
void C;
