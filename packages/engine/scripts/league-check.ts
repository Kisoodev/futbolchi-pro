// Prints each academy club's target OVR and the average its generated squad really has.
import { ACADEMY_CLUBS, generateWorld, squadAvg } from '../src';

for (const seed of [1, 7, 42]) {
  const w = generateWorld(seed);
  console.log(ACADEMY_CLUBS.map((p) => `${p.key}:${p.ovr}→${squadAvg(w[p.key].squad).toFixed(1)}`).join(' '));
}
