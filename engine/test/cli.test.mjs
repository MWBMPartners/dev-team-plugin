import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, envelope, renderText, ExitCodes } from '../lib/cli.mjs';

test('parseArgs reads command, sub-command and the three flag forms', () => {
  const a = parseArgs(['schema', 'validate', '--file', 'x.json', '--schema=y.json', '--all']);
  assert.equal(a.command, 'schema'); assert.equal(a.sub, 'validate');
  assert.deepEqual(a.flags, { file: 'x.json', schema: 'y.json', all: true });
});
test('exit codes are fixed', () => {
  assert.deepEqual({ ...ExitCodes }, { OK: 0, NEGATIVE: 1, BAD_INPUT: 2, UNAVAILABLE: 3, CONFLICT: 4, VERIFY_FAILED: 5 });
  assert.throws(() => { 'use strict'; ExitCodes.OK = 9; });
});
test('envelope and text rendering', () => {
  const e = envelope('doctor', false, null, [{ code: 'X', message: 'bad' }]);
  assert.equal(e.ok, false); assert.match(renderText(e), /problem X: bad/);
});
