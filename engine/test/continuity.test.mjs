import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { createSnapshot, restoreSnapshot, listSnapshots, pruneSnapshots, SecretFound, SnapshotConflict } from '../lib/snapshot.mjs';
import * as lease from '../lib/lease.mjs';
import { Conflict } from '../lib/plan.mjs';
import { ladder, fallback, takeoverPlan } from '../lib/fallback.mjs';

const g = (cwd, ...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd, stdio: 'pipe', encoding: 'utf8' });
function repo() { const d = mkdtempSync(join(tmpdir(), 'dt-c-')); g(d, 'init', '-q'); writeFileSync(join(d, 'tracked.txt'), 'one\n'); writeFileSync(join(d, 'gone.txt'), 'bye\n'); g(d, 'add', '.'); g(d, 'commit', '-q', '-m', 'init'); return d; }
const dirty = (d) => { writeFileSync(join(d, 'tracked.txt'), 'two\n'); writeFileSync(join(d, 'untracked.txt'), 'new\n'); mkdirSync(join(d, 'newdir')); writeFileSync(join(d, 'newdir', 'f.txt'), 'deep\n'); rmSync(join(d, 'gone.txt')); };
const J = { job: 'j-aaaaaaaaaaaa', phase: 'build' };

test('snapshot: captures modified, untracked, new-directory and deleted files, and leaves the folder and the real index alone', () => {
  const d = repo(); dirty(d); const before = g(d, 'status', '--porcelain'); const idxBefore = g(d, 'diff', '--cached', '--name-only');
  const s = createSnapshot(d, J);
  assert.match(s.snapshotRef, /^refs\/dev-team\/snapshots\/j-aaaaaaaaaaaa\/build\/1$/);
  assert.equal(g(d, 'status', '--porcelain'), before); assert.equal(g(d, 'diff', '--cached', '--name-only'), idxBefore);
  const files = g(d, 'ls-tree', '-r', '--name-only', s.snapshotRef).split('\n');
  assert.ok(files.includes('untracked.txt') && files.includes('newdir/f.txt') && files.includes('tracked.txt') && !files.includes('gone.txt'));
  assert.equal(g(d, 'rev-parse', `${s.snapshotRef}^`).trim(), g(d, 'rev-parse', 'HEAD').trim());
  assert.equal(listSnapshots(d, J.job).length, 1);
});
test('snapshot: after the work is wiped (the crash-cleanup reset) restore brings everything back, unstaged', () => {
  const d = repo(); dirty(d); const s = createSnapshot(d, J);
  g(d, 'reset', '--hard', '-q'); g(d, 'clean', '-fdq');
  assert.equal(readFileSync(join(d, 'tracked.txt'), 'utf8'), 'one\n'); assert.ok(!existsSync(join(d, 'untracked.txt')));
  const r = restoreSnapshot(d, s.snapshotRef);
  assert.equal(readFileSync(join(d, 'tracked.txt'), 'utf8'), 'two\n'); assert.equal(readFileSync(join(d, 'untracked.txt'), 'utf8'), 'new\n'); assert.equal(readFileSync(join(d, 'newdir', 'f.txt'), 'utf8'), 'deep\n');
  assert.ok(!existsSync(join(d, 'gone.txt'))); assert.equal(r.deletedFiles, 1); assert.equal(g(d, 'diff', '--cached', '--name-only'), '');
});
test('snapshot: a clean tree gives CLEAN_TREE and no ref; a planted secret refuses, writes no ref and touches nothing; names are checked', () => {
  const d = repo(); assert.deepEqual(createSnapshot(d, J), { snapshotRef: null, sha: null, reason: 'CLEAN_TREE' });
  writeFileSync(join(d, 'config.txt'), 'key = sk_live_abcdefgh12345678\n'); writeFileSync(join(d, 'other.txt'), 'fine\n');
  let err; try { createSnapshot(d, J); } catch (e) { err = e; }
  assert.ok(err instanceof SecretFound); assert.deepEqual(err.files, ['config.txt']); assert.ok(!err.message.includes('sk_live'));
  assert.equal(listSnapshots(d, J.job).length, 0); assert.equal(readFileSync(join(d, 'other.txt'), 'utf8'), 'fine\n');
  for (const bad of [{ job: '../x', phase: 'p' }, { job: 'j', phase: 'a b' }, { job: '.hidden', phase: 'p' }]) assert.throws(() => createSnapshot(d, bad), RangeError);
});
test('snapshot: restore refuses when HEAD has moved, or the reference is not a snapshot; prune removes a job\'s refs; numbering increases', () => {
  const d = repo(); dirty(d); const s1 = createSnapshot(d, J); const s2 = createSnapshot(d, J); assert.match(s2.snapshotRef, /\/2$/);
  g(d, 'add', '.'); g(d, 'commit', '-q', '-m', 'moved');
  assert.throws(() => restoreSnapshot(d, s1.snapshotRef), SnapshotConflict); assert.throws(() => restoreSnapshot(d, 'refs/heads/main'), RangeError); assert.throws(() => restoreSnapshot(d, 'refs/dev-team/snapshots/../x'), RangeError);
  assert.deepEqual(pruneSnapshots(d, J.job), { removed: 2 }); assert.equal(listSnapshots(d, J.job).length, 0);
});

const A = { provider: 'claude', model: 'opus', runtime: 'claude-code', role: 'builder' };
const base = () => mkdtempSync(join(tmpdir(), 'dt-lease-'));
const t0 = new Date('2026-11-17T10:00:00Z'), min = (n) => new Date(t0.getTime() + n * 60000);

test('lease: one owner at a time; heartbeat; release; only the owner can release', () => {
  const b = base(); lease.acquire(b, { ...J, owner: A }, t0);
  assert.throws(() => lease.acquire(b, { ...J, owner: { ...A, model: 'sonnet' } }, min(5)), /live owner/);
  lease.heartbeat(b, { ...J, owner: A }, min(10)); assert.equal(lease.status(b, J, min(10)).heartbeatAgeMinutes, 0);
  assert.throws(() => lease.heartbeat(b, { ...J, owner: { ...A, role: 'reviewer' } }), Conflict); assert.throws(() => lease.release(b, { ...J, owner: { ...A, role: 'reviewer' } }), Conflict);
  assert.deepEqual(lease.release(b, { ...J, owner: A }), { released: true }); assert.equal(lease.status(b, J).held, false);
  assert.throws(() => lease.acquire(b, { job: '../x', phase: 'p', owner: A }), RangeError); assert.throws(() => lease.acquire(b, { ...J, owner: { provider: 'x' } }), RangeError);
});
test('lease: paused is not crashed - waits for the same owner; pause only with a known reset within 12 hours; others cannot resume', () => {
  const b = base(); lease.acquire(b, { ...J, owner: A }, t0);
  const obs = (h) => ({ provider: 'claude', resetAt: new Date(t0.getTime() + h * 3600000).toISOString() });
  assert.throws(() => lease.pause(b, { ...J, owner: A, observation: obs(13) }, t0), /cannot pause/); assert.throws(() => lease.pause(b, { ...J, owner: A, observation: { resetAt: null } }, t0), /cannot pause/);
  for (const h of [1 / 6, 2, 11.98]) { lease.pause(b, { ...J, owner: A, observation: obs(h), snapshotRef: null }, t0); assert.equal(lease.status(b, J, t0).state, 'paused'); lease.resume(b, { ...J, owner: A }, t0); }
  lease.pause(b, { ...J, owner: A, observation: obs(2), snapshotRef: 'refs/dev-team/snapshots/j-aaaaaaaaaaaa/build/1' }, t0);
  // a week later the heartbeat is ancient, but a paused lease is never treated as stale or reclaimed
  const later = new Date(t0.getTime() + 7 * 86400000);
  assert.equal(lease.status(b, J, later).stale, false); assert.throws(() => lease.acquire(b, { ...J, owner: A }, later), /paused, not crashed/);
  assert.throws(() => lease.reclaim(b, { ...J, owner: A, snapshotRef: null }, later), /never reclaimed/);
  assert.throws(() => lease.resume(b, { ...J, owner: { ...A, model: 'sonnet' } }, later), /only the agent that paused/);
  const r = lease.resume(b, { ...J, owner: A }, later); assert.equal(r.state, 'running'); assert.equal(r.resumedFrom.snapshotRef, 'refs/dev-team/snapshots/j-aaaaaaaaaaaa/build/1');
  assert.throws(() => lease.resume(b, { ...J, owner: A }, later), /not paused/);
});
test('reclaim after a crash keeps the work: stale lease + dirty tree with an untracked file -> snapshot first, then reset', () => {
  const d = repo(), b = base(); lease.acquire(b, { ...J, owner: A }, t0);
  dirty(d);
  const later = min(200);
  assert.throws(() => lease.acquire(b, { ...J, owner: A }, later), /STALE_LOCK/);
  assert.throws(() => lease.reclaim(b, { ...J, owner: A, snapshotRef: null }, min(10)), /not stale/);
  const snap = createSnapshot(d, { ...J, reason: 'reclaim' });
  const files = g(d, 'ls-tree', '-r', '--name-only', snap.snapshotRef).split('\n'); assert.ok(files.includes('untracked.txt'));
  const fresh = lease.reclaim(b, { ...J, owner: { ...A, model: 'sonnet' }, snapshotRef: snap.snapshotRef }, later); assert.equal(fresh.reclaimSnapshot, snap.snapshotRef);
  g(d, 'reset', '--hard', '-q'); g(d, 'clean', '-fdq'); assert.ok(!existsSync(join(d, 'untracked.txt')));
  restoreSnapshot(d, snap.snapshotRef); assert.equal(readFileSync(join(d, 'untracked.txt'), 'utf8'), 'new\n');
});
test('lease: two processes racing for one phase - exactly one wins', async () => {
  const b = base();
  const run = () => new Promise((res) => { const c = spawn(process.execPath, ['--input-type=module', '-e', `import * as l from ${JSON.stringify(new URL('../lib/lease.mjs', import.meta.url).href)};
    try { l.acquire(${JSON.stringify(b)}, { job: 'j-aaaaaaaaaaaa', phase: 'race', owner: { provider: 'p', model: 'm', runtime: 'r', role: 'x' } }); process.exit(0); } catch { process.exit(7); }`]); c.on('close', res); });
  const codes = await Promise.all(Array.from({ length: 6 }, run)); assert.equal(codes.filter((c) => c === 0).length, 1);
});

const M = [
  { provider: 'claude', id: 'sonnet', tier: 2, costBand: 3 }, { provider: 'claude', id: 'opus', tier: 3, costBand: 5 }, { provider: 'claude', id: 'fable', tier: 4, costBand: 10 },
  { provider: 'codex', id: 'gpt-x', tier: 3, costBand: 4 }, { provider: 'codex', id: 'gpt-small', tier: 2, costBand: 2 },
];
test('fallback: same provider equal-or-stronger first, then another provider; never weaker; records the preferred model', () => {
  const l = ladder(M, { provider: 'claude', id: 'opus', tier: 3 }); assert.deepEqual(l.map((x) => x.id), ['fable', 'gpt-x']); assert.deepEqual(l.map((x) => x.rung), ['SAME_PROVIDER', 'OTHER_PROVIDER']);
  const f = fallback(M, { provider: 'claude', id: 'opus', tier: 3 }, ['fable']); assert.equal(f.next.id, 'gpt-x'); assert.equal(f.preferred, 'opus');
  assert.equal(fallback(M, { provider: 'claude', id: 'fable', tier: 4 }).next, null);
});
test('takeover: retirement always replaces and strengthens review; a long wait only when the owner turned the switch on', () => {
  const failed = { provider: 'claude', id: 'opus', tier: 3 };
  for (const reason of ['RETIRED', 'REMOVED', 'ACCESS_REVOKED', 'UNRECOVERABLE']) { const t = takeoverPlan({ enabled: false, reason, models: M, failed }); assert.equal(t.takeover, true); assert.equal(t.reviewStrengthening, 'FULL_CATCH_UP'); assert.equal(t.event, 'MID_PHASE_TAKEOVER_OCCURRED'); }
  assert.equal(takeoverPlan({ enabled: false, reason: 'QUOTA', models: M, failed }).takeover, false);
  const on = takeoverPlan({ enabled: true, reason: 'QUOTA', models: M, failed }); assert.equal(on.takeover, true); assert.equal(on.next.id, 'fable');
  assert.equal(takeoverPlan({ enabled: true, reason: 'QUOTA', models: [], failed }).state, 'BLOCKED_AWAITING_AGENT');
});
