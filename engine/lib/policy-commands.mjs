// @ts-check
// File:    engine/lib/policy-commands.mjs
// Purpose: Command-line side of gates, policy packs and invariants.
import { resolve } from 'node:path';
import { statSync } from 'node:fs';
import { ExitCodes } from './cli.mjs';
import { BadInput } from './paths.mjs';
import { gateCheck } from './gates.mjs';
import { listPacks, loadPacks, validatePack, rollbackRequired } from './packs.mjs';
import { collectInvariants } from './invariants.mjs';
import { writeMarked } from './store.mjs';

const packIds = (a) => (typeof a.flags.pack === 'string' && a.flags.pack !== '' ? a.flags.pack.split(',') : []);
const projectDir = (a) => { const d = typeof a.flags.project === 'string' ? resolve(a.flags.project) : process.cwd(); try { if (!statSync(d).isDirectory()) throw new Error(); } catch { throw new BadInput('--project must be an existing folder'); } return d; };
const flag = (a, k) => a.flags[k] === true || a.flags[k] === 'true';

export const policyCommands = {
  async gate(a) {
    if (a.sub !== 'check' || typeof a.flags.action !== 'string') throw new BadInput('usage: gate check --action KIND [--confident --deterministic-pass --review-verified --human-approved] [--pack id,id]');
    const packs = loadPacks(packIds(a));
    const r = gateCheck(a.flags.action, { confident: flag(a, 'confident'), deterministicPass: flag(a, 'deterministic-pass'), reviewVerified: flag(a, 'review-verified'), humanApproved: flag(a, 'human-approved') }, packs);
    return { code: r.level === 'PROHIBITED' ? ExitCodes.NEGATIVE : ExitCodes.OK, result: r, problems: r.level === 'PROHIBITED' ? [{ code: 'PROHIBITED', message: `${a.flags.action} is never allowed` }] : [] };
  },
  async packs(a) {
    if (a.sub === 'list') return { code: ExitCodes.OK, result: listPacks() };
    if (a.sub === 'show' && typeof a.flags.id === 'string') { const [p] = loadPacks([a.flags.id]); return { code: ExitCodes.OK, result: { ...p, problems: validatePack(p), rollbackRequired: rollbackRequired([p]) } }; }
    throw new BadInput('usage: packs list | packs show --id ID');
  },
  async invariants(a) {
    const dir = projectDir(a); const found = collectInvariants(dir, loadPacks(packIds(a)));
    if (a.sub === 'show') return { code: ExitCodes.OK, result: found };
    if (a.sub === 'collect') { const out = resolve(dir, '.dev-team', 'invariants.json'); writeMarked(out, 'invariants', { invariants: found }); return { code: ExitCodes.OK, result: { written: '.dev-team/invariants.json', count: found.length } }; }
    throw new BadInput('usage: invariants collect|show [--project D] [--pack id,id]');
  },
};
