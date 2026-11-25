// @ts-check
// File:    engine/lib/tiers.mjs
// Purpose: How strong a model a job needs, from what kind of task it is and how risky. Tier 0 means no
//          AI model is needed (a script does it); tiers 1 to 4 are utility, engineer, architect, principal.
//          Several task types on one job take the larger value of each, so a mixed job is never under-served.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pluginRoot } from './paths.mjs';
import { RISKS, assertEnum } from './taxonomy.mjs';

const floors = () => JSON.parse(readFileSync(join(pluginRoot(), 'engine', 'data', 'floors.json'), 'utf8')).floors;

/**
 * @param {string[]} taskTypes @param {string} risk @param {{raise?: Record<string, number>}} [policy] policy may only RAISE a minimum
 * @returns {{preferredTier: number, minimumTier: number, reasons: string[]}}
 */
export function floorFor(taskTypes, risk = 'NORMAL', policy = {}) {
  assertEnum('risk', risk, RISKS);
  if (!Array.isArray(taskTypes) || taskTypes.length === 0) throw new RangeError('taskTypes must be a non-empty list');
  const table = floors();
  let preferredTier = 0, minimumTier = 0;
  const reasons = [];
  for (const t of taskTypes) {
    if (!Object.hasOwn(table, t)) throw new RangeError(`unknown task type "${String(t).slice(0, 40)}"`);
    const f = table[t][risk];
    preferredTier = Math.max(preferredTier, f.preferredTier); minimumTier = Math.max(minimumTier, f.minimumTier);
    reasons.push(`${t} at ${risk} risk: prefer tier ${f.preferredTier}, at least tier ${f.minimumTier}.`);
  }
  const raise = policy.raise ?? {};
  for (const t of taskTypes) {
    const r = raise[t];
    if (r !== undefined) {
      if (!Number.isInteger(r) || r < 0 || r > 4) throw new RangeError('a raised floor must be a whole number from 0 to 4');
      if (r > minimumTier) { minimumTier = r; reasons.push(`A policy raised the minimum for ${t} to tier ${r}.`); }
    }
  }
  preferredTier = Math.max(preferredTier, minimumTier);
  return { preferredTier, minimumTier, reasons };
}
