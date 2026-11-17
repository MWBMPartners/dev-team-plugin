import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pushPolicy, pushAfterTaskSetting } from '../lib/pushpolicy.mjs';

const proj = (yaml) => { const d = mkdtempSync(join(tmpdir(), 'dt-push-')); if (yaml !== null) { mkdirSync(join(d, '.dev-team')); writeFileSync(join(d, '.dev-team', 'config.yml'), yaml); } return d; };
const ok = { checkerCleared: true, confident: true, deterministicPass: true };
test('off by default and for anything that is not a clear on', () => {
  for (const y of [null, '', 'git:\n  push-after-task: off\n', 'git:\n  push-after-task: maybe\n', 'git:\n  push-after-task: on\n  push-after-task: off\n', 'git:\n  push-after-task: [on]\n']) assert.equal(pushPolicy({ projectDir: proj(y), branch: 'autopilot/x', ...ok }).allowed, false, String(y));
});
test('on: only the run branch, only a cleared commit, only with confidence and a passing deterministic check; never the default branch or a force', () => {
  const d = proj('git:\n  push-after-task: on\n');
  assert.equal(pushPolicy({ projectDir: d, branch: 'autopilot/x', ...ok }).allowed, true);
  for (const b of ['main', 'MASTER', 'trunk']) assert.equal(pushPolicy({ projectDir: d, branch: b, defaultBranch: 'trunk', ...ok }).allowed, false, b);
  assert.equal(pushPolicy({ projectDir: d, branch: 'autopilot/x', ...ok, force: true }).allowed, false);
  assert.equal(pushPolicy({ projectDir: d, branch: 'autopilot/x', ...ok, checkerCleared: false }).allowed, false);
  assert.equal(pushPolicy({ projectDir: d, branch: 'autopilot/x', checkerCleared: true, confident: true }).allowed, false); assert.equal(pushPolicy({ projectDir: d, branch: 'autopilot/x', checkerCleared: true, deterministicPass: true }).allowed, false);
  assert.equal(pushPolicy({ projectDir: d, branch: 'refs/heads/main', ...ok }).allowed, false);
});
test('odd branch names are refused as bad input', () => {
  const d = proj('git:\n  push-after-task: on\n');
  for (const b of ['', '-f', 'a b', 'a..b', 'a:b', 'x~1']) assert.throws(() => pushPolicy({ projectDir: d, branch: b, ...ok }), RangeError, b);
  assert.equal(pushAfterTaskSetting(d).on, true);
});
