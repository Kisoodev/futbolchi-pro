import * as C from './constants';
import { addFatigue, changeStat } from './persona';
import { createRng } from './rng';
import type { Persona, StatKey } from './types';

export type { TrainingId, TrainingOption } from './constants';

export function getTrainingOption(id: string): C.TrainingOption {
  const opt = C.TRAINING_OPTIONS.find((o) => o.id === id);
  if (!opt) throw new Error(`unknown training option: ${id}`);
  return opt;
}

/**
 * The options offered this week. Deterministic for a given seed.
 * Rest is always offered when the persona is tired or injured.
 */
export function offerTraining(persona: Persona, seed: number): C.TrainingId[] {
  const rng = createRng(seed);
  const mustRest = persona.fatigue >= C.FATIGUE_FORCE_REST_OFFER || persona.injuryWeeksLeft > 0;
  const pool = C.TRAINING_OPTIONS.map((o) => o.id).filter((id) => id !== 'rest');
  const picks = rng.shuffle(pool);
  if (mustRest) return ['rest', ...picks.slice(0, C.TRAINING_OFFER_SIZE - 1)];
  // Otherwise Rest competes with the rest of the pool.
  return rng.shuffle([...picks.slice(0, C.TRAINING_OFFER_SIZE), 'rest'] as C.TrainingId[]).slice(0, C.TRAINING_OFFER_SIZE);
}

export interface TrainingResult {
  persona: Persona;
  injuryRiskBonus: number;
  /** Actual stat deltas applied, for UI feedback. */
  deltas: Partial<Record<StatKey, number>>;
}

export function applyTraining(persona: Persona, optionId: string): TrainingResult {
  const opt = getTrainingOption(optionId);
  let p = persona;
  const deltas: Partial<Record<StatKey, number>> = {};
  // Injured players can only rest: a non-rest choice gives no gains.
  if (persona.injuryWeeksLeft === 0) {
    for (const [k, base] of Object.entries(opt.gains) as [StatKey, number][]) {
      const before = p.stats[k];
      p = changeStat(p, k, base > 0 ? base * C.TRAINING_GAIN_MULT : base);
      deltas[k] = p.stats[k] - before;
    }
  }
  p = addFatigue(p, opt.fatigue);
  return { persona: p, injuryRiskBonus: opt.injuryRisk, deltas };
}

/** End-of-week recovery: fatigue drops and injuries heal. */
export function weeklyRecovery(p: Persona): Persona {
  return {
    ...addFatigue(p, -C.FATIGUE_WEEKLY_RECOVERY),
    injuryWeeksLeft: Math.max(0, p.injuryWeeksLeft - 1),
  };
}
