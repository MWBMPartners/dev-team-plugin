// @ts-check
// File:    engine/lib/packs.mjs
// Purpose: Policy packs: named sets of extra rules for a kind of project. Reading them is safe; applying them can only
//          make things stricter. A pack that tries to LOWER a gate below the built-in level is refused as invalid.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pluginRoot } from './paths.mjs';
import { LEVEL_ORDER, levelFor } from './gates.mjs';
import { floorFor } from './tiers.mjs';
import { TASK_TYPES } from './taxonomy.mjs';

const dir = () => join(pluginRoot(), 'policy-packs');
const ID = /^[a-z0-9-]+$/;

/** Problems that make a pack unusable (an empty list means it is fine). */
export function validatePack(p) {
  const bad = [];
  if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !ID.test(p.id)) return ['not a policy pack (it needs a plain id)'];
  if (p.gates !== undefined && (typeof p.gates !== 'object' || p.gates === null || Array.isArray(p.gates))) bad.push('gates must be a map of action to level');
  for (const f of ['invariants', 'mandatoryReviews']) if (p[f] !== undefined && (!Array.isArray(p[f]) || p[f].some((x) => typeof x !== 'string'))) bad.push(`${f} must be a list of text values`);
  if (p.rollbackRequired !== undefined && typeof p.rollbackRequired !== 'boolean') bad.push('rollbackRequired must be true or false');
  const seenKinds = new Set();
  for (const [kind, lvl] of Object.entries(p.gates && typeof p.gates === 'object' && !Array.isArray(p.gates) ? p.gates : {})) {
    const ck = String(kind).trim().toUpperCase().replace(/[\s-]+/g, '_'); if (seenKinds.has(ck)) bad.push(`gate ${kind}: the same action is listed twice under different spellings`); seenKinds.add(ck);
    if (!LEVEL_ORDER.includes(lvl)) bad.push(`gate ${kind}: unknown level ${String(lvl).slice(0, 30)}`);
    else if (LEVEL_ORDER.indexOf(lvl) < LEVEL_ORDER.indexOf(levelFor(kind, []).level) && levelFor(kind, []).known) bad.push(`gate ${kind}: ${lvl} is less careful than the built-in ${levelFor(kind, []).level}; a pack may only raise a gate`);
  }
  for (const [t, n] of Object.entries(p.raiseFloors ?? {})) {
    if (!TASK_TYPES.includes(t)) bad.push(`floor ${t}: unknown task type`);
    else if (!Number.isInteger(n) || n < 0 || n > 4) bad.push(`floor ${t}: the tier must be a whole number from 0 to 4`);
  }
  return bad;
}

export function listPacks() { return readdirSync(dir()).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort(); }

/** Load packs by id. An unknown id, or an invalid pack, is an error (never silently skipped). */
export function loadPacks(ids) {
  return ids.map((id) => {
    if (typeof id !== 'string' || !ID.test(id)) throw new RangeError('a pack id is lower-case letters, numbers and dashes');
    let p; try { p = JSON.parse(readFileSync(join(dir(), `${id}.json`), 'utf8')); } catch { throw new RangeError(`no policy pack named ${id}`); }
    const bad = validatePack(p); if (bad.length) throw new RangeError(`policy pack ${id} is invalid: ${bad.join('; ')}`);
    return p;
  });
}

/** The floor for a job with these packs applied; a pack can raise a minimum, never lower it. */
export function floorWithPacks(taskTypes, risk, packs) {
  const raise = {};
  for (const p of packs) for (const [t, n] of Object.entries(p.raiseFloors ?? {})) raise[t] = Math.max(raise[t] ?? 0, n);
  return floorFor(taskTypes, risk, { raise });
}
export const rollbackRequired = (packs) => packs.some((p) => p.rollbackRequired === true);
