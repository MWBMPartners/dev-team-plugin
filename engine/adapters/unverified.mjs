// @ts-check
// File:    engine/adapters/unverified.mjs
// Purpose: Gemini CLI, Kimi Code CLI and Grok Build: documented, never tried (decision D3). They find no
//          models ("UNVERIFIED_ADAPTER") and report what their small data file says, which is mostly UNKNOWN.
//          They exist so the simulator and the registry can treat every provider the same way.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pluginRoot } from '../lib/paths.mjs';
import { makeProfile } from './base.mjs';

/** @param {string} id @param {string} provider @returns {import('./base.mjs').Adapter} */
export function unverifiedAdapter(id, provider) {
  const doc = () => JSON.parse(readFileSync(join(pluginRoot(), 'engine', 'data', 'runtimes', `${id}.json`), 'utf8'));
  return {
    id, provider, verified: false, supports: doc().supports,
    async discoverModels() { return { models: [], reason: 'UNVERIFIED_ADAPTER' }; },
    normaliseProfile(raw, ctx) { return makeProfile({ provider, runtime: id, providerModelId: raw.id, lastValidated: ctx.nowIso }, {}); },
    classifyError() { return null; },
  };
}
