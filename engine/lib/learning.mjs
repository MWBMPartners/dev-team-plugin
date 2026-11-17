// @ts-check
// File:    engine/lib/learning.mjs
// Purpose: Remembers how each model did on each kind of work, ON THIS MACHINE ONLY, so routing can improve. A record
//          has a fixed list of short fields; it can never hold code, prompts, diffs or file paths (any other field, any
//          value with a slash or a secret-like pattern is refused). Learning can be switched off
//          (DEV_TEAM_NO_LEARNING=1) and purged at any time. Nothing here is ever committed or sent anywhere.
import { appendFileSync, mkdirSync, readdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { looksLikeCredential } from './redact.mjs';
import { TASK_TYPES, EFFORT, RISKS } from './taxonomy.mjs';

const WORD = /^[A-Za-z0-9._:+# -]{1,60}$/; // letters, numbers and a little punctuation; no slash, so no path
const KEYS = ['taskType', 'language', 'framework', 'project', 'provider', 'model', 'runtime', 'tier', 'risk', 'effort', 'firstPassTests', 'reviewOutcome', 'findingsAccepted', 'findingsRejected', 'retries', 'escalations', 'tokens', 'latencyMs', 'accepted', 'failureClass', 'at'];
const REQUIRED = ['taskType', 'provider', 'model', 'tier', 'risk', 'accepted', 'at'];

/** Check a record and return it cleaned, or throw a plain-words error. */
export function validateRecord(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) throw new RangeError('a learning record must be an object');
  for (const k of Object.keys(r)) if (!KEYS.includes(k)) throw new RangeError(`a learning record may not contain "${k.slice(0, 20)}" (it holds no code, prompts, diffs or paths)`);
  for (const k of REQUIRED) if (r[k] === undefined) throw new RangeError(`a learning record needs ${k}`);
  for (const k of ['taskType', 'language', 'framework', 'project', 'provider', 'model', 'runtime', 'failureClass']) if (r[k] !== undefined && (typeof r[k] !== 'string' || !WORD.test(r[k]))) throw new RangeError(`${k} must be a short plain word (no slashes or paths)`);
  if (!TASK_TYPES.includes(r.taskType)) throw new RangeError('unknown taskType');
  if (!RISKS.includes(r.risk)) throw new RangeError('unknown risk');
  if (r.effort !== undefined && !EFFORT.includes(r.effort)) throw new RangeError('unknown effort');
  if (!Number.isInteger(r.tier) || r.tier < 0 || r.tier > 4) throw new RangeError('tier must be 0 to 4');
  if (typeof r.accepted !== 'boolean') throw new RangeError('accepted must be true or false');
  if (r.firstPassTests !== undefined && !['PASS', 'FAIL', 'NONE'].includes(r.firstPassTests)) throw new RangeError('firstPassTests must be PASS, FAIL or NONE');
  if (r.reviewOutcome !== undefined && !['ACCEPTED', 'REJECTED', 'NONE'].includes(r.reviewOutcome)) throw new RangeError('reviewOutcome must be ACCEPTED, REJECTED or NONE');
  for (const k of ['findingsAccepted', 'findingsRejected', 'retries', 'escalations', 'tokens', 'latencyMs']) if (r[k] !== undefined && (!Number.isInteger(r[k]) || r[k] < 0 || r[k] > 1e9)) throw new RangeError(`${k} must be a whole number of at least 0`);
  if (typeof r.at !== 'string' || !Number.isFinite(Date.parse(r.at)) || new Date(Date.parse(r.at)).toISOString().slice(0, 10) !== r.at.slice(0, 10)) throw new RangeError('at must be a real date and time');
  if (looksLikeCredential(JSON.stringify(r))) throw new RangeError('the record looks like it contains a secret');
  return { ...r };
}

export const learningEnabled = (env = process.env) => !env.DEV_TEAM_NO_LEARNING;

/** Append one record to this month's file. Returns {recorded:false} when learning is off. */
export function record(dir, r, env = process.env) {
  if (!learningEnabled(env)) return { recorded: false, reason: 'learning is switched off (DEV_TEAM_NO_LEARNING)' };
  const clean = validateRecord(r);
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, `${clean.at.slice(0, 7)}.jsonl`), JSON.stringify(clean) + '\n');
  return { recorded: true };
}

/** Read every record, skipping any line that is damaged or does not validate. */
export function readAll(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir).filter((x) => /^\d{4}-\d{2}\.jsonl$/.test(x)).sort()) {
    for (const line of readFileSync(join(dir, f), 'utf8').split('\n')) { if (!line.trim()) continue; try { out.push(validateRecord(JSON.parse(line))); } catch { /* skip a damaged line */ } }
  }
  return out;
}

/** Delete everything learned. */
export function purge(dir) { const had = existsSync(dir); rmSync(dir, { recursive: true, force: true }); return { purged: had }; }

const HALF_LIFE_DAYS = 30, MIN_PROJECT = 5, MIN_GLOBAL = 10, PRIOR_WEIGHT = 3;
/**
 * How well a model has done on a kind of task. Old results count for less (half-life 30 days). With too few results
 * (5 in this project, 10 anywhere) there is no score at all, so routing stays neutral. A neutral prior means one bad
 * result can only move the score a limited amount.
 * @param {any[]} records @param {{provider: string, model: string, taskType: string, project?: string}} q @param {Date} now
 */
export function competency(records, q, now = new Date()) {
  const mine = records.filter((r) => r.provider === q.provider && r.model === q.model && r.taskType === q.taskType);
  const calc = (list, min, basis) => {
    if (list.length < min) return null;
    let w = 0, s = 0;
    for (const r of list) { const age = Math.max(0, (now.getTime() - Date.parse(r.at)) / 86400000); const wt = Math.pow(0.5, age / HALF_LIFE_DAYS); w += wt; s += wt * (r.accepted ? 1 : 0); }
    return { score: Math.round(((s + 0.5 * PRIOR_WEIGHT) / (w + PRIOR_WEIGHT)) * 1000) / 1000, observations: list.length, basis };
  };
  const proj = q.project ? calc(mine.filter((r) => r.project === q.project), MIN_PROJECT, 'PROJECT') : null;
  return proj ?? calc(mine, MIN_GLOBAL, 'GLOBAL') ?? { score: null, observations: mine.length, basis: 'TOO_FEW_OBSERVATIONS' };
}
