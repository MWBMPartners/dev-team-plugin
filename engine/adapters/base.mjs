// @ts-check
// File:    engine/adapters/base.mjs
// Purpose: The shape every provider/runtime adapter follows, and helpers shared by all of them.
//          Central routing never names a provider or a model: it only reads the profiles adapters make.
//          (Departure from the plan, listed in docs/orchestrator/departures.md: each adapter is ONE file
//          holding its provider, runtime and quota parts, rather than three files.)

/**
 * @typedef {Object} RawModel  what an adapter found, before it is turned into a profile
 * @property {string} id
 * @property {Record<string, unknown>} [facts]
 *
 * @typedef {Object} Adapter
 * @property {string} id            the runtime name, e.g. 'claude-code'
 * @property {string} provider      the provider word, e.g. 'anthropic'
 * @property {boolean} verified     false = documented but never tried against a real account
 * @property {Record<string, boolean|'UNKNOWN'>} supports   what the runtime can do
 * @property {(ctx: {run: Function, home: string}) => Promise<{models: RawModel[], reason?: string}>} discoverModels  never throws
 * @property {(raw: RawModel, ctx: any) => Record<string, unknown>} normaliseProfile
 * @property {(text: string) => (string|null)} classifyError   a failure class name, or null
 */

export const CAPABILITY_KEYS = ['filesystem', 'shell', 'git', 'tests', 'mcp', 'subagents', 'structuredOutput', 'reasoningControl', 'contextIsolation', 'sessionResume', 'checkpointResume', 'network', 'reviewMode'];

/** A `supports` map where nothing is known. */
export function unknownCapabilities() { return Object.fromEntries(CAPABILITY_KEYS.map((k) => [k, 'UNKNOWN'])); }

/**
 * A complete profile with every field present: UNKNOWN where nothing is known, and a provenance entry
 * only for the fields that were actually filled in.
 * @param {Record<string, unknown>} known @param {Record<string, string>} provenance
 */
export function makeProfile(known, provenance) {
  const base = {
    provider: 'UNKNOWN', runtime: 'UNKNOWN', providerModelId: 'UNKNOWN', availability: 'UNKNOWN', lifecycleStatus: 'UNKNOWN',
    contextWindow: 'UNKNOWN', reasoningControls: 'UNKNOWN', defaultReasoning: 'UNKNOWN', runtimeCapabilities: 'UNKNOWN',
    capabilityTier: 'UNKNOWN', canaryStage: 'UNKNOWN', latencyClass: 'UNKNOWN', monetaryCost: 'UNKNOWN', tokenCost: 'UNKNOWN',
    creditCost: 'UNKNOWN', pricing: 'UNKNOWN', rateLimits: 'UNKNOWN', relativeCostClass: 'UNKNOWN', confidence: 0, lastValidated: 'UNKNOWN',
  };
  return { ...base, ...known, provenance };
}
