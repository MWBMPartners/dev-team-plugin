import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { draftPlan, lockPlan, verifyPlan, diffPlans, planHash, Conflict, StaleDraft } from '../lib/plan.mjs';
import { classifyDrift } from '../lib/drift.mjs';
import { checkEvidence } from '../lib/evidence.mjs';
import { newTask, recordAttempt, recordEscalation, canAttempt, validateTask } from '../lib/attempts.mjs';
import { pluginRoot } from '../lib/paths.mjs';

const lockedFile = join(pluginRoot(), '.claude/plans/orchestrator-v2/plan-contract.orchestrator-v2.v1.json');
const c1 = { requirements: ['R1', 'R2'], constraints: ['C1'] };

test('plan: the hash ignores key order and changes with content; the engine agrees with the hand lock on this project\'s own plan', () => {
  assert.equal(planHash({ a: 1, b: [1, 2] }), planHash({ b: [1, 2], a: 1 })); assert.notEqual(planHash({ a: 1 }), planHash({ a: 2 }));
  const doc = JSON.parse(readFileSync(lockedFile, 'utf8')); const v = verifyPlan(doc);
  assert.equal(v.ok, true); assert.equal(v.status, 'LOCKED');
});
test('plan: lock needs an approver, cannot be repeated, and an edited locked plan is caught', () => {
  const d = draftPlan({ planId: 'p', contract: c1 });
  assert.throws(() => lockPlan(d, { approver: ' ' }), RangeError);
  const l = lockPlan(d, { approver: 'owner', now: new Date('2026-11-17T00:00:00Z') });
  assert.equal(l.status, 'LOCKED'); assert.equal(l.approvedAt, '2026-11-17');
  assert.throws(() => lockPlan(l, { approver: 'owner' }), Conflict);
  assert.equal(verifyPlan(l).ok, true);
  const tampered = { ...l, contract: { ...l.contract, requirements: ['R1'] } };
  const v = verifyPlan(tampered); assert.equal(v.ok, false); assert.equal(v.status, 'TAMPERED');
  assert.equal(verifyPlan({ ...d, contract: { x: 1 } }).ok, true); // a draft may be out of date
  assert.throws(() => draftPlan({ planId: '../x', contract: c1 }), RangeError);
});
test('plan: diff lists sections and counts item changes', () => {
  const a = draftPlan({ planId: 'p', contract: c1 }), b = draftPlan({ planId: 'p', planVersion: 2, contract: { requirements: ['R1', 'R3'], extra: 1 } });
  const d = diffPlans(a, b); assert.deepEqual(d.added, ['extra']); assert.deepEqual(d.removed, ['constraints']);
  assert.deepEqual(d.changed, [{ section: 'requirements', itemsAdded: 1, itemsRemoved: 1 }]);
});
test('drift: the four levels, and STOP only for significant or architectural', () => {
  const base = { taskFiles: ['src/a.js', 'src/lib/'], protectedPaths: ['src/core/'], protectedNames: ['AuthGuard'] };
  assert.equal(classifyDrift({ ...base, changedFiles: ['src/a.js', 'src/lib/x.js'] }).level, 'NO_DRIFT');
  const m = classifyDrift({ ...base, changedFiles: ['src/a.js'], declared: [{ kind: 'minor', note: 'renamed a variable' }] }); assert.equal(m.level, 'MINOR_IMPLEMENTATION_DETAIL'); assert.equal(m.stop, false);
  const s = classifyDrift({ ...base, changedFiles: ['src/other.js'] }); assert.equal(s.level, 'SIGNIFICANT_DRIFT'); assert.equal(s.stop, true);
  assert.equal(classifyDrift({ ...base, changedFiles: ['src/core/x.js'] }).level, 'ARCHITECTURAL_DRIFT');
  assert.equal(classifyDrift({ ...base, changedFiles: ['src/a.js'], changedText: 'removed AuthGuard' }).level, 'ARCHITECTURAL_DRIFT');
  assert.equal(classifyDrift({ ...base, changedFiles: ['src/a.js'], declared: [{ kind: 'architectural', note: 'x' }] }).level, 'ARCHITECTURAL_DRIFT');
  assert.throws(() => classifyDrift({ ...base, changedFiles: ['a'], declared: [{ kind: 'weird' }] }), RangeError);
  // path tricks are tidied first: this is really src/core/x.js, which is protected
  assert.equal(classifyDrift({ ...base, changedFiles: ['src/lib/../core/x.js'] }).level, 'ARCHITECTURAL_DRIFT');
  assert.equal(classifyDrift({ ...base, changedFiles: ['../outside.js'] }).level, 'SIGNIFICANT_DRIFT');
});
test('evidence: a failed or missing required result, an open blocking finding, an unproven criterion, or a changed plan blocks completion; self-report never wins', () => {
  const ok = { results: [{ name: 'unit', kind: 'test', status: 'PASS' }], findings: [{ id: 'F1', severity: 'BLOCKING', status: 'FIXED' }], criteria: [{ id: 'AC1', ref: 'test:unit' }], planVersion: 1, lockedPlanVersion: 1 };
  assert.equal(checkEvidence(ok).complete, true);
  assert.equal(checkEvidence({ ...ok, results: [{ name: 'unit', kind: 'test', status: 'FAIL' }], selfReported: 'CONFIDENT' }).complete, false);
  assert.ok(checkEvidence({ ...ok, results: [{ name: 'build', kind: 'build' }], selfReported: 'CONFIDENT' }).note);
  assert.equal(checkEvidence({ ...ok, findings: [{ id: 'F2', severity: 'BLOCKING', status: 'OPEN' }] }).failing[0].gate, 'BLOCKING_FINDING_OPEN');
  assert.equal(checkEvidence({ ...ok, criteria: [{ id: 'AC2' }] }).failing[0].gate, 'CRITERION_UNPROVEN');
  assert.equal(checkEvidence({ ...ok, planVersion: 2 }).failing[0].gate, 'PLAN_CHANGED');
  assert.equal(checkEvidence({ requiredKinds: [], results: [{ name: 'lint', kind: 'lint', required: false }] }).complete, false); // an optional result alone proves nothing
  assert.equal(checkEvidence({ requiredKinds: [], results: [{ name: 'lint', kind: 'lint', status: 'PASS' }] }).complete, true);
});
test('attempts: three failures stop it; two no-progress failures stop it; a fourth needs an escalation; success closes the task', () => {
  let t = newTask(); let r;
  for (let i = 0; i < 2; i++) { r = recordAttempt(t, { outcome: 'FAIL', progressMade: true }); t = r.task; assert.equal(r.capReached, false); }
  r = recordAttempt(t, { outcome: 'FAIL', progressMade: true }); assert.equal(r.capReached, true); t = r.task;
  assert.throws(() => recordAttempt(t, { outcome: 'FAIL', progressMade: true }));
  t = recordEscalation(t); assert.equal(canAttempt(t).ok, true);
  r = recordAttempt(t, { outcome: 'SUCCESS', progressMade: true }); assert.equal(r.task.closed, true); assert.equal(canAttempt(r.task).ok, false);
  let n = newTask(); n = recordAttempt(n, { outcome: 'FAIL', progressMade: false }).task; r = recordAttempt(n, { outcome: 'FAIL', progressMade: false }); assert.equal(r.capReached, true);
  assert.equal(canAttempt(recordEscalation(r.task)).ok, true); // escalation clears the no-progress stop
  assert.throws(() => newTask(0), RangeError); assert.throws(() => recordAttempt(newTask(), { outcome: 'MAYBE', progressMade: true }), RangeError);
});

// ---- Fixes after the independent review of increment 3 ----
test('plan: a stale draft is never locked; odd statuses are invalid; a locked plan cannot be turned back into a draft', () => {
  const d = draftPlan({ planId: 'p', contract: c1 });
  assert.throws(() => lockPlan({ ...d, contract: { ...c1, requirements: ['R1'] } }, { approver: 'o' }), StaleDraft);
  assert.throws(() => lockPlan({ ...d, status: 'locked' }, { approver: 'o' }), RangeError);
  const l = lockPlan(d, { approver: 'owner' });
  const tampered = { ...l, contract: { requirements: ['X'] } };
  for (const s of ['DRAFT', 'locked', 'BOGUS']) assert.equal(verifyPlan({ ...tampered, status: s }).ok, false, s);
  assert.equal(verifyPlan({ ...l, approvedBy: null }).ok, false);
  assert.equal(verifyPlan({ ...tampered }).status, 'TAMPERED');
});
test('attempts: the saved record is validated; escalation only when stopped; exactly one more try per escalation', () => {
  assert.throws(() => validateTask({ ...newTask(), escalations: 'x' }), RangeError);
  assert.throws(() => validateTask({ ...newTask(), since: 99 }), RangeError);
  assert.throws(() => validateTask({ ...newTask(), maxAttempts: 9999 }), RangeError);
  assert.throws(() => validateTask({ ...newTask(), closed: true }), RangeError);
  assert.throws(() => recordEscalation(newTask()), /not stopped/);
  let t = newTask(); for (let i = 0; i < 3; i++) t = recordAttempt(t, { outcome: 'FAIL', progressMade: true }).task;
  t = recordEscalation(t); let r = recordAttempt(t, { outcome: 'FAIL', progressMade: true }); assert.equal(r.capReached, true); // exactly one more
  assert.throws(() => recordAttempt(r.task, { outcome: 'FAIL', progressMade: true }));
  let n = newTask(); for (let i = 0; i < 2; i++) n = recordAttempt(n, { outcome: 'FAIL', progressMade: false }).task;
  n = recordEscalation(n); r = recordAttempt(n, { outcome: 'FAIL', progressMade: false }); assert.equal(canAttempt(r.task).ok, false); // one try after the no-progress stop
  assert.throws(() => recordEscalation(recordEscalation(n)), /not stopped/);
});
test('evidence: nothing given, lower-case or unknown severities, blank refs, and a changed fingerprint all block completion', () => {
  const base = { results: [{ name: 'u', kind: 'test', status: 'PASS' }] };
  assert.equal(checkEvidence({ selfReported: 'done' }).complete, false);
  assert.equal(checkEvidence({ ...base, findings: [{ id: 'F', severity: 'blocking', status: 'open' }] }).complete, false);
  assert.equal(checkEvidence({ ...base, findings: [{ id: 'F', severity: 'wat', status: 'FIXED' }] }).complete, false);
  assert.equal(checkEvidence({ ...base, criteria: [{ id: 'A', ref: ' ' }] }).complete, false); assert.equal(checkEvidence({ ...base, criteria: [{ id: 'A', ref: {} }] }).complete, false);
  assert.equal(checkEvidence({ ...base, planHash: 'a', lockedPlanHash: 'b' }).complete, false);
  assert.equal(checkEvidence({ results: [{ name: 'b', kind: 'build', status: 'PASS' }] }).complete, false); // a test result is required by default
  assert.equal(checkEvidence(base).complete, true);
});

// ---- Fixes after the second independent review of increment 3 ----
test('attempts: a no-progress stop with a large maxAttempts still gives exactly one more try; a success must be last', () => {
  let n = newTask(5); for (let i = 0; i < 2; i++) n = recordAttempt(n, { outcome: 'FAIL', progressMade: false }).task;
  n = recordEscalation(n); n = recordAttempt(n, { outcome: 'FAIL', progressMade: false }).task; assert.equal(canAttempt(n).ok, false);
  assert.throws(() => validateTask({ ...newTask(), closed: true, attempts: [{ outcome: 'SUCCESS', progressMade: true }, { outcome: 'FAIL', progressMade: true }] }), RangeError);
});
test('evidence: at least one required result must pass even with requiredKinds empty; odd inputs are bad input, not crashes', () => {
  assert.equal(checkEvidence({ requiredKinds: [], results: [{ kind: 'lint', required: false, status: 'FAIL' }] }).complete, false);
  assert.equal(checkEvidence({ requiredKinds: [], results: [0] }).complete, false);
  assert.throws(() => checkEvidence({ requiredKinds: 'build', results: [] }), RangeError); assert.throws(() => checkEvidence(null), RangeError);
});
test('plan: an approver with control characters is refused; a garbage approval date is invalid; locking a non-plan is bad input', () => {
  const d = draftPlan({ planId: 'p', contract: c1 });
  assert.throws(() => lockPlan(d, { approver: 'Bob\u001b[31m' }), RangeError); assert.throws(() => lockPlan(d, { approver: 'a'.repeat(81) }), RangeError);
  const l = lockPlan(d, { approver: 'owner' }); assert.equal(verifyPlan({ ...l, approvedAt: 'garbage' }).ok, false);
  assert.throws(() => lockPlan(null, { approver: 'o' }), RangeError);
});
