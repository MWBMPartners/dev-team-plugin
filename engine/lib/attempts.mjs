// @ts-check
// File:    engine/lib/attempts.mjs
// Purpose: Stops a task that keeps failing from being retried forever. A task gets at most maxAttempts tries
//          (default 3: the two-strike rule plus one escalated try). Two tries in a row with no progress also
//          stop it. A fourth try needs an escalation recorded first. A success closes the task.

/** @param {number} [maxAttempts] */
export const newTask = (maxAttempts = 3) => {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) throw new RangeError('maxAttempts must be a whole number from 1 to 10');
  return { maxAttempts, attempts: [], closed: false, escalations: 0, since: 0 };
};

/** May another attempt start? */
export function canAttempt(task) {
  if (task.closed) return { ok: false, reason: 'The task is already complete.' };
  const s = status(task);
  if (s.capReached) return { ok: false, reason: s.reason };
  return { ok: true, reason: null };
}

/** The cap rule on its own. */
function status(task) {
  const a = task.attempts, fails = a.filter((x) => x.outcome === 'FAIL').length;
  if (fails >= task.maxAttempts + task.escalations) return { capReached: true, reason: `${fails} failed attempts: stop, escalate the model tier, or surface it to the owner.` };
  const last2 = a.slice(task.since ?? 0).slice(-2); // only attempts since the last escalation count
  if (last2.length === 2 && last2.every((x) => x.outcome === 'FAIL' && x.progressMade === false)) return { capReached: true, reason: 'Two attempts in a row made no progress: stop, escalate the model tier, or surface it to the owner.' };
  return { capReached: false, reason: null };
}

/** Record an attempt, returning the new state (the old one is not changed). */
export function recordAttempt(task, { outcome, progressMade }) {
  if (!['SUCCESS', 'FAIL'].includes(outcome)) throw new RangeError('outcome must be SUCCESS or FAIL');
  if (typeof progressMade !== 'boolean') throw new RangeError('progressMade must be true or false');
  const gate = canAttempt(task);
  if (!gate.ok) throw new Error(`no more attempts: ${gate.reason}`);
  const next = { ...task, attempts: [...task.attempts, { outcome, progressMade }], closed: outcome === 'SUCCESS' };
  const s = status(next);
  return { task: next, capReached: s.capReached, reason: s.reason };
}

/** Record that the model tier was raised or the owner was told, which allows exactly one more attempt. */
export function recordEscalation(task) { return { ...task, escalations: task.escalations + 1, since: task.attempts.length }; }
