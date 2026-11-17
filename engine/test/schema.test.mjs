import test from 'node:test';
import assert from 'node:assert/strict';
import { validate, validateManifest } from '../lib/schema.mjs';
import { pluginRoot } from '../lib/paths.mjs';

const ok = (s, v) => validate(s, v).ok;
test('each supported keyword has a pass and a fail', () => {
  assert.ok(ok({ type: 'string' }, 'a')); assert.ok(!ok({ type: 'string' }, 1));
  assert.ok(ok({ type: 'integer' }, 2)); assert.ok(!ok({ type: 'integer' }, 2.5));
  assert.ok(ok({ required: ['a'] }, { a: 1 })); assert.ok(!ok({ required: ['a'] }, {}));
  assert.ok(ok({ enum: [1, 2] }, 2)); assert.ok(!ok({ enum: [1, 2] }, 3));
  assert.ok(ok({ const: 'x' }, 'x')); assert.ok(!ok({ const: 'x' }, 'y'));
  assert.ok(ok({ pattern: '^a' }, 'ab')); assert.ok(!ok({ pattern: '^a' }, 'ba'));
  assert.ok(ok({ minimum: 1, maximum: 3 }, 2)); assert.ok(!ok({ minimum: 1 }, 0)); assert.ok(!ok({ maximum: 1 }, 2));
  assert.ok(ok({ minItems: 1 }, [1])); assert.ok(!ok({ minItems: 1 }, []));
  assert.ok(ok({ items: { type: 'number' } }, [1, 2])); assert.ok(!ok({ items: { type: 'number' } }, [1, 'a']));
  assert.ok(ok({ properties: { a: { type: 'number' } }, additionalProperties: false }, { a: 1 }));
  assert.ok(!ok({ properties: { a: {} }, additionalProperties: false }, { b: 1 }));
  assert.ok(ok({ oneOf: [{ type: 'string' }, { type: 'number' }] }, 1)); assert.ok(!ok({ oneOf: [{ type: 'number' }, { type: 'integer' }] }, 1));
});
test('$ref to $defs resolves; an unsupported keyword is reported', () => {
  const s = { $defs: { n: { type: 'number' } }, properties: { a: { $ref: '#/$defs/n' } } };
  assert.ok(ok(s, { a: 1 })); assert.ok(!ok(s, { a: 'x' }));
  assert.ok(!validate({ patternProperties: {} }, {}).ok);
});
test('the real manifest validates', () => { assert.deepEqual(validateManifest(pluginRoot()), []); });
