// @ts-check
// File:    engine/lib/job.mjs
// Purpose: A job is one piece of requested work with its phases, its state and its checkpoints, saved as a
//          file in the project's .dev-team/jobs/<id>/ folder so any machine, assistant or model can resume it.
//          Checkpoints are tied to git commits, so "where were we" is checkable, not remembered.
import { readFileSync, existsSync, mkdirSync, rmdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pluginRoot } from './paths.mjs';
import { readMarked, writeMarked } from './store.mjs';
import { looksLikeCredential } from './redact.mjs';

const JOB_ID = /^j-[0-9a-f]{12}$/;
const PHASE_STATUS = ['PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED'];
const NEXT = { PENDING: ['IN_PROGRESS'], IN_PROGRESS: ['DONE', 'BLOCKED'], BLOCKED: ['IN_PROGRESS'], DONE: [] };
export const CHECKPOINT_KINDS = ['planning', 'build', 'verify', 'handover'];

const jobPath = (projectDir, id) => join(projectDir, '.dev-team', 'jobs', id, 'job.json');
const templates = () => JSON.parse(readFileSync(join(pluginRoot(), 'engine', 'data', 'job-templates.json'), 'utf8')).templates;

/** Error for a job that does not exist or cannot be read (the command reports it as a conflict, exit 4). */
export class JobProblem extends Error {}

/** Start a job from a template. `now` is replaceable for tests. */
export function initJob(projectDir, { template, request, issue = null }, now = new Date()) {
  const t = templates();
  if (typeof template !== 'string' || !Object.hasOwn(t, template)) throw new RangeError(`template must be one of ${Object.keys(t).join(', ')}`);
  if (typeof request !== 'string' || request.trim() === '' || request.length > 2000) throw new RangeError('request must be plain text of at most 2000 characters');
  // The job file is committed with the project, so a pasted key must never reach it.
  if (looksLikeCredential(request)) throw new RangeError('the request looks like it contains a secret (a key or password); describe the work without pasting the secret');
  if (issue !== null && (!Number.isInteger(issue) || issue < 1)) throw new RangeError('issue must be a whole number');
  const id = `j-${randomBytes(6).toString('hex')}`;
  const job = { jobId: id, createdAt: now.toISOString(), template, request: request.trim(), issue, phases: t[template].map((p) => ({ ...p, status: 'PENDING', note: '' })), checkpoints: [] };
  writeMarked(jobPath(projectDir, id), 'job', job);
  return job;
}

export function loadJob(projectDir, id) {
  if (!JOB_ID.test(String(id))) throw new RangeError('a job id looks like j-0123456789ab');
  const r = readMarked(jobPath(projectDir, id), 'job');
  if (r.status === 'absent') throw new JobProblem(`no job ${id} in this project`);
  if (r.status !== 'ours') throw new JobProblem(`the job file for ${id} is not a readable dev-team job`);
  const j = r.value;
  const okPhase = (p) => p && typeof p === 'object' && typeof p.id === 'string' && p.id !== '' && PHASE_STATUS.includes(p.status) && typeof p.name === 'string' && typeof p.role === 'string' && typeof p.note === 'string';
  const okCp = (c) => c && typeof c === 'object' && typeof c.id === 'string' && typeof c.phase === 'string' && typeof c.commit === 'string' && /^[0-9a-f]{40}([0-9a-f]{24})?$/.test(c.commit) && typeof c.uncommittedChanges === 'boolean';
  if (!j || !Array.isArray(j.phases) || !Array.isArray(j.checkpoints) || j.jobId !== id || !j.phases.every(okPhase) || !j.checkpoints.every(okCp) || new Set(j.phases.map((p) => p.id)).size !== j.phases.length) throw new JobProblem(`the job file for ${id} is damaged`);
  return j;
}

/** Move one phase to a new status, only along the allowed steps. */
export function recordPhase(projectDir, id, phaseId, status, note = '') {
  if (!PHASE_STATUS.includes(status)) throw new RangeError(`status must be one of ${PHASE_STATUS.join(', ')}`);
  if (typeof note !== 'string' || note.length > 500 || /[\x00-\x08\x0b-\x1f\x7f]/.test(note)) throw new RangeError('note must be plain text of at most 500 characters');
  if (looksLikeCredential(note)) throw new RangeError('the note looks like it contains a secret; leave it out');
  loadJob(projectDir, id); // fail early, before taking the lock, if there is no such job
  return withLock(projectDir, id, () => {
    const job = loadJob(projectDir, id);
    const ph = job.phases.find((p) => p.id === phaseId);
    if (!ph) throw new JobProblem(`job ${id} has no phase "${String(phaseId).slice(0, 30)}"`);
    if (!NEXT[ph.status]?.includes(status)) throw new JobProblem(`phase ${ph.id} cannot go from ${ph.status} to ${status}`);
    ph.status = status; ph.note = note;
    writeMarked(jobPath(projectDir, id), 'job', job);
    return job;
  });
}

/**
 * Run `fn` while holding a lock on a job, so two commands editing one job cannot lose each other's changes.
 * The lock is a folder made with an exclusive mkdir; one older than 30 seconds is taken as left behind by a crash.
 */
function withLock(projectDir, id, fn) {
  const lock = join(projectDir, '.dev-team', 'jobs', id, '.lock');
  const deadline = Date.now() + 8000;
  for (;;) {
    try { mkdirSync(lock); break; } catch (e) {
      if (/** @type {any} */ (e).code !== 'EEXIST') throw new JobProblem('the job folder cannot be locked');
      try { if (Date.now() - statSync(lock).mtimeMs > 30000) { rmdirSync(lock); continue; } } catch { continue; }
      if (Date.now() > deadline) throw new JobProblem('another command is changing this job; try again');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  }
  try { return fn(); } finally { try { rmdirSync(lock); } catch { /* already gone */ } }
}

const git = (dir, args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }).trim();

/**
 * Is anything uncommitted? Changes to tracked files, untracked files (the job's own folder under .dev-team/jobs
 * is not counted, since it changes on every record), and, if there are submodules, work inside them.
 */
function hasUncommittedWork(dir) {
  const skip = ['--', '.', ':(exclude).dev-team/jobs'];
  try {
    if (git(dir, ['status', '--porcelain', '--untracked-files=no', ...skip]) !== '') return true;
    if (git(dir, ['ls-files', '--others', '--exclude-standard', ...skip]) !== '') return true;
    if (existsSync(join(dir, '.gitmodules')) && git(dir, ['submodule', 'foreach', '--quiet', '--recursive', 'git status --porcelain']) !== '') return true;
    return false;
  } catch { return true; } // when unsure, say there may be uncommitted work
}

/** Tie a checkpoint to the commit the project is at now. Needs a git repository with at least one commit. */
export function createCheckpoint(projectDir, id, phaseId, kind, now = new Date()) {
  if (!CHECKPOINT_KINDS.includes(kind)) throw new RangeError(`kind must be one of ${CHECKPOINT_KINDS.join(', ')}`);
  loadJob(projectDir, id);
  let commit, dirty;
  try { commit = git(projectDir, ['rev-parse', 'HEAD']); } catch { throw new JobProblem('a checkpoint needs a git repository with at least one commit'); }
  dirty = hasUncommittedWork(projectDir);
  const cp = { id: `c-${randomBytes(4).toString('hex')}`, phase: phaseId, kind, commit, uncommittedChanges: dirty, at: now.toISOString() };
  return withLock(projectDir, id, () => {
    const job = loadJob(projectDir, id);
    if (!job.phases.some((p) => p.id === phaseId)) throw new JobProblem(`job ${id} has no phase "${String(phaseId).slice(0, 30)}"`);
    job.checkpoints.push(cp);
    writeMarked(jobPath(projectDir, id), 'job', job);
    return cp;
  });
}

/** Does every checkpoint's commit still exist? A missing commit means history was rewritten or lost. */
export function verifyCheckpoints(projectDir, id) {
  const job = loadJob(projectDir, id);
  const results = job.checkpoints.map((c) => { let ok = true; try { git(projectDir, ['cat-file', '-e', `${c.commit}^{commit}`]); } catch { ok = false; } return { id: c.id, phase: c.phase, commit: c.commit, ok }; });
  return { ok: results.every((r) => r.ok), results };
}

/** The progress table: one row per phase with its status, checkpoints and note. */
export function progressRows(job) {
  return job.phases.map((p) => ({ phase: p.id, name: p.name, role: p.role, status: p.status, checkpoints: job.checkpoints.filter((c) => c.phase === p.id).length, note: p.note }));
}
export { existsSync };
