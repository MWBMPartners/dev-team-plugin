import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, existsSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateRecord, record, readAll, purge, competency, learningEnabled } from '../lib/learning.mjs';
import { nextStage, SAMPLE_SHARE, STAGES } from '../lib/canary.mjs';
import { healthState } from '../lib/health.mjs';

const rec = (o = {}) => ({ taskType: 'ROUTINE_IMPLEMENTATION', provider: 'claude', model: 'sonnet', tier: 2, risk: 'NORMAL', accepted: true, at: '2026-11-17T10:00:00Z', ...o });
const dir = () => join(mkdtempSync(join(tmpdir(), 'dt-learn-')), 'learning');

test('records: only the allowed short fields; no code, prompts, paths, secrets or unknown fields; bad values refused', () => {
  assert.doesNotThrow(() => validateRecord(rec({ language: 'C++', framework: 'Next.js', firstPassTests: 'PASS', retries: 1, latencyMs: 900 })));
  for (const bad of [{ code: 'x = 1' }, { prompt: 'do it' }, { language: 'src/app/main.js' }, { model: 'a'.repeat(80) }, { taskType: 'NOPE' }, { tier: 9 }, { accepted: 'yes' }, { at: '2026-02-31T00:00:00Z' }, { retries: -1 }, { framework: 'sk_live_abcdefgh12345678' }, { risk: 'EXTREME' }]) assert.throws(() => validateRecord(rec(bad)), RangeError, JSON.stringify(bad));
  assert.throws(() => validateRecord(null), RangeError); const { model, ...missing } = rec(); assert.throws(() => validateRecord(missing), /needs model/);
});
test('storage: one file per month, switch-off respected, damaged lines skipped, purge removes everything', () => {
  const d = dir(); assert.equal(record(d, rec()).recorded, true); record(d, rec({ at: '2026-12-01T00:00:00Z' }));
  assert.deepEqual(readdirSync(d).sort(), ['2026-11.jsonl', '2026-12.jsonl']);
  appendFileSync(join(d, '2026-11.jsonl'), 'not json\n{"taskType":"NOPE"}\n'); assert.equal(readAll(d).length, 2);
  assert.equal(record(d, rec(), { DEV_TEAM_NO_LEARNING: '1' }).recorded, false); assert.equal(learningEnabled({ DEV_TEAM_NO_LEARNING: '1' }), false);
  assert.equal(readAll(d).length, 2); assert.deepEqual(purge(d), { purged: true }); assert.ok(!existsSync(d)); assert.deepEqual(readAll(d), []);
});
test('competency: too few observations give no score; recent results count more; one failure moves it only a little; project beats global', () => {
  const now = new Date('2026-11-17T00:00:00Z'); const q = { provider: 'claude', model: 'sonnet', taskType: 'ROUTINE_IMPLEMENTATION' };
  const mk = (n, acc, o = {}) => Array.from({ length: n }, () => rec({ accepted: acc, ...o }));
  assert.equal(competency(mk(9, true), q, now).score, null); assert.equal(competency(mk(9, true), q, now).basis, 'TOO_FEW_OBSERVATIONS');
  const all = competency(mk(10, true), q, now); assert.equal(all.basis, 'GLOBAL'); assert.ok(all.score > 0.8);
  const oneBad = competency([...mk(9, true), ...mk(1, false)], q, now); assert.ok(all.score - oneBad.score < 0.12, 'one failure moves the score only a little');
  const oldFails = competency([...mk(10, false, { at: '2025-01-01T00:00:00Z' }), ...mk(10, true)], q, now); assert.ok(oldFails.score > 0.7, 'old failures count for little');
  const proj = competency([...mk(5, false, { project: 'abc' }), ...mk(10, true)], { ...q, project: 'abc' }, now); assert.equal(proj.basis, 'PROJECT'); assert.ok(proj.score < 0.5);
  assert.equal(competency(mk(20, true), { ...q, model: 'opus' }, now).score, null);
});
test('canary: promoted one stage at a time on evidence, demoted on repeated failure, owner override always wins, shares rise with trust', () => {
  const ok = (n) => Array(n).fill(true);
  assert.equal(nextStage({ current: 'NEW', results: ok(3) }).stage, 'PROVISIONAL'); assert.equal(nextStage({ current: 'NEW', results: ok(2) }).change, 'NONE');
  assert.equal(nextStage({ current: 'PROVISIONAL', results: ok(5) }).stage, 'CANARY'); assert.equal(nextStage({ current: 'CANARY', results: ok(25) }).stage, 'VALIDATED'); // one step even with plenty of evidence
  assert.equal(nextStage({ current: 'VALIDATED', results: ok(20) }).stage, 'TRUSTED'); assert.equal(nextStage({ current: 'TRUSTED', results: ok(50) }).change, 'NONE');
  assert.equal(nextStage({ current: 'VALIDATED', results: [...ok(10), false, false, true, false, true] }).stage, 'CANARY'); assert.equal(nextStage({ current: 'NEW', results: [false, false, false, false, false] }).stage, 'NEW');
  assert.equal(nextStage({ current: 'NEW', results: [], userOverride: 'TRUSTED' }).stage, 'TRUSTED'); assert.equal(nextStage({ current: 'TRUSTED', results: [false, false, false, false, false], userOverride: 'TRUSTED' }).stage, 'TRUSTED');
  assert.throws(() => nextStage({ current: 'WEIRD', results: [] }), RangeError); assert.throws(() => nextStage({ current: 'NEW', results: ['x'] }), RangeError); assert.throws(() => nextStage({ current: 'NEW', results: [], userOverride: 'X' }), RangeError);
  const shares = STAGES.map((s) => SAMPLE_SHARE[s]); assert.deepEqual([...shares].sort((a, b) => a - b), shares);
});
test('health: unknown with few signals; down, brownout, degraded and healthy from simple rules', () => {
  const s = (n, o) => Array.from({ length: n }, () => ({ latencyMs: 1000, ...o }));
  assert.equal(healthState(s(3, {})).state, 'UNKNOWN'); assert.equal(healthState(s(10, {})).state, 'HEALTHY');
  assert.equal(healthState(s(10, { error: true })).state, 'DOWN'); assert.equal(healthState([...s(8, {}), ...s(2, { error: true })]).state, 'BROWNOUT'); assert.equal(healthState([...s(8, {}), ...s(2, { dropped: true })]).state, 'BROWNOUT');
  assert.equal(healthState(s(10, { latencyMs: 5000 }), { baselineLatencyMs: 1000 }).state, 'DEGRADED'); assert.equal(healthState(s(10, { latencyMs: 5000 })).state, 'HEALTHY'); // no baseline: no judgement on speed
  assert.throws(() => healthState('x'), RangeError); assert.throws(() => healthState([null]), RangeError);
});
