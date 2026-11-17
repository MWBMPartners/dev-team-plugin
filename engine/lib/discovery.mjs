// @ts-check
// File:    engine/lib/discovery.mjs
// Purpose: Finds which models each adapter says exist, turns them into complete profiles, and keeps a
//          cache per provider. It handles models that disappear (marked RETIRED? the first time, RETIRED
//          the second) and failures (the previous cache is kept, marked stale, and the reason is reported;
//          a good cache is never replaced by an empty one).
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { writeJsonAtomic } from './store.mjs';

const TTL_HOURS = 24;

/**
 * @param {{adapters: any[], dataDir: string, run: Function, home: string, now?: () => number, refresh?: boolean, providers?: string[]}} o
 */
export async function discover(o) {
  const now = o.now ?? Date.now;
  const nowIso = new Date(now()).toISOString();
  const out = { profiles: [], removed: [], cacheWrites: [], problems: [], stale: [] };
  for (const a of o.adapters) {
    if (o.providers && !o.providers.includes(a.id)) continue;
    const path = join(o.dataDir, 'catalogue', `${a.id}.json`);
    let prev = null;
    if (existsSync(path)) { try { prev = JSON.parse(readFileSync(path, 'utf8')); } catch { out.problems.push({ code: 'CACHE_UNREADABLE', message: `${a.id}: the cache file could not be read and is ignored` }); } }
    const fresh = prev && !o.refresh && (now() - Date.parse(prev.fetchedAt)) < TTL_HOURS * 3600 * 1000 && !prev.stale;
    if (fresh) { out.profiles.push(...prev.profiles); continue; }

    let found;
    try { found = await a.discoverModels({ run: o.run, home: o.home }); } catch (e) { found = { models: [], reason: 'adapter threw' }; }
    if (!found.models.length) {
      // Discovery failed or found nothing: keep what we had and say why. Never write an empty cache.
      out.problems.push({ code: 'DISCOVERY_FAILED', message: `${a.id}: ${found.reason ?? 'no models found'}` });
      if (prev) { const kept = { ...prev, stale: true }; writeJsonAtomic(path, kept); out.cacheWrites.push(path); out.profiles.push(...kept.profiles); out.stale.push(a.id); }
      continue;
    }
    const ctx = { nowIso };
    const profiles = found.models.map((m) => a.normaliseProfile(m, ctx));
    const seen = new Set(profiles.map((p) => p.providerModelId));
    for (const old of prev?.profiles ?? []) {
      if (seen.has(old.providerModelId)) continue;
      // A model that was there and now is not: first time RETIRED?, second time RETIRED.
      const status = old.lifecycleStatus === 'RETIRED?' || old.lifecycleStatus === 'RETIRED' ? 'RETIRED' : 'RETIRED?';
      const carried = { ...old, lifecycleStatus: status, confidence: status === 'RETIRED' ? 1 : 0.5, lastValidated: nowIso };
      profiles.push(carried);
      out.removed.push({ provider: a.id, model: old.providerModelId, status });
    }
    writeJsonAtomic(path, { fetchedAt: nowIso, ttlHours: TTL_HOURS, stale: false, profiles });
    out.cacheWrites.push(path);
    out.profiles.push(...profiles);
  }
  return out;
}
