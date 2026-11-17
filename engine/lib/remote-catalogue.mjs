// @ts-check
// File:    engine/lib/remote-catalogue.mjs
// Purpose: Fetching a signed catalogue from a web address, safely. It does nothing unless an address is given; it only
//          uses https; it limits the size of the answer; it keeps the last good copy for 24 hours; and a copy that fails
//          verification is thrown away with a warning, never used unsigned. An unreachable service is not an error.
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { verifyEnvelope } from './signature.mjs';
import { writeJsonAtomic } from './store.mjs';

const TTL_MS = 24 * 3600 * 1000, MAX_BYTES = 1024 * 1024;

/** @param {{url?: string|null, dataDir: string, fetchImpl?: Function, now?: Date, publicKeyPem?: string, refresh?: boolean}} o */
export async function fetchCatalogue({ url = null, dataDir, fetchImpl = globalThis.fetch, now = new Date(), publicKeyPem, refresh = false }) {
  if (!url) return { status: 'NOT_CONFIGURED', note: 'No catalogue address is configured, so nothing was fetched.' };
  let u; try { u = new URL(url); } catch { return { status: 'IGNORED', note: 'The catalogue address is not a valid web address.' }; }
  if (u.protocol !== 'https:') return { status: 'IGNORED', note: 'Only https addresses are used.' };
  const cache = join(dataDir, 'remote-catalogue', 'envelope.json');
  if (!refresh && existsSync(cache)) {
    try { const c = JSON.parse(readFileSync(cache, 'utf8')); if (now.getTime() - Date.parse(c.fetchedAt) < TTL_MS && now.getTime() >= Date.parse(c.fetchedAt)) { const v = verifyEnvelope(c.envelope, { publicKeyPem, now }); if (v.ok) return { status: 'CACHED', payload: v.payload }; } } catch { /* fall through and fetch again */ }
  }
  let text;
  try {
    const res = await fetchImpl(u.href, { redirect: 'error', signal: AbortSignal.timeout(8000), headers: { accept: 'application/json' } });
    if (!res.ok) return { status: 'UNREACHABLE', note: 'The catalogue service did not answer successfully; carrying on without it.' };
    const declared = Number(res.headers?.get?.('content-length') ?? 0);
    if (declared > MAX_BYTES) return { status: 'REJECTED', note: 'The catalogue answer was too large and was ignored.' };
    // Read at most MAX_BYTES bytes, counted as bytes, and stop reading beyond that.
    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader(); const chunks = []; let n = 0;
      for (;;) { const { done, value } = await reader.read(); if (done) break; n += value.byteLength; if (n > MAX_BYTES) { try { await reader.cancel(); } catch { /* ignore */ } return { status: 'REJECTED', note: 'The catalogue answer was too large and was ignored.' }; } chunks.push(value); }
      text = Buffer.concat(chunks).toString('utf8');
    } else { text = await res.text(); if (Buffer.byteLength(text, 'utf8') > MAX_BYTES) return { status: 'REJECTED', note: 'The catalogue answer was too large and was ignored.' }; }
  } catch { return { status: 'UNREACHABLE', note: 'The catalogue service could not be reached; carrying on without it.' }; }
  let env; try { env = JSON.parse(text); } catch { return { status: 'REJECTED', note: 'The catalogue answer was not valid JSON and was ignored.' }; }
  const v = verifyEnvelope(env, { publicKeyPem, now });
  if (!v.ok) return { status: 'REJECTED', note: `The catalogue failed verification (${v.reason}) and was ignored. It is never used unsigned.` };
  mkdirSync(join(dataDir, 'remote-catalogue'), { recursive: true });
  writeJsonAtomic(cache, { fetchedAt: now.toISOString(), envelope: env });
  return { status: 'FETCHED', payload: v.payload };
}
