// @ts-check
import { isAskFirst } from './routing.mjs';
// File:    engine/lib/independence.mjs
// Purpose: Chooses who checks a piece of work so that the checker is never the builder, and records HOW independent
//          the check was. The more risk, the more the check should come from a different provider:
//            LOW       optional      NORMAL    preferred
//            HIGH      strongly preferred       CRITICAL  required wherever another capable provider exists
//          The ladder, best first: a different provider, then the same provider's different model, then the same model
//          with a fresh agent that never saw the build. A rung is skipped with a recorded reason (its provider is out of
//          allowance, its model is not yet trusted enough for this risk, it is retired); the recorded independence level
//          never claims more than was really achieved.

export const LEVELS = ['CROSS_PROVIDER', 'SAME_PROVIDER_DIFFERENT_MODEL', 'SAME_MODEL_FRESH_CONTEXT'];
const NEEDS = { LOW: 'OPTIONAL', NORMAL: 'PREFERRED', HIGH: 'STRONGLY_PREFERRED', CRITICAL: 'REQUIRED_WHERE_POSSIBLE' };
// The riskiest work a model at each trust stage may be used for.
const STAGE_MAX = { NEW: -1, PROVISIONAL: 0, CANARY: 1, VALIDATED: 2, TRUSTED: 3 };
export const STAGES = Object.keys(STAGE_MAX);
const lcs = (x) => String(x).toLowerCase();
const RISK_RANK = { LOW: 0, NORMAL: 1, HIGH: 2, CRITICAL: 3 };

/**
 * @param {{builtBy: {provider: string, model: string}, risk?: string, models: any[], exhausted?: string[], minTier?: number, askFirst?: string[], approved?: string[]}} i
 * models: {provider, id, tier, canaryStage, availability, lifecycleStatus, costBand}
 */
export function chooseReviewer(i) {
  const risk = String(i.risk ?? 'NORMAL').toUpperCase();
  if (!Object.hasOwn(RISK_RANK, risk)) throw new RangeError('risk must be LOW, NORMAL, HIGH or CRITICAL');
  const b = i.builtBy; if (!b || typeof b.provider !== 'string' || typeof b.model !== 'string') throw new RangeError('builtBy needs a provider and a model');
  const minTier = i.minTier ?? 3, exhausted = (i.exhausted ?? []).map((x) => String(x).toLowerCase());
  const skipped = [];
  const eligible = [];
  const askFirst = (i.askFirst ?? []).map((x) => String(x).toLowerCase()), approved = (i.approved ?? []).map((x) => String(x).toLowerCase());
  for (const m of i.models) {
    const tag = `${m.provider}/${m.id}`;
    // A model on the ask-first list is never used for a review either, unless it was approved for this task. Local models are exempt.
    if (!m.local && askFirst.length && isAskFirst({ alias: m.alias ?? m.id, id: m.id, classes: m.classes ?? [], priced: m.priced !== false }, askFirst) && !approved.includes(String(m.alias ?? m.id).toLowerCase()) && !approved.includes(String(m.id).toLowerCase())) { skipped.push({ model: tag, reason: 'NEEDS_APPROVAL' }); continue; }
    if (!Number.isInteger(m.tier) || m.tier < minTier) { skipped.push({ model: tag, reason: 'BELOW_REVIEW_FLOOR' }); continue; }
    if (m.lifecycleStatus === 'RETIRED' || m.availability === 'UNAVAILABLE') { skipped.push({ model: tag, reason: 'UNAVAILABLE' }); continue; }
    if (exhausted.includes(String(m.provider).toLowerCase())) { skipped.push({ model: tag, reason: 'QUOTA_EXHAUSTED' }); continue; }
    if ((Object.hasOwn(STAGE_MAX, m.canaryStage) ? STAGE_MAX[m.canaryStage] : -1) < RISK_RANK[risk]) { skipped.push({ model: tag, reason: 'CANARY_STAGE' }); continue; }
    eligible.push(m);
  }
  const byCost = (a, c) => (a.costBand ?? 99) - (c.costBand ?? 99) || a.tier - c.tier || a.id.localeCompare(c.id);
  const rungs = [
    ['CROSS_PROVIDER', eligible.filter((m) => lcs(m.provider) !== lcs(b.provider)).sort(byCost)],
    ['SAME_PROVIDER_DIFFERENT_MODEL', eligible.filter((m) => lcs(m.provider) === lcs(b.provider) && lcs(m.id) !== lcs(b.model)).sort(byCost)],
    ['SAME_MODEL_FRESH_CONTEXT', eligible.filter((m) => lcs(m.provider) === lcs(b.provider) && lcs(m.id) === lcs(b.model))],
  ];
  const pick = rungs.find(([, list]) => list.length);
  const crossExistedButSkipped = skipped.some((s) => !lcs(s.model).startsWith(`${lcs(b.provider)}/`) && s.reason !== 'BELOW_REVIEW_FLOOR');
  if (!pick) return { chosen: null, independence: null, need: NEEDS[risk], satisfied: false, skipped, reason: 'NO_REVIEWER_AVAILABLE' };
  const [level, list] = pick;
  const wantsCross = risk !== 'LOW';
  const warnings = [];
  if (level !== 'CROSS_PROVIDER' && wantsCross) warnings.push(crossExistedButSkipped ? 'A different provider exists but could not be used (see skipped), so the check is less independent than wanted.' : 'No other provider is available, so the check is less independent than wanted.');
  return { chosen: list[0], independence: level, need: NEEDS[risk], satisfied: risk === 'LOW' || risk === 'NORMAL' || level === 'CROSS_PROVIDER' || !crossExistedButSkipped, skipped, warnings };
}

/** A different provider's review across a whole job gets a small bonus, so one provider does not do every step. */
export function diversityBonus(plannedBy, builtBy, candidate) {
  const used = [plannedBy, builtBy];
  return used.map(lcs).includes(lcs(candidate.provider)) ? 0 : 1;
}
