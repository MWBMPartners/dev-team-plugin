// @ts-check
// File:    engine/lib/log.mjs
// Purpose: A simple local event log: one JSON line per event, one file per day, with secrets removed.
//          It lives in the engine's machine-local folder, never inside a project, and holds no source code.
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { redact } from './redact.mjs';

/** The only event names the engine writes. */
export const EVENTS = Object.freeze([
  'DISCOVERY_COMPLETED', 'DISCOVERY_FAILED', 'MODEL_RETIRED_CANDIDATE', 'MODEL_RETIRED',
  'ROUTING_DECIDED', 'APPROVAL_NEEDED', 'PIN_STOPPED', 'SETTINGS_INVALID', 'SIM_RUN',
]);

/**
 * Append one event. `dir` is the events folder; `now` is a Date (replaceable so tests need no clock).
 * @param {string} dir @param {string} name @param {Record<string, unknown>} data @param {Date} [now]
 */
export function event(dir, name, data = {}, now = new Date()) {
  if (!EVENTS.includes(name)) throw new Error(`unknown event name "${name}"`);
  mkdirSync(dir, { recursive: true });
  const line = redact(JSON.stringify({ at: now.toISOString(), event: name, data }));
  appendFileSync(join(dir, `${now.toISOString().slice(0, 10)}.jsonl`), line + '\n');
}
