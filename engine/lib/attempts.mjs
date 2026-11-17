// @ts-check
// File:    engine/lib/attempts.mjs
// Purpose: Stops a task that keeps failing from being retried forever. A task may be tried maxAttempts times
//          (default 3: the two-strike rule plus one escalated try). Two tries in a row with no progress also
//          stop it. After a stop, an escalation (a stronger model, or the owner told) allows EXACTLY ONE more
//          try, and an escalation is only allowed when the task is actually stopped. A success closes the task.

/** @param {number} [maxAttempts] */
export const newTask = (maxAttempts = 3) => {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) throw new RangeError('maxAttempts must be a whole number from 1 to 10');
  return { maxAttempts, attempts: [], closed: false, escalations: 0, since: 0, allowance: maxAttempts };
};

/** Check a saved record has exactly the shape the engine writes. Throws a plain-words error if not. */
export function validateTask(t) {
  const bad = (m) => { throw new RangeError(`the attempt record is not valid: ${m}`); };
  if (!t || typeof t !== 'object' || Array.isArray(t)) bad('it must be an object');
  const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  if (!int(t.maxAttempts, 1, 10)) bad('maxAttempts must be a whole number from 1 to 10');
  if (!Array.isArray(t.attempts) || t.attempts.length > 100 || t.attempts.some((x) => !x || !['SUCCESS', 'FAIL'].includes(x.outcome) || typeof x.progressMade !== 'boolean')) bad('attempts must be a list of {outcome, progressMade}');
  if (typeof t.closed !== 'boolean') bad('closed must be true or false');
  if (t.closed !== t.attempts.some((x) => x.outcome === 'SUCCESS')) bad('closed must match whether an attempt succeeded');
  if (!int(t.escalations, 0, 100)) bad('escalations must be a whole number');
  if (!int(t.since, 0, t.attempts.length)) bad('since must be a whole number no larger than the number of attempts');
  if (!int(t.allowance, t.maxAttempts, 200)) bad('allowance must be a whole number of at least maxAttempts');
  return t;
}

/** Is the task stopped, and why? */
function stopped(task) {
  if (task.attempts.length >= task.allowance) return { stop: true, reason: `${task.attempts.length} attempts used: stop, escalate the model tier, or surface it to the owner.` };
  const last2 = task.attempts.slice(task.since).slice(-2); // only attempts since the last escalation count
  if (last2.length === 2 && last2.every((x) => x.outcome === 'FAIL' && x.progressMade === false)) return { stop: true, reason: 'Two attempts in a row made no progress: stop, escalate the model tier, or surface it to the owner.' };
  return { stop: false, reason: null };
}

/** May another attempt start? */
export function canAttempt(task) {
  validateTask(task);
  if (task.closed) return { ok: false, reason: 'The task is already complete.' };
  const s = stopped(task);
  return { ok: !s.stop, reason: s.reason };
}

/** Record an attempt, returning the new state (the old one is not changed). */
export function recordAttempt(task, { outcome, progressMade }) {
  if (!['SUCCESS', 'FAIL'].includes(outcome)) throw new RangeError('outcome must be SUCCESS or FAIL');
  if (typeof progressMade !== 'boolean') throw new RangeError('progressMade must be true or false');
  const gate = canAttempt(task);
  if (!gate.ok) throw new Error(`no more attempts: ${gate.reason}`);
  const next = { ...task, attempts: [...task.attempts, { outcome, progressMade }], closed: outcome === 'SUCCESS' };
  const s = next.closed ? { stop: false, reason: null } : stopped(next);
  return { task: next, capReached: s.stop, reason: s.reason };
}

/** Record an escalation. Only a stopped, unfinished task may be escalated; it then gets exactly one more try. */
export function recordEscalation(task) {
  validateTask(task);
  if (task.closed) throw new Error('the task is already complete, so there is nothing to escalate');
  if (!stopped(task).stop) throw new Error('the task is not stopped, so it cannot be escalated yet');
  return { ...task, escalations: task.escalations + 1, since: task.attempts.length, allowance: Math.max(task.allowance, task.attempts.length + 1) };
}
