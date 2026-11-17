import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
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
