// @ts-check
// File:    engine/lib/fallback.mjs
// Purpose: When the agent chosen for a job cannot be used, walk down a fixed list of replacements, and when an agent
//          has to be replaced in the middle of a phase, record it and strengthen the review. The order is: the same
//          provider's equal or stronger model, then another provider's equal or stronger model, cheapest first. A
//          weaker model is never offered as a replacement.

/** @param {any[]} models profiles with {provider, id, tier, costBand} @param {{provider: string, id: string, tier: number}} failed @param {string[]} [excluded] */
export function ladder(models, failed, excluded = []) {
  const ok = (m) => m.tier >= failed.tier && m.id !== failed.id && !excluded.includes(m.id);
  const byCost = (a, b) => a.tier - b.tier || (a.costBand ?? 99) - (b.costBand ?? 99) || a.id.localeCompare(b.id);
  const same = models.filter((m) => ok(m) && m.provider === failed.provider).sort(byCost);
  const other = models.filter((m) => ok(m) && m.provider !== failed.provider).sort(byCost);
  return [...same.map((m) => ({ ...m, rung: 'SAME_PROVIDER' })), ...other.map((m) => ({ ...m, rung: 'OTHER_PROVIDER' }))];
}

/** Before a phase starts: pick the next candidate and remember what was preferred so the next phase tries it first. */
export function fallback(models, failed, excluded = []) {
  const l = ladder(models, failed, excluded);
  return l.length ? { next: l[0], preferred: failed.id, remaining: l.length - 1 } : { next: null, preferred: failed.id, remaining: 0, reason: 'NO_SUITABLE_AGENT_AVAILABLE' };
}

const RETIREMENT = ['RETIRED', 'REMOVED', 'ACCESS_REVOKED', 'UNRECOVERABLE'];

/**
 * In the middle of a phase. A retired or lost agent is always replaced. For a long or unknown quota wait the
 * replacement happens only if the owner turned `midPhaseAgentSwitch` on; otherwise the phase stays blocked.
 */
export function takeoverPlan({ enabled, reason, models, failed }) {
  const retired = RETIREMENT.includes(reason);
  if (!retired && !enabled) return { takeover: false, state: 'BLOCKED_AWAITING_AGENT', reason: 'A mid-phase agent switch is off, so the phase waits for the same agent and the owner is asked.' };
  const f = fallback(models, failed);
  if (!f.next) return { takeover: false, state: 'BLOCKED_AWAITING_AGENT', reason: 'No equal or stronger agent is available to take over.' };
  return { takeover: true, next: f.next, event: 'MID_PHASE_TAKEOVER_OCCURRED', reviewStrengthening: 'FULL_CATCH_UP', because: retired ? reason : 'QUOTA_WAIT_TOO_LONG_OR_UNKNOWN', rung: f.next.rung };
}
