// @ts-check
// File:    engine/lib/continuity-commands.mjs
// Purpose: The command-line side of quota observation, leases, snapshots, fallback and takeover. Kept apart from the
//          main entry file so that file stays readable.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { ExitCodes } from './cli.mjs';
import { BadInput, projectDataDir, repoRoot } from './paths.mjs';
import { parseQuotaMessage, pauseOrBlock } from './quota.mjs';
import { Conflict } from './plan.mjs';
import * as lease from './lease.mjs';
import { createSnapshot, restoreSnapshot, listSnapshots, pruneSnapshots, SecretFound, SnapshotConflict } from './snapshot.mjs';
import { fallback, takeoverPlan } from './fallback.mjs';
import { writeJsonAtomic } from './store.mjs';

const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const projectDirOf = (a) => { const d = typeof a.flags.project === 'string' ? resolve(a.flags.project) : process.cwd(); try { return repoRoot(d); } catch { throw new BadInput('--project must be inside a git repository'); } };
const owner = (a) => ({ provider: a.flags.provider, model: a.flags.model, runtime: a.flags.runtime, role: a.flags.role, ...(typeof a.flags.session === 'string' ? { session: a.flags.session } : {}) });
const readJson = (f, what) => { try { return JSON.parse(readFileSync(resolve(String(f)), 'utf8')); } catch { throw new BadInput(`${what} is missing or is not valid JSON`); } };
const conflict = (code, e) => ({ code: ExitCodes.CONFLICT, result: null, problems: [{ code, message: e.message }] });

export const continuityCommands = {
  async quota(a) {
    const root = projectDirOf(a), base = projectDataDir(root), obsFile = join(base, 'quota.json');
    if (a.sub === 'observe') {
      let text = '';
      if (typeof a.flags.file === 'string') { try { text = readFileSync(resolve(a.flags.file), 'utf8'); } catch { throw new BadInput('the message file is missing'); } }
      else if (a.flags.stdin) text = readFileSync(0, 'utf8');
      else throw new BadInput('usage: quota observe --provider P (--file F | --stdin)');
      if (typeof a.flags.provider !== 'string') throw new BadInput('--provider is needed');
      const obs = parseQuotaMessage(text, { provider: a.flags.provider, machineZone: zone(), now: new Date() });
      if (!obs) return { code: ExitCodes.OK, result: { observation: null, note: 'The message does not look like a usage-limit message.' } };
      const all = existsSync(obsFile) ? readJson(obsFile, 'the saved quota file') : {}; all[obs.provider] = obs; writeJsonAtomic(obsFile, all);
      return { code: ExitCodes.OK, result: { observation: obs, decision: pauseOrBlock(obs, new Date()) } };
    }
    if (a.sub === 'status') {
      const all = existsSync(obsFile) ? readJson(obsFile, 'the saved quota file') : {};
      const now = Date.now();
      return { code: ExitCodes.OK, result: Object.values(all).map((o) => ({ ...o, resetPassed: o.resetAt ? Date.parse(o.resetAt) <= now : null })) };
    }
    throw new BadInput('usage: quota observe|status');
  },
  async lease(a) {
    const root = projectDirOf(a), base = projectDataDir(root);
    const args = { job: a.flags.job, phase: a.flags.phase, owner: owner(a) };
    try {
      if (a.sub === 'status') return { code: ExitCodes.OK, result: lease.status(base, args) };
      if (a.sub === 'acquire') return { code: ExitCodes.OK, result: lease.acquire(base, args) };
      if (a.sub === 'heartbeat') return { code: ExitCodes.OK, result: lease.heartbeat(base, args) };
      if (a.sub === 'release') return { code: ExitCodes.OK, result: lease.release(base, args) };
      if (a.sub === 'resume') return { code: ExitCodes.OK, result: lease.resume(base, args) };
      if (a.sub === 'reclaim') {
        // The work snapshot is taken FIRST, and the lease is only reclaimed if it succeeds.
        const snap = createSnapshot(root, { job: args.job, phase: args.phase, reason: 'reclaim' });
        return { code: ExitCodes.OK, result: { lease: lease.reclaim(base, { ...args, snapshotRef: snap.snapshotRef }), snapshot: snap } };
      }
      if (a.sub === 'pause') {
        const obs = typeof a.flags['observation-file'] === 'string' ? readJson(a.flags['observation-file'], 'the observation file') : { resetAt: typeof a.flags['resets-at'] === 'string' ? a.flags['resets-at'] : null };
        const snap = createSnapshot(root, { job: args.job, phase: args.phase, reason: 'pause' });
        return { code: ExitCodes.OK, result: { lease: lease.pause(base, { ...args, observation: obs, snapshotRef: snap.snapshotRef }), snapshot: snap } };
      }
    } catch (e) {
      if (e instanceof Conflict) return conflict(/^STALE_LOCK/.test(e.message) ? 'STALE_LOCK' : 'LEASE_CONFLICT', e);
      if (e instanceof SecretFound) return { code: ExitCodes.VERIFY_FAILED, result: null, problems: [{ code: 'SECRET_IN_SNAPSHOT', message: e.message }] };
      throw e;
    }
    throw new BadInput('usage: lease acquire|heartbeat|pause|resume|reclaim|release|status --job J --phase P --provider X --model M --runtime R --role ROLE [--session S]');
  },
  async snapshot(a) {
    const root = projectDirOf(a);
    try {
      if (a.sub === 'create') return { code: ExitCodes.OK, result: createSnapshot(root, { job: a.flags.job, phase: a.flags.phase, reason: typeof a.flags.reason === 'string' ? a.flags.reason : 'pause' }) };
      if (a.sub === 'restore') return { code: ExitCodes.OK, result: restoreSnapshot(root, a.flags.ref) };
      if (a.sub === 'list') return { code: ExitCodes.OK, result: listSnapshots(root, a.flags.job) };
      if (a.sub === 'prune') return { code: ExitCodes.OK, result: pruneSnapshots(root, a.flags.job) };
    } catch (e) {
      if (e instanceof SnapshotConflict) return conflict('SNAPSHOT_CONFLICT', e);
      if (e instanceof SecretFound) return { code: ExitCodes.VERIFY_FAILED, result: null, problems: [{ code: 'SECRET_IN_SNAPSHOT', message: e.message }] };
      throw e;
    }
    throw new BadInput('usage: snapshot create|restore|list|prune --job J [--phase P] [--ref R]');
  },
  async fallback(a) {
    const input = readJson(a.flags.input, 'the input file');
    if (!Array.isArray(input.models) || !input.failed) throw new BadInput('the input needs models (a list) and failed');
    const r = fallback(input.models, input.failed, Array.isArray(input.excluded) ? input.excluded : []);
    return { code: r.next ? ExitCodes.OK : ExitCodes.NEGATIVE, result: r, problems: r.next ? [] : [{ code: 'NO_SUITABLE_AGENT_AVAILABLE', message: 'no equal or stronger replacement is available' }] };
  },
  async takeover(a) {
    const input = readJson(a.flags.input, 'the input file');
    if (!Array.isArray(input.models) || !input.failed || typeof input.reason !== 'string') throw new BadInput('the input needs models, failed and reason');
    const r = takeoverPlan({ enabled: input.enabled === true, reason: input.reason, models: input.models, failed: input.failed });
    return { code: r.takeover ? ExitCodes.OK : ExitCodes.NEGATIVE, result: r, problems: r.takeover ? [] : [{ code: r.state, message: r.reason }] };
  },
};
export { readdirSync };
