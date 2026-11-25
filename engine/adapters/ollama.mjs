// @ts-check
// File:    engine/adapters/ollama.mjs
// Purpose: Local models run through Ollama (Qwen and others). Not yet tried against a real install, so
//          unverified. It asks `ollama list` what is installed, so new local models appear with no plugin
//          update. A model's strength is only a guess from its size and is marked as a guess; models Ollama
//          runs on its own paid servers (names ending -cloud) are treated as unpriced cloud models.
import { makeProfile } from './base.mjs';
import { parseOllamaList, guessLocalTier } from '../lib/discover.mjs';

/** @type {import('./base.mjs').Adapter} */
export const ollama = {
  id: 'ollama', provider: 'ollama', verified: false,
  supports: { filesystem: 'UNKNOWN', shell: 'UNKNOWN', git: 'UNKNOWN', tests: 'UNKNOWN', mcp: 'UNKNOWN', subagents: false, structuredOutput: 'UNKNOWN', reasoningControl: false, contextIsolation: 'UNKNOWN', sessionResume: false, checkpointResume: 'UNKNOWN', network: false, reviewMode: 'UNKNOWN' },
  async discoverModels({ run }) {
    try {
      const { stdout } = await run('ollama', ['list'], { timeout: 8000 });
      const names = parseOllamaList(String(stdout));
      return names.length ? { models: names.map((n) => ({ id: n, facts: { cloud: /(^|[:-])cloud$/i.test(n) } })) } : { models: [], reason: 'ollama lists no models' };
    } catch { return { models: [], reason: 'ollama is not installed or did not answer' }; }
  },
  normaliseProfile(raw, ctx) {
    const cloud = /** @type {any} */ (raw.facts).cloud === true;
    return makeProfile({ provider: 'ollama', runtime: 'ollama', providerModelId: raw.id, availability: 'AVAILABLE', lifecycleStatus: 'ACTIVE', capabilityTier: guessLocalTier(raw.id), canaryStage: 'PROVISIONAL', monetaryCost: cloud ? 'UNKNOWN' : 0, relativeCostClass: cloud ? 'UNKNOWN' : 1, runtimeCapabilities: this.supports, confidence: 0.3, lastValidated: ctx.nowIso },
      { providerModelId: 'RUNTIME_DISCOVERY', availability: 'RUNTIME_DISCOVERY', capabilityTier: 'HEURISTIC', ...(cloud ? {} : { monetaryCost: 'COMPAT_DATA' }) });
  },
  classifyError() { return null; },
};
