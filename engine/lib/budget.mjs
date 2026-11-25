// @ts-check
// File:    engine/lib/budget.mjs
// Purpose: Keeps the strongest models for the work that needs them, and stops a phase that has spent its allowance.
//          Two ideas:
//          1. RESERVES. When a provider's remaining allowance is known and gets low, the strongest models are kept for
//             planning, security, hard debugging and the final audit, and routine work cannot take the last part.
//          2. PHASE BUDGETS. A phase may have a limit (tokens, credits or money); reaching it stops the phase.
//          An allowance that is not known is reported as UNKNOWN and never turned into a made-up percentage.

/** Work that may use the reserve: the kinds where a mistake spreads. */
export const RESERVE_USERS = new Set(['DEEP_ANALYSIS', 'ARCHITECTURE', 'DEEP_PLANNING', 'SECURITY_REVIEW', 'COMPLEX_DEBUGGING', 'ROOT_CAUSE_ANALYSIS', 'FINAL_AUDIT', 'ARCHITECTURE_REVIEW']);
export const DEFAULT_RESERVES = Object.freeze({ frontierReservePercent: 25, architectReservePercent: 15 });

const pct = (v, name) => { if (v === null || v === undefined) return null; if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100) throw new RangeError(`${name} must be a number from 0 to 100, or null when not known`); return v; };

/** How much pressure the remaining allowance puts on routing. */
export function pressure(remainingPercent) {
  const r = pct(remainingPercent, 'remainingPercent');
  if (r === null) return 'UNKNOWN';
  if (r > 50) return 'NORMAL'; if (r > 25) return 'ELEVATED'; if (r > 10) return 'HIGH'; return 'CRITICAL';
}

/**
 * May this job use a model of this tier, given what is left of the provider's allowance?
 * @param {{remainingPercent: number|null, tier: number, taskTypes: string[], reserves?: {frontierReservePercent?: number, architectReservePercent?: number}}} i
 */
export function reserveCheck(i) {
  const remaining = pct(i.remainingPercent, 'remainingPercent');
  if (i.reserves !== undefined && (i.reserves === null || typeof i.reserves !== 'object' || Array.isArray(i.reserves))) throw new RangeError('reserves must be an object');
  if (!Number.isInteger(i.tier) || i.tier < 0 || i.tier > 4) throw new RangeError('tier must be a whole number from 0 to 4');
  const res = { ...DEFAULT_RESERVES };
  for (const k of ['frontierReservePercent', 'architectReservePercent']) { const v = i.reserves?.[k]; if (v === undefined || v === null) continue; if (typeof v !== 'number') throw new RangeError(`${k} must be a number from 0 to 100`); res[k] = pct(v, k); } // null means "use the default", never "no reserve"
  if (!Array.isArray(i.taskTypes) || i.taskTypes.some((t) => typeof t !== 'string')) throw new RangeError('taskTypes must be a list of text values');
  if (remaining === null) return { allowed: true, state: 'UNKNOWN', reason: 'The remaining allowance is not known, so no reserve is applied and no number is guessed.' };
  const reserve = i.tier >= 4 ? res.frontierReservePercent : i.tier === 3 ? res.architectReservePercent : 0;
  if (reserve === 0 || remaining > reserve) return { allowed: true, state: pressure(remaining), reason: 'Enough allowance is left.' };
  if (i.taskTypes.some((t) => RESERVE_USERS.has(t))) return { allowed: true, state: pressure(remaining), reason: `This work may use the last ${reserve}% reserved for planning, security, hard debugging and final review.` };
  return { allowed: false, state: pressure(remaining), reason: `Only ${remaining}% is left, and the last ${reserve}% is kept for planning, security, hard debugging and final review.` };
}

/**
 * @param {{limit: {tokens?: number, credits?: number, money?: number}, spent: {tokens?: number, credits?: number, money?: number}}} b
 * @returns {{status: 'OK'|'WARN'|'STOP', reasons: string[]}}
 */
export function budgetStatus(b) {
  const KEYS = ['tokens', 'credits', 'money'];
  if (!b || typeof b.limit !== 'object' || b.limit === null || Array.isArray(b.limit) || Object.keys(b.limit).length === 0) throw new RangeError('limit must be an object with at least one of tokens, credits or money');
  for (const k of Object.keys(b.limit)) if (!KEYS.includes(k)) throw new RangeError(`limit may only contain tokens, credits or money, not "${String(k).slice(0, 20)}"`);
  if (typeof b.spent !== 'object' || b.spent === null || Array.isArray(b.spent)) throw new RangeError('spent must be an object');
  const reasons = []; let status = 'OK';
  for (const k of ['tokens', 'credits', 'money']) {
    const lim = b.limit?.[k], sp = b.spent?.[k];
    if (lim === undefined) continue;
    if (typeof lim !== 'number' || !Number.isFinite(lim) || lim <= 0) throw new RangeError(`limit.${k} must be a positive number`);
    if (typeof sp !== 'number' || !Number.isFinite(sp) || sp < 0) throw new RangeError(`spent.${k} must be a number of at least 0, or the limit cannot be checked`);
    if (sp >= lim) { status = 'STOP'; reasons.push(`${k}: ${sp} of ${lim} used: the phase stops here.`); }
    else if (sp >= lim * 0.8) { if (status !== 'STOP') status = 'WARN'; reasons.push(`${k}: ${Math.round((sp / lim) * 100)}% of the limit used.`); }
  }
  return { status, reasons };
}
