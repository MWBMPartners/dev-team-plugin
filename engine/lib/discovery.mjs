// @ts-check
// File:    engine/lib/discovery.mjs
// Purpose: Finds which models each adapter says exist, turns them into complete profiles, and keeps a
//          cache per provider. It handles models that disappear (marked RETIRED? the first time, RETIRED
//          the second) and failures (the previous cache is kept, marked stale, and the reason is reported;
//          a good cache is never replaced by an empty one).
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { writeJsonAtomic } from './store.mjs';
import { validate, loadSchema } from './schema.mjs';
import { pluginRoot } from './paths.mjs';
import { event } from './log.mjs';

const TTL_HOURS = 24;

/**
 * @param {{adapters: any[], dataDir: string, run: Function, home: string, now?: () => number, refresh?: boolean, providers?: string[], eventDir?: string}} o
 */
export async function discover(o) {
  const now = o.now ?? Date.now;
  const nowIso = new Date(now()).toISOString();
  const out = { profiles: [], removed: [], cacheWrites: [], problems: [], stale: [] };
  const cacheSchema = loadSchema(join(pluginRoot(), 'schemas', 'local', 'catalogue-cache.schema.json'));
  const log = (name, data) => { if (o.eventDir) { try { event(o.eventDir, name, data, new Date(now())); } catch { /* logging must never stop discovery */ } } };
  for (const a of o.adapters) {
    if (o.providers && !o.providers.includes(a.id)) continue;
    const path = join(o.dataDir, 'catalogue', `${a.id}.json`);
    let prev = null;
    if (existsSync(path)) {
      // A saved list is trusted only if it parses AND matches its schema; otherwise it is reported and ignored.
      try { const j = JSON.parse(readFileSync(path, 'utf8')); if (validate(cacheSchema, j).ok) prev = j; else throw new Error('shape'); }
      catch { out.problems.push({ code: 'CACHE_UNREADABLE', message: `${a.id}: the cache file could not be read or has the wrong shape, and is ignored` }); }
    }
    const age = prev ? now() - Date.parse(prev.fetchedAt) : NaN;
    const fresh = prev && !o.refresh && prev.profiles.length > 0 && age >= 0 && age < TTL_HOURS * 3600 * 1000 && !prev.stale;
    if (fresh) { out.profiles.push(...prev.profiles); continue; }

    let found;
    try { found = await a.discoverModels({ run: o.run, home: o.home }); } catch (e) { found = { models: [], reason: 'adapter threw' }; }
    if (!found.models.length) {
      // Discovery failed or found nothing: keep what we had and say why. Never write an empty cache.
      out.problems.push({ code: 'DISCOVERY_FAILED', message: `${a.id}: ${found.reason ?? 'no models found'}` });
      log('DISCOVERY_FAILED', { runtime: a.id, reason: found.reason ?? 'no models found' });
      if (prev) { const kept = { ...prev, stale: true }; writeJsonAtomic(path, kept); out.cacheWrites.push(path); out.profiles.push(...kept.profiles); out.stale.push(a.id); }
      continue;
    }
    const ctx = { nowIso };
    const profiles = found.models.map((m) => a.normaliseProfile(m, ctx));
    const seen = new Set(profiles.map((p) => p.providerModelId));
    for (const old of prev?.profiles ?? []) {
      if (seen.has(old.providerModelId)) continue;
      if (found.live === false) {
        // The list came from an older saved file, not from the tool asked live. That proves nothing about
        // whether a model is gone, so the old record is carried over unchanged and the count does not advance.
        profiles.push(old);
        continue;
      }
      // A model that was there and now is not: first time RETIRED?, second time RETIRED.
      const status = old.lifecycleStatus === 'RETIRED?' || old.lifecycleStatus === 'RETIRED' ? 'RETIRED' : 'RETIRED?';
      const { availability: _a, ...restProv } = old.provenance ?? {};
      const carried = { ...old, availability: 'UNKNOWN', provenance: Object.fromEntries(Object.entries(restProv).filter(([k]) => k !== 'availability')), lifecycleStatus: status, confidence: status === 'RETIRED' ? 1 : 0.5, lastValidated: nowIso };
      profiles.push(carried);
      out.removed.push({ provider: a.id, model: old.providerModelId, status });
      log(status === 'RETIRED' ? 'MODEL_RETIRED' : 'MODEL_RETIRED_CANDIDATE', { runtime: a.id, model: old.providerModelId });
    }
    if (found.live === false) out.problems.push({ code: 'NOT_LIVE_SOURCE', message: `${a.id}: the list came from an older saved file, so no model was marked as gone` });
    log('DISCOVERY_COMPLETED', { runtime: a.id, models: profiles.length });
    writeJsonAtomic(path, { fetchedAt: nowIso, ttlHours: TTL_HOURS, stale: false, profiles });
    out.cacheWrites.push(path);
    out.profiles.push(...profiles);
  }
  return out;
}
