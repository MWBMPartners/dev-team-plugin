// @ts-check
// File:    engine/lib/canary.mjs
// Purpose: How far a model is trusted, by evidence. A model starts NEW, is promoted one stage at a time when it keeps
//          succeeding, and is demoted one stage when it keeps failing. The owner can set a stage by hand
//          (USER_OVERRIDE), and that always wins. Each stage also says what share of suitable work may go to it.
export const STAGES = ['NEW', 'PROVISIONAL', 'CANARY', 'VALIDATED', 'TRUSTED'];
export const SAMPLE_SHARE = Object.freeze({ NEW: 0, PROVISIONAL: 0.05, CANARY: 0.2, VALIDATED: 0.6, TRUSTED: 1 });
const NEED = { PROVISIONAL: 3, CANARY: 5, VALIDATED: 10, TRUSTED: 20 }; // results needed to reach a stage

/**
 * @param {{current: string, results: boolean[], userOverride?: string|null}} i results: newest last, true = accepted
 */
export function nextStage({ current, results, userOverride = null }) {
  if (userOverride !== null && userOverride !== undefined) { if (!STAGES.includes(userOverride)) throw new RangeError('unknown stage'); return { stage: userOverride, change: userOverride === current ? 'NONE' : 'USER_OVERRIDE', reason: 'The owner set this stage by hand.' }; }
  if (!STAGES.includes(current)) throw new RangeError('unknown stage');
  if (!Array.isArray(results) || results.some((x) => typeof x !== 'boolean')) throw new RangeError('results must be a list of true/false');
  const i = STAGES.indexOf(current);
  const last5 = results.slice(-5);
  if (last5.length >= 5 && last5.filter((x) => !x).length >= 3 && i > 0) return { stage: STAGES[i - 1], change: 'DEMOTED', reason: 'Three of the last five results failed.' };
  const last20 = results.slice(-20), rate = last20.length ? last20.filter(Boolean).length / last20.length : 0;
  const target = STAGES[i + 1];
  if (target && results.length >= NEED[target] && rate >= 0.8) return { stage: target, change: 'PROMOTED', reason: `${results.length} results, ${Math.round(rate * 100)}% accepted recently.` };
  return { stage: current, change: 'NONE', reason: target ? `Needs ${NEED[target]} results and 80% accepted; has ${results.length} (${Math.round(rate * 100)}%).` : 'Already at the highest stage.' };
}
