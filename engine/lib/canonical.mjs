// @ts-check
// File:    engine/lib/canonical.mjs
// Purpose: One fixed way of writing a JSON value as text (keys sorted by code point, no spaces), so the
//          same data always gives the same fingerprint. It follows exactly the rule used by
//          .claude/plans/orchestrator-v2/hash-contract.mjs; a test checks the two agree.
import { createHash } from 'node:crypto';

/** @param {unknown} v */
export function canonicalJson(v) {
  if (v === undefined) throw new Error('undefined is not allowed');
  if (typeof v === 'function' || typeof v === 'symbol' || typeof v === 'bigint') throw new Error(`a ${typeof v} cannot be written as JSON`);
  if (typeof v === 'number' && !Number.isFinite(v)) throw new Error('NaN and Infinity are not allowed');
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonicalJson).join(',') + ']';
  return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonicalJson(/** @type {any} */ (v)[k])).join(',') + '}';
}

/** @param {string|Uint8Array} bytes */
export function sha256Hex(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
