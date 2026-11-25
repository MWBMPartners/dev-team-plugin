// @ts-check
// File:    engine/lib/lease.mjs
// Purpose: A lease says "this agent owns this phase". It keeps a phase with the agent that started it, tells a
//          paused phase from a crashed one (a paused lease is never treated as crashed), and makes sure two processes
//          cannot both take a phase. The lock is a folder made with an exclusive mkdir, the same trick the autopilot
//          lock uses, with the holder's details in a small file inside it.
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { hostname } from 'node:os';
import { Conflict } from './plan.mjs';
import { pauseOrBlock } from './quota.mjs';

const SAFE = /^[A-Za-z0-9._-]+$/;
const STALE_AFTER_MIN = 90;
const OWNER_KEYS = ['provider', 'model', 'runtime', 'role'];

const dirOf = (base, job, phase) => { for (const v of [job, phase]) if (typeof v !== 'string' || !SAFE.test(v) || v.includes('..') || v.startsWith('.')) throw new RangeError('job and phase must be plain names'); return join(base, 'leases', `${job}.${phase}.lock`); };
export function checkOwner(o) {
  if (!o || typeof o !== 'object') throw new RangeError('owner must be an object');
  for (const k of OWNER_KEYS) if (typeof o[k] !== 'string' || o[k] === '' || o[k].length > 80) throw new RangeError(`owner.${k} must be short text`);
  if (o.session !== undefined && (typeof o.session !== 'string' || o.session.length > 120)) throw new RangeError('owner.session must be short text');
  return o;
}
const sameOwner = (a, b) => OWNER_KEYS.every((k) => a[k] === b[k]) && (a.session ?? null) === (b.session ?? null);
function readHolder(dir) { try { const h = JSON.parse(readFileSync(join(dir, 'holder.json'), 'utf8')); if (!h || typeof h !== 'object' || !h.owner || !['running', 'paused'].includes(h.state)) return null; return h; } catch { return null; } }
/** Minutes since the last heartbeat. A time in the future (clock trouble, a damaged file) counts as ancient, never as fresh. */
function ageMinutes(h, now) { const a = (now.getTime() - Date.parse(h.heartbeatAt)) / 60000; return Number.isFinite(a) && a >= -5 ? Math.max(0, a) : Infinity; }
const write = (dir, h) => { const tmp = join(dir, `holder.json.tmp-${process.pid}`); writeFileSync(tmp, JSON.stringify(h, null, 2) + '\n'); renameSync(tmp, join(dir, 'holder.json')); };

/** Take a phase. Fails (Conflict) if another live owner holds it, if it is paused, or if a stale lock needs a snapshot first. */
export function acquire(base, { job, phase, owner }, now = new Date()) {
  const dir = dirOf(base, job, phase); checkOwner(owner);
  mkdirSync(join(base, 'leases'), { recursive: true });
  try { mkdirSync(dir); } catch (e) {
    if (/** @type {any} */ (e).code !== 'EEXIST') throw e;
    const h = readHolder(dir);
    if (!h) throw new Conflict('the lease folder exists but its holder file cannot be read; look at it by hand');
    if (h.state === 'paused') throw new Conflict('this phase is paused, not crashed: resume it with the same owner');
    if (ageMinutes(h, now) < STALE_AFTER_MIN) throw new Conflict('this phase is held by a live owner');
    throw new Conflict('STALE_LOCK: the holder stopped sending heartbeats; take a work snapshot (snapshot create --reason reclaim) before reclaiming');
  }
  const h = { owner, pid: process.pid, host: hostname(), acquiredAt: now.toISOString(), heartbeatAt: now.toISOString(), state: 'running' };
  write(dir, h); return h;
}

/** Is another reclaim under way? A gate folder left by a crashed process is removed once it is two minutes old. */
const GATE_STALE_MS = 120000;
function gateBusy(dir) {
  const gate = `${dir}.reclaim`;
  if (!existsSync(gate)) return false;
  try {
    if (Date.now() - statSync(gate).mtimeMs > GATE_STALE_MS) {
      // Move it aside under a unique name first, so a racing process cannot delete a FRESH gate made in the meantime.
      const aside = `${gate}.old-${process.pid}-${Math.random().toString(16).slice(2)}`;
      try { renameSync(gate, aside); rmSync(aside, { recursive: true, force: true }); } catch { /* someone else removed it */ }
      return existsSync(gate);
    }
  } catch { return false; }
  return true;
}

/** Can this lease be reclaimed right now? Throws a Conflict saying why not. Call it BEFORE taking a snapshot. */
export function assertReclaimable(base, { job, phase }, now = new Date()) {
  const dir = dirOf(base, job, phase);
  if (gateBusy(dir)) throw new Conflict('another process is reclaiming this lease right now');
  const h = readHolder(dir);
  if (!h) throw new Conflict('there is no readable engine lease for this phase (if the run never took one, take a snapshot with `snapshot create --reason reclaim` and carry on)');
  if (h.state === 'paused') throw new Conflict('a paused lease is never reclaimed as crashed');
  if (ageMinutes(h, now) < STALE_AFTER_MIN) throw new Conflict('the lease is not stale');
  return h;
}

/** Take over a stale lease. The caller must already have made the reclaim snapshot and passes its reference. */
export function reclaim(base, { job, phase, owner, snapshotRef }, now = new Date()) {
  const dir = dirOf(base, job, phase); checkOwner(owner);
  // Two reclaimers at once: only the one that makes this folder first goes on; it is removed afterwards.
  const gate = `${dir}.reclaim`;
  if (gateBusy(dir)) throw new Conflict('another process is reclaiming this lease right now');
  try { mkdirSync(gate); } catch { throw new Conflict('another process is reclaiming this lease right now'); }
  try { return reclaimLocked(dir, owner, snapshotRef, now); } finally { rmSync(gate, { recursive: true, force: true }); }
}

function reclaimLocked(dir, owner, snapshotRef, now) {
  const h = readHolder(dir);
  if (!h) throw new Conflict('there is no readable lease to reclaim');
  if (h.state === 'paused') throw new Conflict('a paused lease is never reclaimed as crashed');
  if (snapshotRef !== null && (typeof snapshotRef !== 'string' || !snapshotRef.startsWith('refs/dev-team/snapshots/'))) throw new RangeError('snapshotRef must be a snapshot reference, or null for a clean tree');
  if (ageMinutes(h, now) < STALE_AFTER_MIN) throw new Conflict('the lease is not stale');
  const fresh = { owner, pid: process.pid, host: hostname(), acquiredAt: now.toISOString(), heartbeatAt: now.toISOString(), state: 'running', reclaimedFrom: h.owner, reclaimSnapshot: snapshotRef };
  write(dir, fresh); return fresh;
}

export function heartbeat(base, { job, phase, owner }, now = new Date()) {
  const dir = dirOf(base, job, phase); const h = readHolder(dir);
  if (!h || !sameOwner(h.owner, checkOwner(owner))) throw new Conflict('you do not hold this lease');
  h.heartbeatAt = now.toISOString(); write(dir, h); return h;
}

/** Pause for a quota reset. Legal only when the reset time is known and within the waiting limit. */
export function pause(base, { job, phase, owner, observation, snapshotRef = null, thresholdHours = 12 }, now = new Date()) {
  const dir = dirOf(base, job, phase); const h = readHolder(dir);
  if (!h || !sameOwner(h.owner, checkOwner(owner))) throw new Conflict('you do not hold this lease');
  const d = pauseOrBlock(observation, now, thresholdHours);
  if (d.action !== 'PAUSE') throw new Conflict(`cannot pause: ${d.reason}`);
  h.state = 'paused'; h.paused = { resetAt: d.resetAt, snapshotRef, pausedAt: now.toISOString(), provider: observation.provider ?? null };
  write(dir, h); return h;
}

/** Resume a paused phase. Only the same owner may; the caller restores the snapshot and re-checks the provider. */
export function resume(base, { job, phase, owner }, now = new Date()) {
  const dir = dirOf(base, job, phase); const h = readHolder(dir);
  if (!h) throw new Conflict('no lease for this phase');
  if (h.state !== 'paused') throw new Conflict('this phase is not paused');
  if (!sameOwner(h.owner, checkOwner(owner))) throw new Conflict('only the agent that paused this phase may resume it (a different owner is a takeover, which is recorded separately)');
  const paused = h.paused; h.state = 'running'; h.heartbeatAt = now.toISOString(); delete h.paused; write(dir, h);
  return { ...h, resumedFrom: paused };
}

export function release(base, { job, phase, owner }) {
  const dir = dirOf(base, job, phase); const h = readHolder(dir);
  if (!h) return { released: false };
  if (!sameOwner(h.owner, checkOwner(owner))) throw new Conflict('you do not hold this lease');
  rmSync(dir, { recursive: true, force: true }); return { released: true };
}

export function status(base, { job, phase }, now = new Date()) {
  const dir = dirOf(base, job, phase); if (!existsSync(dir)) return { held: false };
  const h = readHolder(dir); if (!h) return { held: true, readable: false };
  const age = ageMinutes(h, now);
  return { held: true, readable: true, state: h.state, owner: h.owner, heartbeatAgeMinutes: Number.isFinite(age) ? Math.round(age) : null, stale: h.state === 'running' && age >= STALE_AFTER_MIN, paused: h.paused ?? null };
}
