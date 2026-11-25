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
const listOf = (j) => {
  const raw = Array.isArray(j) ? j : Array.isArray(j?.models) ? j.models : [];
  const seen = new Set();
  // Keep only real entries: an object with a non-empty text slug, once each.
  return raw.filter((m) => m && typeof m === 'object' && typeof m.slug === 'string' && m.slug.trim() !== '' && !seen.has(m.slug) && seen.add(m.slug));
};

/** @type {import('./base.mjs').Adapter} */
export const codex = {
  id: 'codex', provider: 'openai', verified: true,
  supports: { filesystem: true, shell: true, git: true, tests: true, mcp: true, subagents: false, structuredOutput: true, reasoningControl: true, contextIsolation: true, sessionResume: true, checkpointResume: true, network: true, reviewMode: true },
  async discoverModels({ run, home }) {
    let loggedIn = false;
    // Logged in only if the command succeeds AND its text says so; the text itself is not kept.
    try { const { stdout } = await run('codex', ['login', 'status'], { timeout: 5000 }); const s = String(stdout ?? ''); loggedIn = /logged in/i.test(s) && !/not logged in/i.test(s); } catch { loggedIn = false; }
    let live = null, reason;
    try { const { stdout } = await run('codex', ['debug', 'models'], { timeout: 5000 }); live = listOf(JSON.parse(String(stdout))); } catch { reason = 'codex debug models failed'; }
    let source = 'live';
    if (!live || live.length === 0) {
      const cachePath = join(home, '.codex', 'models_cache.json');
      try { live = existsSync(cachePath) ? listOf(JSON.parse(readFileSync(cachePath, 'utf8'))) : []; source = 'cache-file'; } catch { live = []; }
      if (live.length === 0) return { models: [], reason: reason ?? 'no Codex model list found' };
    }
    const isLive = source === 'live';
    let cfg = {};
    try { const p = join(home, '.codex', 'config.toml'); if (existsSync(p)) cfg = readSimpleToml(readFileSync(p, 'utf8')).values; } catch { /* ignore */ }
    return { live: isLive, models: live.map((m) => ({ id: String(m.slug), facts: { ...pick(m), loggedIn, source, configEffort: cfg.model_reasoning_effort ?? null } })) };
  },
  normaliseProfile(raw, ctx) {
    const f = /** @type {any} */ (raw.facts);
    const fam = families().find((x) => raw.id.startsWith(x.prefix));
    const lifecycle = f.upgrade ? 'LEGACY' : f.visibility === 'list' ? 'ACTIVE' : 'UNKNOWN';
    const available = f.source === 'live' && f.loggedIn === true ? 'AVAILABLE' : 'UNKNOWN';
    const prov = { providerModelId: 'RUNTIME_DISCOVERY', lifecycleStatus: 'RUNTIME_DISCOVERY', lastValidated: 'RUNTIME_DISCOVERY', relativeCostClass: 'COMPAT_DATA' };
    if (available === 'AVAILABLE') prov.availability = 'RUNTIME_DISCOVERY';
    if (Number.isInteger(f.context_window)) prov.contextWindow = 'RUNTIME_DISCOVERY';
    const defEffort = typeof f.configEffort === 'string' ? f.configEffort : typeof f.default_reasoning_level === 'string' ? f.default_reasoning_level : null;
    if (Array.isArray(f.supported_reasoning_levels) && f.supported_reasoning_levels.every((x) => typeof x === 'string')) prov.reasoningControls = 'RUNTIME_DISCOVERY';
    if (fam) { prov.capabilityTier = 'HEURISTIC'; prov.canaryStage = 'COMPAT_DATA'; }
    if (defEffort) prov.defaultReasoning = 'RUNTIME_DISCOVERY';
    return makeProfile({
      provider: 'openai', runtime: 'codex', providerModelId: raw.id, availability: available, lifecycleStatus: lifecycle,
      contextWindow: Number.isInteger(f.context_window) ? f.context_window : 'UNKNOWN',
      reasoningControls: Array.isArray(f.supported_reasoning_levels) && f.supported_reasoning_levels.every((x) => typeof x === 'string') ? f.supported_reasoning_levels : 'UNKNOWN',
      defaultReasoning: defEffort ?? 'UNKNOWN',
      runtimeCapabilities: this.supports, capabilityTier: fam ? fam.tierHint : 'UNKNOWN', canaryStage: fam ? 'VALIDATED' : 'PROVISIONAL',
      relativeCostClass: 2, confidence: fam ? 0.6 : 0.3, lastValidated: ctx.nowIso,
    }, prov);
  },
  classifyError(text) { return /usage limit|rate limit|capacity/i.test(text) ? 'QUOTA_EXHAUSTED' : /model.*(not found|unavailable)/i.test(text) ? 'MODEL_UNAVAILABLE' : null; },
};
