import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { signEnvelope, verifyEnvelope, keyIdOf, checkPayloadShape, mergeRemote, pinnedKeyPem } from '../lib/signature.mjs';
import { fetchCatalogue } from '../lib/remote-catalogue.mjs';

// Keys are made fresh for each test run; no private key is ever kept in the repository.
const pair = () => { const { publicKey, privateKey } = generateKeyPairSync('ed25519'); return { pub: publicKey.export({ type: 'spki', format: 'pem' }), priv: privateKey.export({ type: 'pkcs8', format: 'pem' }) }; };
const K = pair(), OTHER = pair();
const now = new Date('2026-11-17T12:00:00Z');
const payload = { catalogueVersion: 1, models: [{ provider: 'example', id: 'm1', tierHint: 3 }] };
const good = () => signEnvelope(payload, K.priv, { publicKeyPem: K.pub, issuedAt: '2026-11-17T00:00:00Z', expiresAt: '2026-12-17T00:00:00Z' });

test('a valid envelope verifies; the pinned key in the repository is public only and matches no test key', () => {
  assert.equal(verifyEnvelope(good(), { publicKeyPem: K.pub, now }).ok, true);
  assert.match(pinnedKeyPem(), /BEGIN PUBLIC KEY/); assert.ok(!/PRIVATE/.test(pinnedKeyPem()));
  assert.equal(verifyEnvelope(good(), { now }).ok, false); // the pinned key is a placeholder nobody can sign for
});
test('every way to fail is refused: tampered payload, wrong key, expired, future-dated, different key id, extra fields, bad base64', () => {
  const t = good(); t.payload = { ...payload, models: [{ provider: 'example', id: 'm1', tierHint: 4 }] }; assert.equal(verifyEnvelope(t, { publicKeyPem: K.pub, now }).reason, 'the signature does not match');
  const w = signEnvelope(payload, OTHER.priv, { publicKeyPem: K.pub, issuedAt: '2026-11-17T00:00:00Z', expiresAt: '2026-12-17T00:00:00Z' }); assert.equal(verifyEnvelope(w, { publicKeyPem: K.pub, now }).ok, false);
  assert.equal(verifyEnvelope(signEnvelope(payload, K.priv, { publicKeyPem: K.pub, issuedAt: '2026-10-10T00:00:00Z', expiresAt: '2026-11-01T00:00:00Z' }), { publicKeyPem: K.pub, now }).reason, 'the catalogue has expired');
  assert.match(verifyEnvelope(signEnvelope(payload, K.priv, { publicKeyPem: K.pub, issuedAt: '2026-11-18T00:00:00Z', expiresAt: '2026-12-18T00:00:00Z' }), { publicKeyPem: K.pub, now }).reason, /future/);
  assert.match(verifyEnvelope(good(), { publicKeyPem: OTHER.pub, now }).reason, /different key/);
  assert.match(verifyEnvelope({ ...good(), extra: 1 }, { publicKeyPem: K.pub, now }).reason, /may not contain/); assert.match(verifyEnvelope({ ...good(), signature: '!!' }, { publicKeyPem: K.pub, now }).reason, /signature/);
  for (const bad of [null, [], 'x']) assert.equal(verifyEnvelope(bad, { publicKeyPem: K.pub, now }).ok, false);
});
test('a payload that tries to carry floors, gates or approvals fails, even with a valid signature', () => {
  for (const extra of [{ floors: { CODE_REVIEW: 0 } }, { gates: { DEPLOY: 'AUTO' } }, { approvals: [] }]) {
    const p = { ...payload, ...extra }; const env = signEnvelope(p, K.priv, { publicKeyPem: K.pub, issuedAt: '2026-11-17T00:00:00Z', expiresAt: '2026-12-17T00:00:00Z' });
    assert.match(verifyEnvelope(env, { publicKeyPem: K.pub, now }).reason, /may not contain/);
  }
  assert.ok(checkPayloadShape({ catalogueVersion: 1, models: [{ provider: 'a', id: 'b', tierHint: 9 }] }).length); assert.ok(checkPayloadShape({ catalogueVersion: 1, models: [{ provider: 'a', id: 'b', tierHint: 2, floor: 0 }] }).length);
});
test('merging a remote catalogue only fills what is UNKNOWN; verified and maintained data always wins', () => {
  const profiles = [{ provider: 'example', providerModelId: 'm1', capabilityTier: 'UNKNOWN', confidence: 0.9, provenance: {} }, { provider: 'example', providerModelId: 'm2', capabilityTier: 2, confidence: 0.8, provenance: { capabilityTier: 'COMPAT_DATA' } }];
  const r = mergeRemote(profiles, { catalogueVersion: 1, models: [{ provider: 'example', id: 'm1', tierHint: 3 }, { provider: 'example', id: 'm2', tierHint: 4 }] });
  assert.equal(r.profiles[0].capabilityTier, 3); assert.equal(r.profiles[0].provenance.capabilityTier, 'REMOTE_CATALOGUE'); assert.ok(r.profiles[0].confidence <= 0.5);
  assert.equal(r.profiles[1].capabilityTier, 2); assert.deepEqual(r.applied, ['example/m1']);
});
test('fetch: nothing without an address; http refused; unreachable is not an error; a bad signature is rejected and not saved; a good one is cached for 24 hours', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dt-rc-'));
  assert.equal((await fetchCatalogue({ dataDir: dir })).status, 'NOT_CONFIGURED'); assert.equal((await fetchCatalogue({ url: 'http://x.example/c.json', dataDir: dir })).status, 'IGNORED'); assert.equal((await fetchCatalogue({ url: 'nonsense', dataDir: dir })).status, 'IGNORED');
  assert.equal((await fetchCatalogue({ url: 'https://x.example/c.json', dataDir: dir, fetchImpl: async () => { throw new Error('down'); } })).status, 'UNREACHABLE');
  assert.equal((await fetchCatalogue({ url: 'https://x.example/c.json', dataDir: dir, fetchImpl: async () => ({ ok: false }) })).status, 'UNREACHABLE');
  const respond = (obj) => async () => ({ ok: true, text: async () => (typeof obj === 'string' ? obj : JSON.stringify(obj)) });
  const t = good(); t.signature = Buffer.from('x'.repeat(64)).toString('base64');
  assert.equal((await fetchCatalogue({ url: 'https://x.example/c.json', dataDir: dir, fetchImpl: respond(t), publicKeyPem: K.pub, now })).status, 'REJECTED');
  assert.equal((await fetchCatalogue({ url: 'https://x.example/c.json', dataDir: dir, fetchImpl: respond('not json'), publicKeyPem: K.pub, now })).status, 'REJECTED');
  assert.equal((await fetchCatalogue({ url: 'https://x.example/c.json', dataDir: dir, fetchImpl: respond('x'.repeat(2e6)), publicKeyPem: K.pub, now })).status, 'REJECTED');
  assert.equal((await fetchCatalogue({ url: 'https://x.example/c.json', dataDir: dir, fetchImpl: respond('\u00e9'.repeat(600000)), publicKeyPem: K.pub, now })).status, 'REJECTED'); // 1.2 MB in bytes, though only 600000 characters
  assert.equal((await fetchCatalogue({ url: 'https://x.example/c.json', dataDir: dir, fetchImpl: respond(good()), publicKeyPem: K.pub, now })).status, 'FETCHED');
  const again = await fetchCatalogue({ url: 'https://x.example/c.json', dataDir: dir, fetchImpl: async () => { throw new Error('must not be asked'); }, publicKeyPem: K.pub, now: new Date(now.getTime() + 3600000) }); assert.equal(again.status, 'CACHED');
  const later = await fetchCatalogue({ url: 'https://x.example/c.json', dataDir: dir, fetchImpl: async () => { throw new Error('down'); }, publicKeyPem: K.pub, now: new Date(now.getTime() + 25 * 3600000) }); assert.equal(later.status, 'UNREACHABLE');
});

test('dates must be real and in order and valid for at most 30 days; the signature has one written form', () => {
  const sign = (iat, eat) => signEnvelope(payload, K.priv, { publicKeyPem: K.pub, issuedAt: iat, expiresAt: eat });
  for (const [i, e] of [['2026-11-17T00:00:00Z', '2026-99-99T99:99:99Z'], ['2026-99-01T00:00:00Z', '2026-12-01T00:00:00Z'], ['2026-12-01T00:00:00Z', '2026-11-17T00:00:00Z'], ['2026-11-01T00:00:00Z', '2126-11-01T00:00:00Z'], ['2026-02-31T00:00:00Z', '2026-03-10T00:00:00Z']]) assert.equal(verifyEnvelope(sign(i, e), { publicKeyPem: K.pub, now }).ok, false, `${i} ${e}`);
  const g = good(); assert.equal(verifyEnvelope({ ...g, signature: g.signature.replace(/=+$/, '') }, { publicKeyPem: K.pub, now }).ok, false);
});
