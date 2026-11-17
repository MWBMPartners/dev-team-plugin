import test from 'node:test';
import assert from 'node:assert/strict';
import { redact, looksLikeCredential } from '../lib/redact.mjs';

const samples = ['sk_live_abcdefgh12345678', 'ghp_' + 'a'.repeat(30), 'github_pat_' + 'b'.repeat(30), 'xoxb-1234567890-abc', 'AKIAABCDEFGHIJKLMNOP',
  'sk-' + 'c'.repeat(30), 'eyJhbGciOiJIUzI1.eyJzdWIiOiIx.abcdefghijk', 'Bearer abcdefghijklmnop1234'];
test('each secret shape is replaced', () => {
  for (const s of samples) assert.match(redact(`x ${s} y`), /\[REDACTED:/, s);
});
test('plain sentences are untouched and redaction is repeatable', () => {
  assert.equal(redact('just a normal sentence'), 'just a normal sentence');
  const once = redact(`key ${samples[0]}`); assert.equal(redact(once), once);
});
test('password inside a URL is caught, a plain URL is not', () => {
  assert.equal(looksLikeCredential('https://user:pw@host/'), true);
  assert.equal(looksLikeCredential('https://host/path'), false);
});
