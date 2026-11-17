// @ts-check
// File:    engine/lib/dryrun.mjs
// Purpose: Shows what the engine WOULD do for a list of planned phases, without doing anything: which
//          model, what effort, what is held back for approval, and the questions the owner should answer
//          first, each with the reason it is asked. Cost and quota columns arrive in a later increment.

/**
 * @param {{name: string, role: string, taskTypes?: string[], risk?: string, uncertain?: {input: string, why: string}[]}[]} phases
 * @param {(req: any) => any} routeFn  the routing function, already bound to settings and catalogue
 */
import { estimate } from './estimate.mjs';
import { pressure } from './budget.mjs';

export function dryRun(phases, routeFn) {
  const rows = [], questions = [], seen = new Set();
  for (const ph of phases) {
    // Pass only the keys this phase really sets, so file-wide settings are never overwritten by undefined.
    const req = { role: ph.role };
    for (const k of ['taskTypes', 'risk', 'providers', 'approved', 'exhausted', 'builtBy', 'minTier', 'complex', 'escalateEffort', 'quotaRemaining', 'reserves']) if (ph[k] !== undefined) req[k] = ph[k];
    const r = routeFn(req);
    const d = r.decision;
    rows.push({ phase: ph.name, role: ph.role, tier: d ? d.tier : null, model: d ? d.model : null, provider: d ? d.provider : null, effort: d?.effort?.level ?? null, code: r.code, heldBack: r.heldBack.map((h) => h.model), cost: costColumn(ph, d), quota: quotaColumn(ph, d) });
    for (const q of r.questions) { const key = q.id + (q.ask ?? ''); if (!seen.has(key)) { seen.add(key); questions.push({ ...q, why: q.id === 'route-order' ? 'It decides whether free local models or paid cloud models are tried first.' : 'The best-suited model costs more, so it needs your yes.' }); } }
    if (ph.uncertain !== undefined && (!Array.isArray(ph.uncertain) || ph.uncertain.some((u) => !u || typeof u.input !== 'string' || typeof u.why !== 'string'))) throw new RangeError('uncertain must be a list of {input, why} text pairs');
    for (const u of ph.uncertain ?? []) questions.push({ id: 'uncertain-input', ask: u.input, why: u.why, suggested: null });
  }
  return { rows, questions };
}

/** LOW/LIKELY/HIGH relative cost for the chosen model, or a plain reason there is none. */
function costColumn(ph, d) {
  if (!d || d.deterministic) return d ? { unit: 'relative cost units', low: 0, likely: 0, high: 0 } : 'no model chosen';
  if (!Array.isArray(ph.taskTypes) || ph.taskTypes.length === 0) return 'add taskTypes to get an estimate';
  try { const e = estimate({ taskTypes: ph.taskTypes, costBand: d.costBand }); return { unit: e.unit, low: e.low, likely: e.likely, high: e.high, caveat: 'an estimate, not a bill' }; } catch { return 'no estimate'; }
}
/** What the remaining allowance of the chosen provider looks like, only if the request gave a number for it. */
function quotaColumn(ph, d) {
  const qr = ph.quotaRemaining; if (!d || !d.provider || !qr || typeof qr !== 'object') return 'UNKNOWN';
  const key = Object.keys(qr).find((k) => k.toLowerCase() === String(d.provider).toLowerCase());
  try { return key === undefined ? 'UNKNOWN' : pressure(qr[key]); } catch { return 'UNKNOWN'; }
}
