import test from 'node:test';
import assert from 'node:assert/strict';
import { parseClockTime, zonedToUtc, validZone } from '../lib/time.mjs';
import { parseQuotaMessage, pauseOrBlock } from '../lib/quota.mjs';

const L = 'Europe/London';
const at = (s) => new Date(s);

test('time: a full date and time carries no date assumption', () => {
  const r = parseClockTime('Your limit resets Sep 14th, 2026 2:31 AM (Europe/London)', { machineZone: 'UTC', now: at('2026-09-13T12:00:00Z') });
  assert.equal(r.resetAt, '2026-09-14T01:31:00.000Z'); assert.deepEqual(r.assumptions, []); assert.equal(r.confidence, 'HIGH'); // BST: 02:31 is 01:31 UTC
});
test('time: a clock time with no date is its next occurrence, in the machine zone unless one is stated, and says so', () => {
  const now = at('2026-11-17T10:00:00Z'); // London is on GMT
  const a = parseClockTime('resets at 9:30 PM', { machineZone: L, now }); assert.equal(a.resetAt, '2026-11-17T21:30:00.000Z'); assert.deepEqual(a.assumptions, ['ZONE_MACHINE', 'DATE_NEXT_OCCURRENCE']); assert.equal(a.confidence, 'LOW');
  const b = parseClockTime('resets at 9:30 PM (America/New_York)', { machineZone: L, now }); assert.equal(b.resetAt, '2026-11-18T02:30:00.000Z'); assert.deepEqual(b.assumptions, ['DATE_NEXT_OCCURRENCE']);
});
test('time: a clock time that has already passed today means tomorrow', () => {
  const r = parseClockTime('resets at 9:00 AM', { machineZone: L, now: at('2026-11-17T10:00:00Z') });
  assert.equal(r.resetAt, '2026-11-18T09:00:00.000Z');
});
test('time: across the clocks going forward (London, 29 March 2026) the offset follows the date', () => {
  assert.equal(new Date(zonedToUtc(2026, 3, 29, 0, 30, L)).toISOString(), '2026-03-29T00:30:00.000Z'); // still GMT
  assert.equal(new Date(zonedToUtc(2026, 3, 29, 2, 30, L)).toISOString(), '2026-03-29T01:30:00.000Z'); // 02:30 does not exist; moves forward to 02:30 BST... 
  assert.equal(new Date(zonedToUtc(2026, 3, 30, 9, 0, L)).toISOString(), '2026-03-30T08:00:00.000Z'); // BST
  const r = parseClockTime('resets at 9:00 AM', { machineZone: L, now: at('2026-03-28T23:00:00Z') }); assert.equal(r.resetAt, '2026-03-29T08:00:00.000Z');
});
test('time: no clock time means null, never a guess; relative durations are marked; odd input never throws', () => {
  assert.equal(parseClockTime('limit reached, try later', { machineZone: L, now: at('2026-11-17T10:00:00Z') }).resetAt, null);
  const r = parseClockTime('try again in 2 hours 30 minutes', { machineZone: L, now: at('2026-11-17T10:00:00Z') }); assert.equal(r.resetAt, '2026-11-17T12:30:00.000Z'); assert.deepEqual(r.assumptions, ['RELATIVE_DURATION']);
  for (const t of ['', '99:99', '13 pm', 'resets at 25:00']) assert.equal(parseClockTime(t, { machineZone: L, now: at('2026-11-17T10:00:00Z') }).resetAt, null, t);
  assert.equal(validZone('Mars/Base'), false); assert.equal(validZone(L), true);
});
test('quota: causes, scope, reset and confidence come only from the message; a non-limit message is null', () => {
  const now = at('2026-11-17T10:00:00Z');
  const s = parseQuotaMessage('You have hit your usage limit for this session. It resets at 11:30 PM (UTC).', { provider: 'claude', machineZone: L, now });
  assert.equal(s.cause, 'SESSION'); assert.equal(s.scope, 'SESSION'); assert.equal(s.resetAt, '2026-11-17T23:30:00.000Z');
  assert.equal(parseQuotaMessage('weekly usage limit reached', { provider: 'claude', machineZone: L, now }).cause, 'WEEKLY');
  const f = parseQuotaMessage('Opus usage limit reached for the model family', { provider: 'claude', machineZone: L, now }); assert.equal(f.scope, 'MODEL_FAMILY'); assert.equal(f.resetAt, null); assert.equal(f.confidence, 'NONE');
  assert.equal(parseQuotaMessage('spending limit exceeded', { provider: 'claude', machineZone: L, now }).cause, 'SPEND');
  assert.equal(parseQuotaMessage('Everything is fine, 9:30 PM', { provider: 'claude', machineZone: L, now }), null);
  assert.ok(!JSON.stringify(parseQuotaMessage('usage limit reached sk_live_abcdefgh12345678', { provider: 'x', machineZone: L, now })).includes('sk_live'));
});
test('pause or block: waits only for a known reset within 12 hours; never invents one', () => {
  const now = at('2026-11-17T10:00:00Z'); const h = (n) => ({ resetAt: new Date(now.getTime() + n * 3600000).toISOString() });
  for (const n of [1 / 6, 2, 11.98]) assert.equal(pauseOrBlock(h(n), now).action, 'PAUSE');
  assert.equal(pauseOrBlock(h(13), now).state, 'BLOCKED_AWAITING_AGENT'); assert.equal(pauseOrBlock({ resetAt: null }, now).action, 'BLOCK');
  assert.equal(pauseOrBlock(h(-1), now).action, 'RETRY_NOW'); assert.equal(pauseOrBlock({ resetAt: 'garbage' }, now).action, 'BLOCK');
  assert.equal(pauseOrBlock(h(30), now, 48).action, 'PAUSE'); assert.throws(() => pauseOrBlock(h(1), now, 0), RangeError);
});
