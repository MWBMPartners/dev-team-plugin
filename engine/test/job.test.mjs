import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { initJob, loadJob, recordPhase, createCheckpoint, verifyCheckpoints, progressRows, JobProblem } from '../lib/job.mjs';

const g = (cwd, ...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd, stdio: 'pipe', encoding: 'utf8' });
// The job file lives in .dev-team/, which this test keeps out of git so resetting history cannot remove it.
const repo = () => { const d = mkdtempSync(join(tmpdir(), 'dt-job-')); g(d, 'init', '-q'); writeFileSync(join(d, '.git', 'info', 'exclude'), '.dev-team/\n'); writeFileSync(join(d, 'a'), '1'); g(d, 'add', '.'); g(d, 'commit', '-q', '-m', 'one'); return d; };

test('a job starts from a template, is saved with the ownership marker on line 2, and reads back', () => {
  const d = repo(); const j = initJob(d, { template: 'normal', request: 'Add a login page', issue: 12 });
  assert.match(j.jobId, /^j-[0-9a-f]{12}$/); assert.equal(j.phases.length, 4); assert.ok(j.phases.every((p) => p.status === 'PENDING'));
  assert.match(readFileSync(join(d, '.dev-team', 'jobs', j.jobId, 'job.json'), 'utf8').split('\n')[1], /"dev-team": "ledger=job schema=1.0"/);
  assert.equal(loadJob(d, j.jobId).request, 'Add a login page');
  assert.throws(() => initJob(d, { template: 'nope', request: 'x' }), RangeError); assert.throws(() => initJob(d, { template: 'normal', request: ' ' }), RangeError);
  assert.throws(() => initJob(d, { template: 'normal', request: 'x', issue: NaN }), RangeError);
});
test('phases only move along allowed steps, and ids can never be paths', () => {
  const d = repo(); const j = initJob(d, { template: 'small-task', request: 'x' });
  assert.throws(() => recordPhase(d, j.jobId, 'build', 'DONE'), JobProblem);
  recordPhase(d, j.jobId, 'build', 'IN_PROGRESS'); recordPhase(d, j.jobId, 'build', 'BLOCKED', 'waiting for a key'); recordPhase(d, j.jobId, 'build', 'IN_PROGRESS'); recordPhase(d, j.jobId, 'build', 'DONE');
  assert.throws(() => recordPhase(d, j.jobId, 'build', 'IN_PROGRESS'), JobProblem);
  assert.throws(() => recordPhase(d, j.jobId, 'nope', 'IN_PROGRESS'), JobProblem); assert.throws(() => recordPhase(d, j.jobId, 'verify', 'MAYBE'), RangeError);
  assert.throws(() => recordPhase(d, j.jobId, 'verify', 'IN_PROGRESS', 'bad\u0007note'), RangeError);
  assert.throws(() => loadJob(d, '../../etc/passwd'), RangeError); assert.throws(() => loadJob(d, 'j-000000000000'), JobProblem);
  assert.equal(progressRows(loadJob(d, j.jobId))[0].status, 'DONE');
});
test('a file that is not ours is never overwritten, and a damaged job is reported', () => {
  const d = repo(); const j = initJob(d, { template: 'normal', request: 'x' });
  const p = join(d, '.dev-team', 'jobs', j.jobId, 'job.json'); writeFileSync(p, '{"mine":true}');
  assert.throws(() => recordPhase(d, j.jobId, 'discover', 'IN_PROGRESS'), JobProblem); assert.equal(readFileSync(p, 'utf8'), '{"mine":true}');
});
test('checkpoints are tied to commits: verify passes, then fails when the commit is gone', () => {
  const d = repo(); const j = initJob(d, { template: 'normal', request: 'x' });
  writeFileSync(join(d, 'b'), '2'); const cp = createCheckpoint(d, j.jobId, 'plan', 'planning'); assert.equal(cp.uncommittedChanges, true);
  assert.equal(verifyCheckpoints(d, j.jobId).ok, true);
  g(d, 'add', '.'); g(d, 'commit', '-q', '-m', 'two'); const cp2 = createCheckpoint(d, j.jobId, 'build', 'build'); assert.equal(cp2.uncommittedChanges, false);
  g(d, 'reset', '-q', '--hard', 'HEAD~1'); g(d, 'reflog', 'expire', '--expire=now', '--all'); g(d, 'gc', '-q', '--prune=now');
  const v = verifyCheckpoints(d, j.jobId); assert.equal(v.ok, false); assert.equal(v.results.filter((r) => !r.ok).length, 1);
  assert.throws(() => createCheckpoint(d, j.jobId, 'plan', 'weird'), RangeError); assert.throws(() => createCheckpoint(d, j.jobId, 'nope', 'build'), JobProblem);
  const empty = mkdtempSync(join(tmpdir(), 'dt-nogit-')); const j2 = initJob(empty, { template: 'small-task', request: 'x' });
  assert.throws(() => createCheckpoint(empty, j2.jobId, 'build', 'build'), JobProblem);
});

// ---- Fixes after the independent review of jobs ----
test('secrets in a request or note are refused as bad input; damaged job files are reported, not crashed on', () => {
  const d = repo();
  assert.throws(() => initJob(d, { template: 'normal', request: 'key sk-ant-api03-AAAAAAAAAAAAAAAAAAAAAAAA' }), RangeError);
  const j = initJob(d, { template: 'normal', request: 'x' });
  assert.throws(() => recordPhase(d, j.jobId, 'discover', 'IN_PROGRESS', 'ghp_' + 'a'.repeat(30)), RangeError);
  const p = join(d, '.dev-team', 'jobs', j.jobId, 'job.json'); const good = JSON.parse(readFileSync(p, 'utf8'));
  for (const bad of [{ phases: [null] }, { phases: [1, 2] }, { checkpoints: [null] }, { checkpoints: [{ id: 'c', phase: 'plan', commit: 'HEAD', uncommittedChanges: false }] }, { phases: [good.phases[0], good.phases[0]] }]) {
    writeFileSync(p, JSON.stringify({ ...good, ...bad })); assert.throws(() => loadJob(d, j.jobId), JobProblem);
  }
});
test('a repository with many untracked files still gets a checkpoint, and uncommitted work is noticed', () => {
  const d = repo(); const j = initJob(d, { template: 'normal', request: 'x' });
  mkdirSync(join(d, 'junk')); for (let i = 0; i < 50; i++) writeFileSync(join(d, 'junk', `f${i}`), 'x');
  assert.equal(createCheckpoint(d, j.jobId, 'plan', 'planning').uncommittedChanges, true);
});

// ---- Fixes after the second review of jobs ----
test('a clean repository gives a clean checkpoint even though the job file itself changes; a real uncommitted file does not', () => {
  const d = repo(); const j = initJob(d, { template: 'normal', request: 'x' });
  assert.equal(createCheckpoint(d, j.jobId, 'plan', 'planning').uncommittedChanges, false);
  recordPhase(d, j.jobId, 'discover', 'IN_PROGRESS'); assert.equal(createCheckpoint(d, j.jobId, 'plan', 'planning').uncommittedChanges, false);
  writeFileSync(join(d, 'new.txt'), 'x'); assert.equal(createCheckpoint(d, j.jobId, 'plan', 'planning').uncommittedChanges, true);
});
test('parallel edits to one job do not lose each other', async () => {
  const { spawn } = await import('node:child_process');
  const d = repo(); const j = initJob(d, { template: 'normal', request: 'x' });
  const run = () => new Promise((res) => { const c = spawn(process.execPath, ['engine/bin/dev-team-engine.mjs', 'checkpoint', 'create', '--job', j.jobId, '--phase', 'plan', '--kind', 'planning', '--project', d], { cwd: process.cwd(), env: { ...process.env, DEV_TEAM_DATA_DIR_RESOLVED: d } }); c.on('close', res); });
  await Promise.all(Array.from({ length: 6 }, run));
  assert.equal(loadJob(d, j.jobId).checkpoints.length, 6);
});
test('uncommitted work inside a submodule is noticed', () => {
  const d = repo(); const sub = repo();
  g(d, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', sub, 'sub'); g(d, 'commit', '-q', '-m', 'add sub');
  const j = initJob(d, { template: 'normal', request: 'x' });
  assert.equal(createCheckpoint(d, j.jobId, 'plan', 'planning').uncommittedChanges, false);
  writeFileSync(join(d, 'sub', 'newfile'), 'x'); assert.equal(createCheckpoint(d, j.jobId, 'plan', 'planning').uncommittedChanges, true);
});

// ---- Fixes after the third review of jobs ----
test('a stale lock that cannot be deleted never makes the command spin forever', async () => {
  const { utimesSync } = await import('node:fs');
  const d = repo(); const j = initJob(d, { template: 'normal', request: 'x' });
  const lock = join(d, '.dev-team', 'jobs', j.jobId, '.lock'); mkdirSync(lock); writeFileSync(join(lock, 'keep'), 'x');
  const old = new Date(Date.now() - 120000); utimesSync(lock, old, old);
  const t0 = Date.now(); recordPhase(d, j.jobId, 'discover', 'IN_PROGRESS'); // a stale, non-empty lock is moved aside and removed
  assert.ok(Date.now() - t0 < 5000); assert.equal(loadJob(d, j.jobId).phases[0].status, 'IN_PROGRESS');
});
test('a plain file named .lock that is fresh stops the command with a clear message after the wait, not a hang', () => {
  const d = repo(); const j = initJob(d, { template: 'normal', request: 'x' });
  writeFileSync(join(d, '.dev-team', 'jobs', j.jobId, '.lock'), 'x');
  const t0 = Date.now(); assert.throws(() => recordPhase(d, j.jobId, 'discover', 'IN_PROGRESS'), JobProblem); assert.ok(Date.now() - t0 < 12000);
});
test('uncommitted work outside the project folder, in the same repository, is noticed', () => {
  const d = repo(); mkdirSync(join(d, 'app')); writeFileSync(join(d, 'app', 'x'), '1'); g(d, 'add', '.'); g(d, 'commit', '-q', '-m', 'app');
  const j = initJob(join(d, 'app'), { template: 'normal', request: 'x' });
  writeFileSync(join(d, '.git', 'info', 'exclude'), '.dev-team/\n');
  assert.equal(createCheckpoint(join(d, 'app'), j.jobId, 'plan', 'planning').uncommittedChanges, false);
  writeFileSync(join(d, 'outside.txt'), 'x'); assert.equal(createCheckpoint(join(d, 'app'), j.jobId, 'plan', 'planning').uncommittedChanges, true);
});
