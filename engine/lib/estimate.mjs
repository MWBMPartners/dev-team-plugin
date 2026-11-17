// @ts-check
// File:    engine/lib/estimate.mjs
// Purpose: A rough forecast of how big a job is, as LOW, LIKELY and HIGH, in relative cost units (a job's size in work
//          units times the chosen model's price band). It is never a bill, and says so every time. Once local history has
//          at least 10 records for the same kind of task, the history replaces the built-in guess.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pluginRoot } from './paths.mjs';

const doc = () => JSON.parse(readFileSync(join(pluginRoot(), 'engine', 'data', 'cost-bands.json'), 'utf8'));

/** @param {{taskTypes: string[], costBand: number, history?: {taskType: string, units: number}[]}} i */
export function estimate(i) {
  const d = doc();
  if (!Array.isArray(i.taskTypes) || i.taskTypes.length === 0) throw new RangeError('taskTypes must be a non-empty list');
  if (typeof i.costBand !== 'number' || !Number.isFinite(i.costBand) || i.costBand < 0 || i.costBand > 100) throw new RangeError('costBand must be a number from 0 to 100');
  if (i.history !== undefined && (!Array.isArray(i.history) || i.history.some((r) => !r || typeof r !== 'object'))) throw new RangeError('history must be a list of {taskType, units} objects');
  let low = 0, likely = 0, high = 0; const sources = new Set();
  for (const t of i.taskTypes) {
    if (!Object.hasOwn(d.bands, t)) throw new RangeError(`unknown task type "${String(t).slice(0, 40)}"`);
    const h = (i.history ?? []).filter((r) => r.taskType === t && Number.isFinite(r.units) && r.units >= 0).map((r) => r.units).sort((a, b) => a - b);
    if (h.length >= 10) { sources.add('LOCAL_HISTORY'); low += h[Math.floor(h.length * 0.1)]; likely += h[Math.floor(h.length * 0.5)]; high += h[Math.min(h.length - 1, Math.floor(h.length * 0.9))]; }
    else { sources.add('BUILT_IN_BANDS'); low += d.bands[t].low; likely += d.bands[t].likely; high += d.bands[t].high; }
  }
  const f = Math.max(i.costBand, 0.1) ; // a free local model still takes time, so it is never shown as exactly zero
  return { unit: 'relative cost units', low: Math.round(low * f * 10) / 10, likely: Math.round(likely * f * 10) / 10, high: Math.round(high * f * 10) / 10, source: sources.size > 1 ? 'MIXED_HISTORY_AND_BANDS' : [...sources][0], caveat: d.caveat };
}

/** Warn when a job would use an unusually large share of an allowance that is KNOWN. Unknown allowance: no number, no warning. */
export function shareWarning(estimateHigh, knownCapacityUnits, thresholdShare = 0.25) {
  if (knownCapacityUnits === null || knownCapacityUnits === undefined) return { warn: false, state: 'UNKNOWN' };
  if (!Number.isFinite(knownCapacityUnits) || knownCapacityUnits <= 0) throw new RangeError('knownCapacityUnits must be a positive number or null');
  const share = estimateHigh / knownCapacityUnits;
  return { warn: share > thresholdShare, state: 'KNOWN', share: Math.round(share * 100) / 100 };
}
