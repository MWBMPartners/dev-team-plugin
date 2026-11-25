// @ts-check
// File:    engine/lib/signature.mjs
// Purpose: Checks a catalogue file that came from outside (a future service run by the owner). It is accepted only if it
//          carries a valid Ed25519 signature made with the key pinned in engine/data/catalogue-public-key.pem, has not
//          expired, and its content has no way to say anything about floors, gates or approvals. If any check fails the
//          file is ignored; it is never "used unsigned". No private key is ever kept here: the only key in this
//          repository is the public one.
//          NOTE: the pinned key in this repository is a PLACEHOLDER. Nobody holds its private half, so today nothing
//          can verify. The owner replaces the file with the real service's public key when the service exists.
import { createHash, createPublicKey, verify, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalJson } from './canonical.mjs';
import { pluginRoot } from './paths.mjs';

export const pinnedKeyPem = () => readFileSync(join(pluginRoot(), 'engine', 'data', 'catalogue-public-key.pem'), 'utf8');
/** A short name for a public key: the first 16 hex digits of the hash of its DER form. */
export const keyIdOf = (pem) => createHash('sha256').update(createPublicKey(pem).export({ type: 'spki', format: 'der' })).digest('hex').slice(0, 16);

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const ALLOWED_PAYLOAD_KEYS = ['catalogueVersion', 'models'];
const ALLOWED_MODEL_KEYS = ['provider', 'id', 'tierHint', 'notes'];

/** The payload may only carry model hints. Any other key (floors, gates, approvals, anything) fails. */
export function checkPayloadShape(p) {
  const bad = [];
  if (!p || typeof p !== 'object' || Array.isArray(p)) return ['the payload must be an object'];
  for (const k of Object.keys(p)) if (!ALLOWED_PAYLOAD_KEYS.includes(k)) bad.push(`the payload may not contain "${k}"`);
  if (!Number.isInteger(p.catalogueVersion) || p.catalogueVersion < 1) bad.push('catalogueVersion must be a whole number of at least 1');
  if (!Array.isArray(p.models)) bad.push('models must be a list');
  else p.models.forEach((m, i) => {
    if (!m || typeof m !== 'object' || Array.isArray(m)) { bad.push(`models[${i}] must be an object`); return; }
    for (const k of Object.keys(m)) if (!ALLOWED_MODEL_KEYS.includes(k)) bad.push(`models[${i}] may not contain "${k}"`);
    if (typeof m.provider !== 'string' || typeof m.id !== 'string' || m.provider === '' || m.id === '') bad.push(`models[${i}] needs a provider and an id`);
    if (!Number.isInteger(m.tierHint) || m.tierHint < 1 || m.tierHint > 4) bad.push(`models[${i}].tierHint must be 1 to 4`);
    if (m.notes !== undefined && typeof m.notes !== 'string') bad.push(`models[${i}].notes must be text`);
  });
  return bad;
}

/**
 * @param {any} env {payload, signature, keyId, issuedAt, expiresAt}
 * @param {{publicKeyPem?: string, now?: Date}} [o]
 * @returns {{ok: boolean, reason: string, payload?: any}}
 */
export function verifyEnvelope(env, { publicKeyPem = pinnedKeyPem(), now = new Date() } = {}) {
  if (!env || typeof env !== 'object' || Array.isArray(env)) return { ok: false, reason: 'not a catalogue envelope' };
  for (const k of Object.keys(env)) if (!['payload', 'signature', 'keyId', 'issuedAt', 'expiresAt'].includes(k)) return { ok: false, reason: `the envelope may not contain "${k}"` };
  // The signature must be written in exactly one way: standard base64 with padding that decodes to 64 bytes.
  if (typeof env.signature !== 'string' || !B64.test(env.signature) || env.signature.length > 200) return { ok: false, reason: 'the signature is missing or not valid base64' };
  { const raw = Buffer.from(env.signature, 'base64'); if (raw.length !== 64 || raw.toString('base64') !== env.signature) return { ok: false, reason: 'the signature is not in its one valid written form (64 bytes, standard base64)' }; }
  if (typeof env.keyId !== 'string' || typeof env.issuedAt !== 'string' || typeof env.expiresAt !== 'string' || !ISO.test(env.issuedAt) || !ISO.test(env.expiresAt)) return { ok: false, reason: 'keyId, issuedAt and expiresAt are needed (times in UTC ISO form)' };
  let pubId; try { pubId = keyIdOf(publicKeyPem); } catch { return { ok: false, reason: 'the pinned public key cannot be read' }; }
  if (env.keyId !== pubId) return { ok: false, reason: 'the envelope names a different key than the pinned one' };
  // Dates must be real, in order, and not valid for longer than 30 days.
  const iat = Date.parse(env.issuedAt), eat = Date.parse(env.expiresAt);
  const realIso = (s, ms) => Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 19) === s.slice(0, 19);
  if (!realIso(env.issuedAt, iat) || !realIso(env.expiresAt, eat)) return { ok: false, reason: 'issuedAt and expiresAt must be real dates and times' };
  if (eat <= iat) return { ok: false, reason: 'the catalogue expires before it was issued' };
  if (eat - iat > 30 * 86400000) return { ok: false, reason: 'the catalogue is valid for longer than 30 days' };
  const shape = checkPayloadShape(env.payload); if (shape.length) return { ok: false, reason: shape[0] };
  let good = false;
  try { good = verify(null, Buffer.from(canonicalJson({ payload: env.payload, keyId: env.keyId, issuedAt: env.issuedAt, expiresAt: env.expiresAt }), 'utf8'), createPublicKey(publicKeyPem), Buffer.from(env.signature, 'base64')); } catch { good = false; }
  if (!good) return { ok: false, reason: 'the signature does not match' };
  const t = now.getTime();
  if (Date.parse(env.expiresAt) <= t) return { ok: false, reason: 'the catalogue has expired' };
  if (Date.parse(env.issuedAt) > t + 5 * 60000) return { ok: false, reason: 'the catalogue is dated in the future' };
  return { ok: true, reason: 'valid', payload: env.payload };
}

/** For tests and for the future service: sign a payload. Takes a private key PEM; this repository never contains one. */
export function signEnvelope(payload, privateKeyPem, { issuedAt, expiresAt, publicKeyPem }) {
  const keyId = keyIdOf(publicKeyPem);
  const signature = sign(null, Buffer.from(canonicalJson({ payload, keyId, issuedAt, expiresAt }), 'utf8'), privateKeyPem).toString('base64');
  return { payload, signature, keyId, issuedAt, expiresAt };
}

/**
 * Add what a verified remote catalogue knows, WITHOUT overriding anything better: a hint only fills a field that is
 * still UNKNOWN. Verified runtime data and the maintained tables always win.
 */
export function mergeRemote(profiles, payload) {
  const out = profiles.map((p) => ({ ...p, provenance: { ...(p.provenance ?? {}) } }));
  const applied = [];
  for (const h of payload.models) {
    const p = out.find((x) => String(x.providerModelId).toLowerCase() === h.id.toLowerCase() && String(x.provider).toLowerCase() === h.provider.toLowerCase());
    if (p && p.capabilityTier === 'UNKNOWN') { p.capabilityTier = h.tierHint; p.provenance.capabilityTier = 'REMOTE_CATALOGUE'; p.confidence = Math.min(p.confidence ?? 0.5, 0.5); applied.push(`${h.provider}/${h.id}`); }
  }
  return { profiles: out, applied };
}
