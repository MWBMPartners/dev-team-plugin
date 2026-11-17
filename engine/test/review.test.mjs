import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseReviewer, diversityBonus } from '../lib/independence.mjs';
import { findingId, addFinding, updateFinding, precision } from '../lib/findings.mjs';
import { planReview, specialistsFor } from '../lib/review.mjs';

const M = (provider, id, tier, canaryStage = 'TRUSTED', extra = {}) => ({ provider, id, tier, canaryStage, availability: 'AVAILABLE', lifecycleStatus: 'ACTIVE', costBand: tier, ...extra });
const models = [M('claude', 'sonnet', 2), M('claude', 'opus', 3), M('codex', 'gpt-x', 3)];
const built = { provider: 'claude', model: 'opus' };

test('review ladder: a different provider first; then the same provider\'s other model; then the same model fresh', () => {
  assert.equal(chooseReviewer({ builtBy: built, risk: 'NORMAL', models }).independence, 'CROSS_PROVIDER');
  const noOther = chooseReviewer({ builtBy: built, risk: 'NORMAL', models: [M('claude', 'opus', 3), M('claude', 'fable', 4)] });
  assert.equal(noOther.independence, 'SAME_PROVIDER_DIFFERENT_MODEL'); assert.ok(noOther.warnings.length);
  const only = chooseReviewer({ builtBy: built, risk: 'LOW', models: [M('claude', 'opus', 3)] });
  assert.equal(only.independence, 'SAME_MODEL_FRESH_CONTEXT'); assert.equal(only.chosen.id, 'opus');
  assert.equal(chooseReviewer({ builtBy: built, risk: 'NORMAL', models: [M('claude', 'sonnet', 2)] }).reason, 'NO_REVIEWER_AVAILABLE');
});
test('critical work: cross-provider when possible; with the other provider exhausted the next rung is used, the reason is recorded and it never claims cross-provider', () => {
  assert.equal(chooseReviewer({ builtBy: built, risk: 'CRITICAL', models }).satisfied, true);
  const r = chooseReviewer({ builtBy: built, risk: 'CRITICAL', models, exhausted: ['codex'] });
  assert.equal(r.independence, 'SAME_MODEL_FRESH_CONTEXT'); assert.equal(r.satisfied, false); assert.ok(r.skipped.some((s) => s.model === 'codex/gpt-x' && s.reason === 'QUOTA_EXHAUSTED'));
  const v = chooseReviewer({ builtBy: built, risk: 'CRITICAL', models: [M('claude', 'opus', 3), M('codex', 'gpt-x', 3, 'VALIDATED')] });
  assert.ok(v.skipped.some((s) => s.reason === 'CANARY_STAGE')); assert.notEqual(v.independence, 'CROSS_PROVIDER');
  assert.equal(chooseReviewer({ builtBy: built, risk: 'LOW', models: [M('claude', 'opus', 3), M('codex', 'gpt-x', 3, 'PROVISIONAL')] }).independence, 'CROSS_PROVIDER');
  assert.throws(() => chooseReviewer({ builtBy: built, risk: 'EXTREME', models }), RangeError); assert.throws(() => chooseReviewer({ builtBy: {}, models }), RangeError);
});
test('review floor: a model below tier 3 never reviews; retired and unavailable models are skipped', () => {
  const r = chooseReviewer({ builtBy: built, risk: 'NORMAL', models: [M('codex', 'small', 2), M('codex', 'old', 3, 'TRUSTED', { lifecycleStatus: 'RETIRED' }), M('claude', 'opus', 3)] });
  assert.deepEqual(r.skipped.map((s) => s.reason).sort(), ['BELOW_REVIEW_FLOOR', 'UNAVAILABLE']); assert.equal(r.independence, 'SAME_MODEL_FRESH_CONTEXT');
});
test('diversity bonus: a provider that neither planned nor built is preferred', () => {
  assert.equal(diversityBonus('claude', 'codex', { provider: 'gemini' }), 1); assert.equal(diversityBonus('claude', 'codex', { provider: 'claude' }), 0);
});
test('findings: stable ids; allowed steps only; verified cannot be re-opened without evidence; the raiser cannot verify; counters', () => {
  const id1 = findingId({ file: 'a.js', rule: 'R1', summary: 'Missing  check' }), id2 = findingId({ file: 'A.js', rule: 'r1', summary: 'missing check' });
  assert.equal(id1, id2); assert.match(id1, /^F-[0-9a-f]{8}$/);
  let r = addFinding([], { file: 'a.js', rule: 'R1', summary: 'Missing check', severity: 'BLOCKING', reviewer: 'codex' }); let list = r.list;
  assert.equal(addFinding(list, { file: 'a.js', rule: 'R1', summary: 'Missing check', severity: 'BLOCKING', reviewer: 'codex' }).added, false);
  assert.throws(() => updateFinding(list, r.id, { status: 'FIXED' }), /cannot go from OPEN to FIXED/);
  list = updateFinding(list, r.id, { status: 'ACCEPTED', by: 'lead' }); list = updateFinding(list, r.id, { status: 'FIXED', by: 'engineer' });
  assert.throws(() => updateFinding(list, r.id, { status: 'VERIFIED', by: 'codex' }), /raised/);
  list = updateFinding(list, r.id, { status: 'VERIFIED', by: 'claude-checker' });
  assert.throws(() => updateFinding(list, r.id, { status: 'OPEN', by: 'x' }), /new evidence/); assert.throws(() => updateFinding(list, r.id, { status: 'OPEN', by: 'x', evidence: 'short' }), /new evidence/);
  list = updateFinding(list, r.id, { status: 'OPEN', by: 'x', evidence: 'The check is missing again on the new route.' }); assert.equal(list[0].status, 'OPEN');
  assert.throws(() => updateFinding(list, 'F-nope', { status: 'OPEN' }), RangeError); assert.throws(() => updateFinding(list, r.id, { status: 'WEIRD' }), RangeError);
  const l2 = addFinding([], { file: 'b', summary: 'x', severity: 'LOW', reviewer: 'codex' }); const fp = updateFinding(l2.list, l2.id, { status: 'FALSE_POSITIVE', by: 'lead' });
  assert.deepEqual(precision(fp), { codex: { raised: 1, accepted: 0, rejected: 0, falsePositive: 1 } });
  assert.throws(() => updateFinding(fp, l2.id, { status: 'ACCEPTED' }), /cannot go/);
});
test('review plan: specialists by task type and component, an adversarial pass at high risk, a fresh-context contract and the chosen reviewer', () => {
  assert.deepEqual(specialistsFor(['SECURITY_REVIEW', 'DATABASE_REVIEW'], 'LOW'), { specialists: ['database', 'security'], adversarial: false });
  assert.deepEqual(specialistsFor([], 'HIGH', ['payment gateway', 'sql migration']), { specialists: ['database', 'security'], adversarial: true });
  const p = planReview({ jobId: 'j-aaaaaaaaaaaa', phase: 'verify', risk: 'CRITICAL', files: ['a.js'], taskTypes: ['SECURITY_REVIEW'], builtBy: built, models, invariants: ['no secrets'] });
  assert.equal(p.contract.freshContext, true); assert.equal(p.contract.adversarial, true); assert.ok(p.contract.instructions.some((x) => /attack/.test(x))); assert.equal(p.reviewer.independence, 'CROSS_PROVIDER');
  assert.throws(() => planReview({ jobId: 'j', phase: 'v', files: 'x', builtBy: built, models }), RangeError);
});
