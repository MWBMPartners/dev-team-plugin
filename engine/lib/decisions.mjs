// @ts-check
// File:    engine/lib/decisions.mjs
// Purpose: Writes down every routing decision so it can be explained later ("why was this model chosen?").
//          The same inputs always give the same fingerprint (inputsHash); only the id and the time differ.
//          Records live in the engine's machine-local folder and hold no source code.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { canonicalJson, sha256Hex } from './canonical.mjs';
import { writeJsonAtomic } from './store.mjs';

const ID = /^d-[0-9a-f]{12}$/;

/** A fingerprint of everything that went into a decision. */
export function inputsHash(request, cfg, catalogueStamp) {
  return sha256Hex(canonicalJson({ request, cfg: { order: cfg.order, askFirst: cfg.askFirst, pin: cfg.pin }, catalogueStamp }));
}

/** Save a decision. Returns the record, with `saved: false` when it could not be written (never an error for the caller). */
export function recordDecision(dir, request, cfg, catalogueStamp, result, now = new Date()) {
  // Only the fields the engine itself understands are saved; any extra text in a request is dropped, so a stray
  // note can never carry a secret into a file.
  const KNOWN = ['role', 'taskTypes', 'risk', 'providers', 'approved', 'exhausted', 'builtBy', 'order', 'minTier', 'complex', 'escalateEffort'];
  const known = Object.fromEntries(KNOWN.filter((k) => request[k] !== undefined).map((k) => [k, request[k]]));
  const record = { id: `d-${randomBytes(6).toString('hex')}`, recordedAt: now.toISOString(), inputsHash: inputsHash(known, cfg, catalogueStamp), request: known, result: stripNoise(result) };
  try { writeJsonAtomic(join(dir, `${record.id}.json`), record); return { ...record, saved: true }; } catch { return { ...record, saved: false }; }
}
const stripNoise = (r) => r;

/** Read a decision back by id. The id must have the exact shape the engine makes, so it can never be a path. */
export function getDecision(dir, id) {
  if (!ID.test(String(id))) throw new RangeError('a decision id looks like d-0123456789ab');
  const p = join(dir, `${id}.json`);
  if (!existsSync(p)) return null;
  let rec;
  try { rec = JSON.parse(readFileSync(p, 'utf8')); } catch { throw new DecisionUnreadable(); }
  if (!rec || typeof rec !== 'object' || !rec.result || typeof rec.result !== 'object' || !Array.isArray(rec.result.reasons) || !Array.isArray(rec.result.heldBack ?? [])) throw new DecisionUnreadable();
  rec.result.heldBack ??= [];
  return rec;
}

/** A saved decision file that is damaged. Reported as a conflict, not as bad input. */
export class DecisionUnreadable extends Error { constructor() { super('the saved decision is damaged and cannot be read'); } }

/** Three plain sentences saying why. */
export function explain(record) {
  const r = record.result, d = r.decision;
  if (!d) return [`No model was chosen for this job (${r.code}).`, ...r.reasons.slice(-2)].slice(0, 3);
  if (d.deterministic) return ['No AI model was needed for this job.', ...r.reasons.slice(-1), 'A script or tool does it, which costs nothing.'].slice(0, 3);
  const eff = d.effort ? ` with ${d.effort.level ?? 'no'} effort` : '';
  const held = r.heldBack.length ? ` ${r.heldBack.map((h) => h.model).join(', ')} would have qualified but needs your approval first.` : '';
  return [
    `${d.model} (${d.provider}, tier ${d.tier}${d.local ? ', running locally' : ''}) was chosen${eff}.`,
    r.reasons.filter((x) => !x.startsWith('Held back')).slice(-2).join(' '),
    held.trim() || 'Nothing that qualified was held back.',
  ];
}
