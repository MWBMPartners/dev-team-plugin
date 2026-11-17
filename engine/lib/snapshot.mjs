// @ts-check
// File:    engine/lib/snapshot.mjs
// Purpose: Saves a copy of the work in progress as a hidden git commit, including files git does not track yet, so
//          pausing (or cleaning up after a crash) can never lose work. The copy is built with a temporary index, so
//          the working folder and the real index are not touched. It lives under refs/dev-team/, which is outside
//          branches and tags, so `git push` never sends it. Before anything is written the content is scanned for
//          secrets: a hit stops the snapshot, writes nothing, and names the file (never its content).
import { execFileSync } from 'node:child_process';
import { readFileSync, copyFileSync, existsSync, mkdtempSync, rmSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { looksLikeCredential } from './redact.mjs';

/** A secret-shaped value was found in a file that would be snapshotted. */
export class SecretFound extends Error { /** @param {string[]} files */ constructor(files) { super(`a secret-like value was found in: ${files.join(', ')}`); this.files = files; } }
/** The snapshot cannot be used in the current state (for example HEAD has moved). */
export class SnapshotConflict extends Error {}

/** The tree git would record for the folder as it is now, built in a temporary index (the real index is not touched). */
function workingTree(top, extraEnv = {}) {
  const tmpDir = mkdtempSync(join(tmpdir(), 'dt-tree-'));
  try {
    const idx = join(tmpDir, 'index'); const real = resolve(top, run(top, ['rev-parse', '--git-path', 'index']).trim());
    if (existsSync(real)) copyFileSync(real, idx);
    run(top, ['add', '-A'], { GIT_INDEX_FILE: idx, ...extraEnv });
    return run(top, ['write-tree'], { GIT_INDEX_FILE: idx }).trim();
  } finally { rmSync(tmpDir, { recursive: true, force: true }); }
}

const SAFE = /^[A-Za-z0-9._-]+$/;
const run = (cwd, args, env = {}) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024, env: { ...process.env, ...env } });
const check = (job, phase) => { for (const [n, v] of [['job', job], ['phase', phase]]) if (typeof v !== 'string' || !SAFE.test(v) || v.includes('..') || v.startsWith('.')) throw new RangeError(`${n} must be plain letters, numbers, dots, dashes or underscores`); };
const prefix = (job, phase) => `refs/dev-team/snapshots/${job}${phase ? `/${phase}` : ''}`;

/** Make a snapshot. Returns {snapshotRef, sha, reason}; a clean tree gives {snapshotRef: null, reason: 'CLEAN_TREE'}. */
export function createSnapshot(projectDir, { job, phase, reason = 'pause', maxFileBytes = 16 * 1024 * 1024 }) {
  check(job, phase);
  if (!['pause', 'reclaim'].includes(reason)) throw new RangeError('reason must be pause or reclaim');
  const top = run(projectDir, ['rev-parse', '--show-toplevel']).trim();
  let head; try { head = run(top, ['rev-parse', 'HEAD']).trim(); } catch { throw new SnapshotConflict('a snapshot needs a git repository with at least one commit'); }
  if (run(top, ['status', '--porcelain', '--untracked-files=all']).trim() === '') return { snapshotRef: null, sha: null, reason: 'CLEAN_TREE' };
  const tmpDir = mkdtempSync(join(tmpdir(), 'dt-snap-'));
  const idx = join(tmpDir, 'index');
  try {
    const real = resolve(top, run(top, ['rev-parse', '--git-path', 'index']).trim());
    if (existsSync(real)) copyFileSync(real, idx);
    const env = { GIT_INDEX_FILE: idx, GIT_AUTHOR_NAME: 'dev-team engine', GIT_AUTHOR_EMAIL: 'dev-team@localhost', GIT_COMMITTER_NAME: 'dev-team engine', GIT_COMMITTER_EMAIL: 'dev-team@localhost' };
    run(top, ['add', '-A'], env);
    // Scan what is about to be saved. Only the engine's own patterns are used here (weaker than a dedicated scanner).
    const changed = run(top, ['diff', '--cached', '--name-only', '-z', head], env).split('\0').filter(Boolean);
    const hits = [], unscanned = [];
    for (const f of changed) {
      const p = join(top, f);
      try { const st = statSync(p); if (!st.isFile()) continue; if (st.size > maxFileBytes) { unscanned.push(f); continue; } const buf = readFileSync(p); if (buf.includes(0)) { unscanned.push(f); continue; } if (looksLikeCredential(buf.toString('utf8'))) hits.push(f); } catch { /* deleted files have nothing to scan */ }
    }
    if (hits.length) throw new SecretFound(hits);
    const tree = run(top, ['write-tree'], env).trim();
    // The next number is one more than the HIGHEST that exists (counting would reuse a number after a deletion).
    const n = Math.max(0, ...run(top, ['for-each-ref', '--format=%(refname)', prefix(job, phase)]).split('\n').filter(Boolean).map((r) => Number(r.split('/').pop())).filter(Number.isInteger)) + 1;
    const sha = run(top, ['commit-tree', tree, '-p', head, '-m', `dev-team snapshot ${job}/${phase}/${n} (${reason})`], env).trim();
    const ref = `${prefix(job, phase)}/${n}`;
    run(top, ['update-ref', ref, sha, '']); // the empty old value means git refuses if the reference already exists
    return { snapshotRef: ref, sha, reason, scan: 'ENGINE_PATTERNS (weaker than a dedicated scanner)', unscanned };
  } finally { rmSync(tmpDir, { recursive: true, force: true }); }
}

/** Put a snapshot back. Refuses if HEAD is no longer the snapshot's parent. The restored files are left unstaged. */
export function restoreSnapshot(projectDir, ref) {
  if (typeof ref !== 'string' || !/^refs\/dev-team\/snapshots\/[A-Za-z0-9._\/-]+$/.test(ref) || ref.includes('..')) throw new RangeError('not a snapshot reference');
  const top = run(projectDir, ['rev-parse', '--show-toplevel']).trim();
  let sha; try { sha = run(top, ['rev-parse', '--verify', `${ref}^{commit}`]).trim(); } catch { throw new SnapshotConflict('that snapshot no longer exists'); }
  const parent = run(top, ['rev-parse', `${sha}^`]).trim(), head = run(top, ['rev-parse', 'HEAD']).trim();
  if (parent !== head) throw new SnapshotConflict('HEAD has moved since the snapshot was taken, so it cannot be restored safely');
  // Never overwrite newer work: restore only into a folder that is exactly HEAD (nothing to lose), and do nothing if it
  // is already exactly the snapshot.
  const snapTree = run(top, ['rev-parse', `${sha}^{tree}`]).trim();
  const nowTree = workingTree(top);
  if (nowTree === snapTree) return { restored: false, alreadyRestored: true, ref, deletedFiles: 0 };
  if (nowTree !== run(top, ['rev-parse', 'HEAD^{tree}']).trim()) throw new SnapshotConflict('the working folder has changes that are neither the committed state nor this snapshot; restoring would overwrite them. Save or discard them first');
  const deleted = run(top, ['diff', '--diff-filter=D', '--name-only', '-z', 'HEAD', sha]).split('\0').filter(Boolean);
  run(top, ['checkout', sha, '--', '.']);
  for (const f of deleted) { try { unlinkSync(join(top, f)); } catch { /* already gone */ } }
  run(top, ['reset', '-q']);
  return { restored: true, ref, deletedFiles: deleted.length };
}

export function listSnapshots(projectDir, job) {
  check(job, 'x');
  const top = run(projectDir, ['rev-parse', '--show-toplevel']).trim();
  return run(top, ['for-each-ref', '--format=%(refname) %(objectname) %(subject)', prefix(job)]).split('\n').filter(Boolean).map((l) => { const [ref, sha, ...rest] = l.split(' '); return { ref, sha, subject: rest.join(' ') }; });
}

/** Remove every snapshot of a job (when the job is complete). */
export function pruneSnapshots(projectDir, job) {
  const top = run(projectDir, ['rev-parse', '--show-toplevel']).trim();
  const refs = listSnapshots(projectDir, job);
  for (const r of refs) run(top, ['update-ref', '-d', r.ref]);
  return { removed: refs.length };
}
