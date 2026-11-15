import * as C from './constants';
import { addFatigue } from './persona';
import { createRng } from './rng';
import type { Persona } from './types';

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

export interface TrainingSessionsResult {
  persona: Persona;
  /** Extra injury risk carried into the match (the riskiest session). */
  injuryRiskBonus: number;
}

/**
 * A training day: fatigue and the injury risk carried into the match. The
 * attribute growth is added by the caller from the day's XP (trainDay).
 */
export function applyTrainingDay(persona: Persona, optionId: string): TrainingSessionsResult {
  const opt = getTrainingOption(optionId);
  return { persona: addFatigue(persona, opt.fatigue), injuryRiskBonus: opt.injuryRisk };
}

/** End-of-week recovery: fatigue drops and injuries heal. */
export function weeklyRecovery(p: Persona): Persona {
  return {
    ...addFatigue(p, -C.FATIGUE_WEEKLY_RECOVERY),
    injuryWeeksLeft: Math.max(0, p.injuryWeeksLeft - 1),
  };
}
