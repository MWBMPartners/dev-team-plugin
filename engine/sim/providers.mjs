// @ts-check
// File:    engine/sim/providers.mjs
// Purpose: Pretend providers for the simulator. Each one lists the models a scenario gives it and can be
//          told to fail or to drop a model, so discovery can be tested with no real account.
import { makeProfile, unknownCapabilities } from '../adapters/base.mjs';

export class SyntheticProvider {
  /** @param {{id: string, models: {id: string, tier?: number}[]}} spec */
  constructor(spec) { this.id = spec.id; this.provider = `synthetic-${spec.id}`; this.verified = false; this.supports = unknownCapabilities(); this.models = spec.models.map((m) => ({ ...m })); this.failing = false; }
  async discoverModels() { return this.failing ? { models: [], reason: 'synthetic failure' } : { models: this.models.map((m) => ({ id: m.id, facts: m })) }; }
  /** @param {any} raw @param {{nowIso: string}} ctx */
  normaliseProfile(raw, ctx) {
    return makeProfile({ provider: this.provider, runtime: this.id, providerModelId: raw.id, availability: 'AVAILABLE', lifecycleStatus: 'ACTIVE', capabilityTier: raw.facts.tier ?? 'UNKNOWN', lastValidated: ctx.nowIso, confidence: 0.5 }, { providerModelId: 'RUNTIME_DISCOVERY' });
  }
  classifyError() { return null; }
}
