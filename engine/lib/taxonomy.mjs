// @ts-check
// File:    engine/lib/taxonomy.mjs
// Purpose: The fixed vocabularies the engine uses: kinds of task, risk levels, effort levels and roles.
//          One place, so a typo in a request is caught instead of quietly treated as something else.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pluginRoot } from './paths.mjs';

const floorsDoc = () => JSON.parse(readFileSync(join(pluginRoot(), 'engine', 'data', 'floors.json'), 'utf8'));

export const RISKS = Object.freeze(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']);
export const EFFORT = Object.freeze(['MINIMAL', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH', 'MAXIMUM']);
export const ROLES = Object.freeze(['mechanical', 'scout', 'documentarian', 'builder', 'architect', 'reviewer']);
export const TASK_TYPES = Object.freeze(Object.keys(floorsDoc().floors));

/** Throw a plain-words error unless `value` is one of `allowed`. */
export function assertEnum(name, value, allowed) {
  if (!allowed.includes(value)) throw new RangeError(`${name} must be one of ${allowed.join(', ')}; got "${String(value).slice(0, 30)}"`);
  return value;
}
