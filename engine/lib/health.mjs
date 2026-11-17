// @ts-check
// File:    engine/lib/health.mjs
// Purpose: A provider's recent health, from simple signals: how long it took, whether it errored, whether a session was
//          dropped. A phase that has already started stays with its agent whatever this says (phase stickiness); health only
//          informs the choice for the NEXT phase.
/** @param {{latencyMs?: number, error?: boolean, dropped?: boolean}[]} signals newest last @param {{baselineLatencyMs?: number}} [o] */
export function healthState(signals, { baselineLatencyMs = null } = {}) {
  if (baselineLatencyMs !== null && baselineLatencyMs !== undefined && (typeof baselineLatencyMs !== 'number' || !Number.isFinite(baselineLatencyMs) || baselineLatencyMs <= 0)) throw new RangeError('baselineLatencyMs must be a positive number');
  if (!Array.isArray(signals) || signals.some((s) => !s || typeof s !== 'object')) throw new RangeError('signals must be a list of objects');
  const w = signals.slice(-20);
  if (w.length < 5) return { state: 'UNKNOWN', reason: 'Too few recent signals to say.' };
  const rate = (k) => w.filter((s) => s[k] === true).length / w.length;
  const err = rate('error'), drop = rate('dropped');
  if (err >= 0.5) return { state: 'DOWN', reason: `${Math.round(err * 100)}% of recent calls failed.` };
  if (err >= 0.2 || drop >= 0.2) return { state: 'BROWNOUT', reason: `${Math.round(err * 100)}% errors and ${Math.round(drop * 100)}% dropped sessions recently.` };
  const lat = w.map((s) => s.latencyMs).filter((x) => Number.isFinite(x) && x >= 0).sort((a, b) => a - b);
  if (baselineLatencyMs && lat.length >= 5 && lat[Math.floor(lat.length / 2)] > 2 * baselineLatencyMs) return { state: 'DEGRADED', reason: 'Answers are taking more than twice as long as usual.' };
  return { state: 'HEALTHY', reason: 'No recent trouble.' };
}
