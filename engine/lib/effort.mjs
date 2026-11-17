// @ts-check
// File:    engine/lib/effort.mjs
// Purpose: How hard a model should think for a task, and the nearest setting a given tool offers.
//          The tool's own levels differ (Claude Code and Codex name them differently), so the engine
//          picks the closest level the model really supports and says when it had to pick a different one.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pluginRoot } from './paths.mjs';
import { EFFORT, RISKS, assertEnum } from './taxonomy.mjs';

const doc = () => JSON.parse(readFileSync(join(pluginRoot(), 'engine', 'data', 'effort-defaults.json'), 'utf8'));

/**
 * The effort wanted for the biggest need among the task types. MAXIMUM is only allowed at CRITICAL risk
 * (or when `afterTierThreeFailure` is true); anywhere else it is stepped down to VERY_HIGH.
 * @param {string[]} taskTypes @param {string} risk @param {{afterTierThreeFailure?: boolean, escalate?: boolean}} [opts]
 */
export function wantedEffort(taskTypes, risk = 'NORMAL', opts = {}) {
  assertEnum('risk', risk, RISKS);
  const d = doc().defaults;
  const high = risk === 'HIGH' || risk === 'CRITICAL';
  let idx = 0;
  for (const t of taskTypes) {
    if (!Object.hasOwn(d, t)) throw new RangeError(`unknown task type "${String(t).slice(0, 40)}"`);
    idx = Math.max(idx, EFFORT.indexOf(d[t][high ? 1 : 0]));
  }
  if (opts.escalate) idx = Math.min(EFFORT.length - 1, idx + 1);
  const maxOk = risk === 'CRITICAL' || opts.afterTierThreeFailure === true;
  if (EFFORT[idx] === 'MAXIMUM' && !maxOk) idx = EFFORT.indexOf('VERY_HIGH');
  return EFFORT[idx];
}

// How the engine's six levels line up with the names a tool may use. A name not listed here is never guessed at.
const SYNONYMS = { MINIMAL: ['minimal', 'none'], LOW: ['low'], MEDIUM: ['medium'], HIGH: ['high'], VERY_HIGH: ['xhigh', 'very_high'], MAXIMUM: ['max', 'maximum'] };

/**
 * The tool's own level closest to what is wanted, and a note if it is not exact. `supported` is the
 * model's list of levels, or the text UNKNOWN.
 * @param {string} wanted @param {string[]|string} supported
 */
export function applyEffort(wanted, supported) {
  assertEnum('effort', wanted, EFFORT);
  if (!Array.isArray(supported) || supported.length === 0) return { level: null, exact: false, note: 'The tool does not say which effort levels it supports, so none is set.' };
  const names = supported.map((s) => String(s).toLowerCase());
  const target = EFFORT.indexOf(wanted);
  let best = null;
  for (let i = 0; i < EFFORT.length; i++) {
    const hit = SYNONYMS[EFFORT[i]].find((n) => names.includes(n));
    if (hit && (best === null || Math.abs(i - target) < Math.abs(best.i - target) || (Math.abs(i - target) === Math.abs(best.i - target) && i > best.i))) best = { i, hit };
  }
  if (!best) return { level: null, exact: false, note: 'None of the tool\'s levels is one the engine knows, so none is set.' };
  return { level: best.hit, exact: best.i === target, note: best.i === target ? 'Exact match.' : `Wanted ${wanted}; the closest level offered is ${best.hit}.` };
}

// Claude Code reads a worker's thinking effort from the agent's own file (it cannot be set when starting one), so
// each role and effort pairs with an agent file. A pairing with no file is moved to the nearest one that exists,
// and the move is recorded.
const ORDER = ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH', 'MAXIMUM'];
const AGENT_FILES = {
  scout: { LOW: 'scout', MEDIUM: 'engineer', HIGH: 'engineer-high' },
  mechanical: { LOW: 'scout', MEDIUM: 'engineer', HIGH: 'engineer-high' },
  documentarian: { LOW: 'scribe' },
  builder: { MEDIUM: 'engineer', HIGH: 'engineer-high' },
  architect: { HIGH: 'architect-high', VERY_HIGH: 'architect', MAXIMUM: 'architect-max' },
  reviewer: { HIGH: 'reviewer', VERY_HIGH: 'reviewer-xhigh' },
};
// A tier-4 (principal) model uses the principal files for architect work.
const PRINCIPAL = { VERY_HIGH: 'principal-xhigh', MAXIMUM: 'principal', HIGH: 'principal-xhigh' };

/**
 * The Claude Code agent file for a role at an effort. `tier` is the chosen model's tier.
 * @param {string} role @param {string} effort one of the six effort levels @param {number} tier
 * @returns {{file: string, exact: boolean, note: string}}
 */
export function claudeAgentFile(role, effort, tier) {
  assertEnum('effort', effort, EFFORT);
  const map = role === 'architect' && tier >= 4 ? PRINCIPAL : AGENT_FILES[role];
  if (!map) throw new RangeError(`unknown role "${String(role).slice(0, 30)}"`);
  const want = ORDER.indexOf(effort);
  let best = null;
  for (const [lvl, file] of Object.entries(map)) { const d = Math.abs(ORDER.indexOf(lvl) - want); if (best === null || d < best.d || (d === best.d && ORDER.indexOf(lvl) > ORDER.indexOf(best.lvl))) best = { lvl, file, d }; }
  const exact = best.d === 0;
  return { file: best.file, exact, note: exact ? 'Exact match.' : `A ${role} file at ${effort} effort does not exist; ${best.file} (${best.lvl}) is the nearest.` };
}
