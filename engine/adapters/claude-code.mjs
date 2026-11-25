// @ts-check
// File:    engine/adapters/claude-code.mjs
// Purpose: Claude Code (verified). Models are the aliases in engine/data/compat/claude-aliases.json,
//          the same table as model-routing.md. There is no per-model listing to ask for, so availability
//          is just "this session is logged in", reduced to a yes/no and never printed.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pluginRoot } from '../lib/paths.mjs';
import { makeProfile } from './base.mjs';

const aliases = () => JSON.parse(readFileSync(join(pluginRoot(), 'engine', 'data', 'compat', 'claude-aliases.json'), 'utf8')).aliases;

/** @type {import('./base.mjs').Adapter} */
export const claudeCode = {
  id: 'claude-code', provider: 'anthropic', verified: true,
  supports: { filesystem: true, shell: true, git: true, tests: true, mcp: true, subagents: true, structuredOutput: true, reasoningControl: true, contextIsolation: true, sessionResume: 'UNKNOWN', checkpointResume: true, network: true, reviewMode: true },
  async discoverModels({ run }) {
    let loggedIn = 'UNKNOWN';
    try { const { stdout } = await run('claude', ['auth', 'status', '--json'], { timeout: 5000 }); const j = JSON.parse(String(stdout)); loggedIn = j && j.loggedIn === true ? true : 'UNKNOWN'; } catch { /* stays UNKNOWN */ }
    return { models: aliases().map((a) => ({ id: a.alias, facts: { ...a, loggedIn } })) };
  },
  normaliseProfile(raw, ctx) {
    const f = /** @type {any} */ (raw.facts);
    return makeProfile({
      provider: 'anthropic', runtime: 'claude-code', providerModelId: raw.id,
      availability: f.loggedIn === true ? 'AVAILABLE' : 'UNKNOWN', lifecycleStatus: 'ACTIVE',
      contextWindow: f.contextWindow ?? 'UNKNOWN', reasoningControls: f.effortLevels, runtimeCapabilities: this.supports,
      capabilityTier: f.tier, canaryStage: f.trust === 'maintained' ? 'TRUSTED' : 'PROVISIONAL',
      relativeCostClass: f.relativeCostClass, confidence: 0.8, lastValidated: ctx.nowIso,
    }, { providerModelId: 'COMPAT_DATA', lifecycleStatus: 'COMPAT_DATA', capabilityTier: 'HEURISTIC', reasoningControls: 'COMPAT_DATA', canaryStage: 'COMPAT_DATA', relativeCostClass: 'COMPAT_DATA', ...(f.loggedIn === true ? { availability: 'RUNTIME_DISCOVERY' } : {}), lastValidated: 'RUNTIME_DISCOVERY' });
  },
  classifyError(text) { return /model.*(not found|unavailable|does not exist)/i.test(text) ? 'MODEL_UNAVAILABLE' : /rate limit|usage limit/i.test(text) ? 'QUOTA_EXHAUSTED' : null; },
};
