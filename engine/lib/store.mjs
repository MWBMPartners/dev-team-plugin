// @ts-check
// File:    engine/lib/store.mjs
// Purpose: Reading and writing the engine's JSON files safely. Every file the engine writes carries
//          an ownership marker as its first key, so a file it did not write is never overwritten, and
//          nothing credential-shaped is ever written.
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { looksLikeCredential } from './redact.mjs';

/** The marker, as the first key of the file: {"dev-team": "ledger=<kind> schema=1.0", ...}. */
export const markerFor = (kind) => `ledger=${kind} schema=1.0`;

export function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }

/** Write a file in one step: a temporary file, then a rename, so a crash never leaves half a file. */
export function writeJsonAtomic(path, value) {
  const text = JSON.stringify(value, null, 2) + '\n';
  if (looksLikeCredential(text)) throw new Error('refusing to write: the content contains a credential-shaped value');
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, text);
  renameSync(tmp, path);
}

/**
 * Read a file the engine owns. status: 'absent' (not there), 'ours' (carries the marker),
 * 'not-ours' (valid JSON without it) or 'invalid' (not JSON).
 */
export function readMarked(path, kind) {
  if (!existsSync(path)) return { status: 'absent', value: null };
  let value;
  try { value = readJson(path); } catch { return { status: 'invalid', value: null }; }
  const ok = value && typeof value === 'object' && value['dev-team'] === markerFor(kind);
  return { status: ok ? 'ours' : 'not-ours', value };
}

/** Write a file with the marker first. Refuses to touch a file that exists and is not ours. */
export function writeMarked(path, kind, body) {
  const have = readMarked(path, kind);
  if (have.status === 'not-ours' || have.status === 'invalid') throw new Error(`refusing to overwrite ${path}: it is not a dev-team ${kind} file`);
  writeJsonAtomic(path, { 'dev-team': markerFor(kind), ...body });
}
