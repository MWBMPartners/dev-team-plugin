import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeJsonAtomic, readMarked, writeMarked } from '../lib/store.mjs';

const dir = () => mkdtempSync(join(tmpdir(), 'dt-store-'));
test('an atomic write leaves no temporary file', () => {
  const d = dir(); writeJsonAtomic(join(d, 'a.json'), { a: 1 }); assert.deepEqual(readdirSync(d), ['a.json']);
});
test('a marked file has the marker on line 2 and is read back as ours', () => {
  const d = dir(), p = join(d, 'x.json'); writeMarked(p, 'job', { n: 1 });
  assert.match(readFileSync(p, 'utf8').split('\n')[1], /"dev-team": "ledger=job schema=1.0"/);
  assert.equal(readMarked(p, 'job').status, 'ours');
});
test('a file without the marker is never overwritten', () => {
  const d = dir(), p = join(d, 'y.json'); writeFileSync(p, '{"mine":true}');
  assert.equal(readMarked(p, 'job').status, 'not-ours'); assert.throws(() => writeMarked(p, 'job', {}));
  assert.equal(readFileSync(p, 'utf8'), '{"mine":true}');
});
test('a credential-shaped value is refused', () => {
  assert.throws(() => writeJsonAtomic(join(dir(), 'z.json'), { k: 'sk_live_abcdefgh12345678' }));
});
