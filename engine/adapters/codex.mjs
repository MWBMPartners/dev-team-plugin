// @ts-check
// File:    engine/adapters/codex.mjs
// Purpose: Codex (verified as worker and reviewer). Asks `codex debug models` for the model list, falls
//          back to Codex's own cached list (read-only), and keeps ONLY a short allow-list of fields:
//          the long prompt text in the dump is never kept. It never opens Codex's login file; "logged in"
//          comes from `codex login status` and is reduced to a yes/no.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pluginRoot } from '../lib/paths.mjs';
import { readSimpleToml } from '../lib/toml.mjs';
import { makeProfile } from './base.mjs';

const KEEP = ['slug', 'display_name', 'context_window', 'supported_reasoning_levels', 'default_reasoning_level', 'visibility', 'priority', 'upgrade', 'supported_in_api'];
const families = () => JSON.parse(readFileSync(join(pluginRoot(), 'engine', 'data', 'compat', 'openai-families.json'), 'utf8')).families;
const pick = (o) => Object.fromEntries(KEEP.filter((k) => o && Object.hasOwn(o, k)).map((k) => [k, o[k]]));
const listOf = (j) => (Array.isArray(j) ? j : Array.isArray(j?.models) ? j.models : []);

/** @type {import('./base.mjs').Adapter} */
export const codex = {
  id: 'codex', provider: 'openai', verified: true,
  supports: { filesystem: true, shell: true, git: true, tests: true, mcp: true, subagents: false, structuredOutput: true, reasoningControl: true, contextIsolation: true, sessionResume: true, checkpointResume: true, network: true, reviewMode: true },
  async discoverModels({ run, home }) {
    let loggedIn = false;
    try { await run('codex', ['login', 'status'], { timeout: 5000 }); loggedIn = true; } catch { loggedIn = false; }
    let live = null, reason;
    try { const { stdout } = await run('codex', ['debug', 'models'], { timeout: 5000 }); live = listOf(JSON.parse(String(stdout))); } catch { reason = 'codex debug models failed'; }
    let source = 'live';
    if (!live || live.length === 0) {
      const cachePath = join(home, '.codex', 'models_cache.json');
      try { live = existsSync(cachePath) ? listOf(JSON.parse(readFileSync(cachePath, 'utf8'))) : []; source = 'cache-file'; } catch { live = []; }
      if (live.length === 0) return { models: [], reason: reason ?? 'no Codex model list found' };
    }
    let cfg = {};
    try { const p = join(home, '.codex', 'config.toml'); if (existsSync(p)) cfg = readSimpleToml(readFileSync(p, 'utf8')).values; } catch { /* ignore */ }
    return { models: live.map((m) => ({ id: String(m.slug), facts: { ...pick(m), loggedIn, source, configEffort: cfg.model_reasoning_effort ?? null } })) };
  },
  normaliseProfile(raw, ctx) {
    const f = /** @type {any} */ (raw.facts);
    const fam = families().find((x) => raw.id.startsWith(x.prefix));
    const lifecycle = f.upgrade ? 'LEGACY' : f.visibility === 'list' ? 'ACTIVE' : 'UNKNOWN';
    const available = f.source === 'live' && f.loggedIn === true ? 'AVAILABLE' : 'UNKNOWN';
    const prov = { providerModelId: 'RUNTIME_DISCOVERY', lifecycleStatus: 'RUNTIME_DISCOVERY', lastValidated: 'RUNTIME_DISCOVERY', relativeCostClass: 'COMPAT_DATA' };
    if (available === 'AVAILABLE') prov.availability = 'RUNTIME_DISCOVERY';
    if (typeof f.context_window === 'number') prov.contextWindow = 'RUNTIME_DISCOVERY';
    if (Array.isArray(f.supported_reasoning_levels)) prov.reasoningControls = 'RUNTIME_DISCOVERY';
    if (fam) prov.capabilityTier = 'HEURISTIC';
    return makeProfile({
      provider: 'openai', runtime: 'codex', providerModelId: raw.id, availability: available, lifecycleStatus: lifecycle,
      contextWindow: typeof f.context_window === 'number' ? f.context_window : 'UNKNOWN',
      reasoningControls: Array.isArray(f.supported_reasoning_levels) ? f.supported_reasoning_levels : 'UNKNOWN',
      defaultReasoning: f.configEffort ?? f.default_reasoning_level ?? 'UNKNOWN',
      runtimeCapabilities: this.supports, capabilityTier: fam ? fam.tierHint : 'UNKNOWN', canaryStage: fam ? 'VALIDATED' : 'PROVISIONAL',
      relativeCostClass: 2, confidence: fam ? 0.6 : 0.3, lastValidated: ctx.nowIso,
    }, prov);
  },
  classifyError(text) { return /usage limit|rate limit|capacity/i.test(text) ? 'QUOTA_EXHAUSTED' : /model.*(not found|unavailable)/i.test(text) ? 'MODEL_UNAVAILABLE' : null; },
};
