// @ts-check
// File:    engine/lib/policy-commands.mjs
// Purpose: Command-line side of gates, policy packs and invariants.
import { resolve } from 'node:path';
import { statSync, readFileSync } from 'node:fs';
import { budgetStatus, reserveCheck } from './budget.mjs';
import { estimate } from './estimate.mjs';
import { verifyEnvelope } from './signature.mjs';
import { fetchCatalogue } from './remote-catalogue.mjs';
import { dataDir } from './paths.mjs';
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
  async catalogue(a) {
    if (a.sub === 'verify') {
      if (typeof a.flags.file !== 'string') throw new BadInput('usage: catalogue verify --file <envelope.json> [--key <public-key.pem>]');
      let env; try { env = JSON.parse(readFileSync(resolve(a.flags.file), 'utf8')); } catch { throw new BadInput('the envelope file is missing or is not valid JSON'); }
      let pem; if (typeof a.flags.key === 'string') { try { pem = readFileSync(resolve(a.flags.key), 'utf8'); } catch { throw new BadInput('the key file is missing'); } }
      const v = verifyEnvelope(env, pem ? { publicKeyPem: pem } : {});
      return { code: v.ok ? ExitCodes.OK : ExitCodes.VERIFY_FAILED, result: { ok: v.ok, reason: v.reason }, problems: v.ok ? [] : [{ code: 'CATALOGUE_REJECTED', message: `${v.reason}; the file is ignored and never used unsigned` }] };
    }
    if (a.sub === 'fetch') {
      const given = typeof a.flags.url === 'string' ? a.flags.url : null;
      if (given !== null) { let u; try { u = new URL(given); } catch { throw new BadInput('--url is not a valid web address'); } if (u.protocol !== 'https:') throw new BadInput('--url must be an https address'); }
      const r = await fetchCatalogue({ url: given ?? process.env.DEV_TEAM_CATALOGUE_URL ?? null, dataDir: dataDir(), refresh: a.flags.refresh === true });
      return { code: r.status === 'REJECTED' ? ExitCodes.VERIFY_FAILED : ExitCodes.OK, result: r, problems: r.status === 'REJECTED' ? [{ code: 'CATALOGUE_REJECTED', message: r.note }] : [] };
    }
    throw new BadInput('usage: catalogue verify --file F [--key K] | catalogue fetch [--url https://...] [--refresh]');
  },
  async budget(a) {
    if (a.sub !== 'check' || typeof a.flags.input !== 'string') throw new BadInput('usage: budget check --input <json with limit and spent> | budget check --input <json with remainingPercent, tier, taskTypes>');
    let i; try { i = JSON.parse(readFileSync(resolve(a.flags.input), 'utf8')); } catch { throw new BadInput('the input file is missing or is not valid JSON'); }
    if (!i || typeof i !== 'object') throw new BadInput('the input must be a JSON object');
    if (i.limit) { const r = budgetStatus(i); return { code: r.status === 'STOP' ? ExitCodes.NEGATIVE : ExitCodes.OK, result: r, problems: r.status === 'STOP' ? [{ code: 'BUDGET_REACHED', message: r.reasons.join(' ') }] : [] }; }
    const r = reserveCheck(i); return { code: r.allowed ? ExitCodes.OK : ExitCodes.NEGATIVE, result: r, problems: r.allowed ? [] : [{ code: 'RESERVE_PROTECTED', message: r.reason }] };
  },
  async estimate(a) {
    if (typeof a.flags.input !== 'string') throw new BadInput('usage: estimate --input <json with taskTypes and costBand>');
    let i; try { i = JSON.parse(readFileSync(resolve(a.flags.input), 'utf8')); } catch { throw new BadInput('the input file is missing or is not valid JSON'); }
    return { code: ExitCodes.OK, result: estimate(i) };
  },
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
