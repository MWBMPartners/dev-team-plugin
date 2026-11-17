import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gateCheck, levelFor } from '../lib/gates.mjs';
import { listPacks, loadPacks, validatePack, floorWithPacks, rollbackRequired } from '../lib/packs.mjs';
import { collectInvariants } from '../lib/invariants.mjs';
import { draftPlan, lockPlan } from '../lib/plan.mjs';
import { validate, loadSchema } from '../lib/schema.mjs';
import { pluginRoot } from '../lib/paths.mjs';

test('gates: each level maps to its bucket; human approval is enforced; prohibited stays prohibited even with every approval', () => {
  assert.deepEqual([gateCheck('RUN_TESTS').bucket, gateCheck('RUN_TESTS').allowed], [1, true]);
  assert.equal(gateCheck('INSTALL_DEPENDENCY', { confident: true }).bucket, 2); assert.equal(gateCheck('INSTALL_DEPENDENCY', { confident: true, deterministicPass: true }).bucket, 1);
  assert.equal(gateCheck('DELETE_FILES').allowed, false); assert.equal(gateCheck('DELETE_FILES', { reviewVerified: true }).allowed, true);
  assert.deepEqual([gateCheck('DEPLOY').bucket, gateCheck('DEPLOY').allowed], [3, false]); assert.equal(gateCheck('DEPLOY', { humanApproved: true }).allowed, true);
  const p = gateCheck('PUSH_DEFAULT_BRANCH', { confident: true, deterministicPass: true, reviewVerified: true, humanApproved: true }); assert.equal(p.allowed, false); assert.equal(p.bucket, null);
  assert.equal(gateCheck('SOMETHING_NEW').level, 'REQUIRE_HUMAN_APPROVAL'); assert.ok(gateCheck('SOMETHING_NEW').note);
  assert.equal(gateCheck('DEPLOY', { humanApproved: 'yes' }).allowed, false); // only a real true counts
  assert.throws(() => gateCheck(''), RangeError);
});
test('packs: all ten load and are valid; a pack raises a gate or a floor but a lowering pack is refused', () => {
  assert.equal(listPacks().length, 10);
  const packs = loadPacks(listPacks()); for (const p of packs) { assert.deepEqual(validatePack(p), [], p.id); assert.ok(validate(loadSchema(join(pluginRoot(), 'schemas/policy-pack.schema.json')), p).ok, p.id); }
  assert.equal(levelFor('APPLY_DATABASE_MIGRATION', loadPacks(['database-migration'])).level, 'REQUIRE_HUMAN_APPROVAL');
  assert.equal(levelFor('RUN_TESTS', [{ gates: { RUN_TESTS: 'REQUIRE_REVIEW' } }]).level, 'REQUIRE_REVIEW'); // raised
  assert.equal(levelFor('DEPLOY', [{ gates: { DEPLOY: 'AUTO' } }]).level, 'REQUIRE_HUMAN_APPROVAL'); // a lowering gate has no effect
  assert.ok(validatePack({ id: 'x', gates: { DEPLOY: 'AUTO' } }).some((m) => /less careful/.test(m)));
  assert.ok(validatePack({ id: 'x', raiseFloors: { MADE_UP: 3 } }).length); assert.ok(validatePack({ id: 'x', raiseFloors: { CODE_REVIEW: 9 } }).length);
  assert.throws(() => loadPacks(['nope']), RangeError); assert.throws(() => loadPacks(['../x']), RangeError);
  assert.equal(floorWithPacks(['DOCUMENTATION'], 'LOW', loadPacks(['billing-financial'])).minimumTier, 0);
  assert.equal(floorWithPacks(['CODE_REVIEW'], 'LOW', loadPacks(['billing-financial'])).minimumTier, 3);
  assert.equal(floorWithPacks(['SECURITY_REVIEW'], 'NORMAL', [{ raiseFloors: { SECURITY_REVIEW: 1 } }]).minimumTier, 3); // never lowers the built-in minimum
  assert.equal(rollbackRequired(loadPacks(['security-sensitive'])), true); assert.equal(rollbackRequired(loadPacks(['native-macos'])), false);
});
test('invariants: rules are collected from instruction files (also .OpenAI/), code fences are ignored, secrets are redacted, packs add theirs, and ids are stable', () => {
  const d = mkdtempSync(join(tmpdir(), 'dt-inv-'));
  writeFileSync(join(d, 'CLAUDE.md'), '# Rules\n- Never commit a secret such as sk_live_abcdefgh12345678 to the repository.\n- Prefer small functions.\n```\n- You must not see this example line in a code block\n```\nAll user-facing text must be in plain English.\n');
  mkdirSync(join(d, '.OpenAI')); writeFileSync(join(d, '.OpenAI', 'AGENTS.md'), '- Always run the tests before committing.\n');
  const inv = collectInvariants(d, loadPacks(['mwbm-standard']));
  const texts = inv.map((x) => x.text).join('\n');
  assert.ok(texts.includes('Always run the tests') && texts.includes('plain English') && texts.includes('Never commit a secret')); assert.ok(!texts.includes('sk_live_')); assert.ok(!texts.includes('example line')); assert.ok(!texts.includes('small functions'));
  assert.ok(inv.some((x) => x.source.startsWith('pack:mwbm-standard'))); assert.ok(inv.every((x) => /^INV-[0-9a-f]{8}$/.test(x.id)));
  assert.deepEqual(collectInvariants(d, []).map((x) => x.id), collectInvariants(d, []).map((x) => x.id));
});
test('plan: HIGH or CRITICAL risk plans cannot be locked without rollback requirements', () => {
  const d = (c) => draftPlan({ planId: 'p', contract: c });
  assert.throws(() => lockPlan(d({ risk: 'HIGH' }), { approver: 'o' }), /rollbackRequirements/); assert.throws(() => lockPlan(d({ risk: 'critical', rollbackRequirements: [] }), { approver: 'o' }), /rollbackRequirements/);
  assert.equal(lockPlan(d({ risk: 'HIGH', rollbackRequirements: ['revert the commit'] }), { approver: 'o' }).status, 'LOCKED'); assert.equal(lockPlan(d({ risk: 'LOW' }), { approver: 'o' }).status, 'LOCKED');
});

// ---- Fixes after the independent review of increment 6 ----
import { writeFileSync as wf } from 'node:fs';
test('gates: an action name cannot slip past by spelling; packs of the wrong shape are invalid; null packs and evidence do not crash', () => {
  for (const n of ['force_push', ' FORCE_PUSH ', 'Force-Push', 'push_default_branch']) { const r = gateCheck(n, { humanApproved: true, confident: true, deterministicPass: true, reviewVerified: true }); assert.equal(r.level, 'PROHIBITED', n); assert.equal(r.allowed, false); }
  assert.equal(levelFor('deploy', [{ gates: { Deploy: 'AUTO' } }]).level, 'REQUIRE_HUMAN_APPROVAL'); assert.equal(levelFor('run_tests', [{ gates: { 'run-tests': 'REQUIRE_REVIEW' } }]).level, 'REQUIRE_REVIEW');
  assert.ok(validatePack({ id: 'x', invariants: [1] }).length); assert.ok(validatePack({ id: 'x', gates: ['a'] }).length); assert.ok(validatePack({ id: 'x', rollbackRequired: 'yes' }).length);
  assert.doesNotThrow(() => gateCheck('RUN_TESTS', null, null)); assert.doesNotThrow(() => levelFor('RUN_TESTS', null));
});
test('plan: the rollback rule trims and reads the risk wherever it is given, needs a real item, and honours --risk and packs', () => {
  const d = (c) => draftPlan({ planId: 'p', contract: c });
  for (const c of [{ risk: 'HIGH ' }, { risk: 'HIGH', rollbackRequirements: [''] }, { risk: 'HIGH', rollbackRequirements: [null] }, { risk: { level: 'HIGH' } }, { riskLevel: 'critical' }]) assert.throws(() => lockPlan(d(c), { approver: 'o' }), /rollbackRequirements/, JSON.stringify(c));
  assert.throws(() => lockPlan(d({ goal: 'x' }), { approver: 'o', risk: 'HIGH' }), /rollbackRequirements/); assert.throws(() => lockPlan(d({ goal: 'x' }), { approver: 'o', rollbackRequired: true }), /rollbackRequirements/);
  assert.equal(lockPlan(d({ goal: 'x', rollbackRequirements: ['revert'] }), { approver: 'o', risk: 'HIGH', rollbackRequired: true }).status, 'LOCKED');
});
test('invariants: CRLF files, mismatched fences and symbolic links', () => {
  const d = mkdtempSync(join(tmpdir(), 'dt-inv2-'));
  wf(join(d, 'CLAUDE.md'), '- You must never push to main.\r\n```\r\n~~~\r\n- You must not collect this example rule\r\n```\r\n- Always run the tests.\r\n');
  const t = collectInvariants(d, []).map((x) => x.text).join('\n'); assert.ok(t.includes('never push to main') && t.includes('Always run the tests')); assert.ok(!t.includes('example rule'));
  const e = mkdtempSync(join(tmpdir(), 'dt-inv3-')); wf(join(e, 'real.md'), '- You must never read this through a link.\n'); symlinkSync(join(e, 'real.md'), join(e, 'GEMINI.md'));
  assert.deepEqual(collectInvariants(e, []), []); // an instruction file that is a symbolic link is not followed
});

// ---- Second review of increment 6 ----
test('gates: the same action under two spellings in one pack - the strictest counts, and the pack is invalid', () => {
  const pack = { id: 'x', gates: { Deploy: 'REQUIRE_HUMAN_APPROVAL', deploy: 'PROHIBITED' } };
  assert.equal(levelFor('DEPLOY', [pack]).level, 'PROHIBITED'); assert.ok(validatePack(pack).some((m) => /twice/.test(m)));
});
test('plan: an unrecognised risk is refused instead of being read as no risk', () => {
  const d = (c) => draftPlan({ planId: 'p', contract: c });
  for (const c of [{ risk: ['HIGH'] }, { risk: { value: 'HIGH' } }, { risk: 'High risk' }]) assert.throws(() => lockPlan(d(c), { approver: 'o' }), /exactly LOW, NORMAL, HIGH or CRITICAL/, JSON.stringify(c));
  assert.throws(() => lockPlan(d({ goal: 'x' }), { approver: 'o', risk: 'HIHG' }), /exactly/); assert.equal(lockPlan(d({ risk: ' low ' }), { approver: 'o' }).status, 'LOCKED');
});
test('invariants: inline triple-backtick code is not a fence; tab-indented fences are not fences; a longer fence is not closed by a shorter one', () => {
  const d = mkdtempSync(join(tmpdir(), 'dt-inv4-'));
  wf(join(d, 'CLAUDE.md'), '```npm test``` runs the tests.\n- You must never push to main.\n\t```\n- You must always keep this rule.\n````\n```\n- You must not collect this one.\n````\n- Never skip the last rule.\n');
  const t = collectInvariants(d, []).map((x) => x.text).join('\n');
  assert.ok(t.includes('never push to main') && t.includes('always keep this rule') && t.includes('Never skip the last rule')); assert.ok(!t.includes('not collect this one'));
});
