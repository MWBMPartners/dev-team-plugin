// @ts-check
// File:    engine/sim/run.mjs
// Purpose: Runs one scenario file against pretend providers and a pretend clock, and says which of its
//          expectations held. A scenario is a list of steps (discover, remove a model, fail a provider,
//          advance the clock) followed by expectations about the resulting profiles.
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discover } from '../lib/discovery.mjs';
import { FakeClock } from './clock.mjs';
import { SyntheticProvider } from './providers.mjs';

/** @param {string} file @returns {Promise<{name: string, assertions: {name: string, ok: boolean, detail: string}[]}>} */
export async function runScenario(file) {
  const sc = JSON.parse(readFileSync(file, 'utf8'));
  const providers = sc.providers.map((p) => new SyntheticProvider(p));
  const clock = new FakeClock();
  const dataDir = mkdtempSync(join(tmpdir(), 'dt-sim-'));
  let last = { profiles: [], removed: [], problems: [], stale: [] };
  for (const step of sc.steps) {
    const p = providers.find((x) => x.id === step.provider);
    if (step.do === 'discover') last = await discover({ adapters: providers, dataDir, run: async () => { throw new Error('no commands in a simulation'); }, home: dataDir, now: () => clock.now(), refresh: step.refresh === true });
    else if (step.do === 'remove' && p) p.models = p.models.filter((m) => m.id !== step.model);
    else if (step.do === 'add' && p) p.models.push({ id: step.model, tier: step.tier });
    else if (step.do === 'fail' && p) p.failing = true;
    else if (step.do === 'recover' && p) p.failing = false;
    else if (step.do === 'advance') clock.advance(step.hours * 3600 * 1000);
    else throw new Error(`unknown scenario step "${step.do}"`);
  }
  const assertions = sc.expect.map((e) => {
    const prof = last.profiles.find((x) => x.runtime === e.provider && x.providerModelId === e.model);
    let ok, detail;
    if (e.lifecycle !== undefined) { ok = prof?.lifecycleStatus === e.lifecycle; detail = `${e.provider}/${e.model} lifecycle ${prof?.lifecycleStatus ?? 'missing'}, wanted ${e.lifecycle}`; }
    else if (e.stale !== undefined) { ok = last.stale.includes(e.provider) === e.stale; detail = `${e.provider} stale=${last.stale.includes(e.provider)}, wanted ${e.stale}`; }
    else if (e.problem !== undefined) { ok = last.problems.some((p) => p.code === e.problem); detail = `problem ${e.problem} ${ok ? 'reported' : 'not reported'}`; }
    else { ok = false; detail = 'expectation has no recognised check'; }
    return { name: e.name ?? detail, ok, detail };
  });
  return { name: sc.name, assertions };
}
