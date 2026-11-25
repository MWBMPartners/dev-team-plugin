// @ts-check
// File:    engine/lib/review.mjs
// Purpose: Builds the written brief for a reviewer (the "review contract"): what to check, against which locked plan
//          and rules, with which specialists, and whether to attack the work adversarially. The reviewer is given no
//          view of the builder's reasoning, only this contract and the files.
import { chooseReviewer } from './independence.mjs';

const SPECIALISTS = [
  ['SECURITY_REVIEW', 'security'], ['DATABASE_REVIEW', 'database'], ['API_COMPATIBILITY_REVIEW', 'api-compatibility'],
  ['CONCURRENCY_REVIEW', 'concurrency'], ['ACCESSIBILITY_REVIEW', 'accessibility'], ['ARCHITECTURE_REVIEW', 'architecture'],
];

/** Specialist reviews: from the task types (and flagged components) of the work. HIGH and CRITICAL risk also add an adversarial pass. */
export function specialistsFor(taskTypes, risk = 'NORMAL', components = []) {
  const out = new Set();
  for (const [t, s] of SPECIALISTS) if (taskTypes.includes(t)) out.add(s);
  for (const c of components) { if (/auth|payment|billing|crypto|secret/i.test(c)) out.add('security'); if (/migration|schema|sql/i.test(c)) out.add('database'); }
  return { specialists: [...out].sort(), adversarial: ['HIGH', 'CRITICAL'].includes(String(risk).toUpperCase()) };
}

/**
 * @param {{jobId: string, phase: string, planId?: string, planHash?: string, risk?: string, files: string[], invariants?: string[], taskTypes?: string[], components?: string[], builtBy: {provider: string, model: string}, models: any[], exhausted?: string[], askFirst?: string[], approved?: string[]}} i
 */
export function planReview(i) {
  const risk = String(i.risk ?? 'NORMAL').toUpperCase();
  if (!Array.isArray(i.files) || i.files.length === 0 || i.files.some((f) => typeof f !== 'string')) throw new RangeError('files must be a non-empty list of paths');
  if (!Array.isArray(i.models)) throw new RangeError('models must be a list');
  const route = chooseReviewer({ builtBy: i.builtBy, risk, models: i.models, exhausted: i.exhausted, askFirst: i.askFirst, approved: i.approved });
  const sp = specialistsFor(i.taskTypes ?? [], risk, i.components ?? []);
  return {
    contract: {
      jobId: i.jobId, phase: i.phase, planId: i.planId ?? null, planHash: i.planHash ?? null, risk, files: i.files, invariants: i.invariants ?? [],
      instructions: ['Re-prove every claim with fresh evidence.', 'Cite the plan version you checked against.', 'Check each listed invariant explicitly.', ...(sp.adversarial ? ['Also attack the work: look for what breaks under hostile or unusual input.'] : [])],
      specialists: sp.specialists, adversarial: sp.adversarial, freshContext: true,
    },
    reviewer: route,
  };
}
