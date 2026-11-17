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

// ---- Fixes after the independent review of increment 4 ----
test('time: a date in the message is honoured or the answer is null, never a wrong "next occurrence"', () => {
  const now = at('2026-11-19T22:00:00Z');
  const iso = parseClockTime('Resets 2026-11-25 09:00 UTC', { machineZone: L, now }); assert.equal(iso.resetAt, '2026-11-25T09:00:00.000Z'); assert.deepEqual(iso.assumptions, []);
  const md = parseClockTime('Resets Nov 20 at 9:00 AM', { machineZone: L, now }); assert.equal(md.resetAt, '2026-11-20T09:00:00.000Z'); assert.ok(md.assumptions.includes('YEAR_INFERRED'));
  assert.equal(parseClockTime('Resets Nov 20 at 9:00 AM', { machineZone: L, now: at('2026-11-21T00:00:00Z') }).resetAt, '2027-11-20T09:00:00.000Z');
  for (const t of ['Resets on Tuesday at 9:00 AM', 'resets 25/11 at 09:00', 'resets 2026-11-25']) assert.equal(parseClockTime(t, { machineZone: L, now }).resetAt, null, t);
  assert.equal(pauseOrBlock({ resetAt: parseClockTime('weekly limit. Resets 2026-11-25 09:00 UTC', { machineZone: L, now }).resetAt }, now).action, 'BLOCK');
});
test('time: the spring-forward gap moves forward in zones behind UTC too; the autumn overlap uses the first time; next day is a calendar day', () => {
  assert.equal(new Date(zonedToUtc(2026, 3, 8, 2, 30, 'America/New_York')).toISOString(), '2026-03-08T07:30:00.000Z'); // 03:30 EDT
  assert.equal(new Date(zonedToUtc(2026, 11, 1, 1, 30, 'America/New_York')).toISOString(), '2026-11-01T05:30:00.000Z'); // the first 01:30 (EDT)
  assert.equal(new Date(zonedToUtc(2026, 10, 25, 1, 30, L)).toISOString(), '2026-10-25T00:30:00.000Z'); // first 01:30 (BST)
  assert.equal(new Date(zonedToUtc(2026, 3, 29, 1, 30, L)).toISOString(), '2026-03-29T01:30:00.000Z'); // 01:30 does not exist in London that day; it lands just after the jump (02:30 BST)
  assert.equal(parseClockTime('resets at 11pm', { machineZone: L, now: at('2026-11-17T23:30:00Z') }).resetAt, '2026-11-18T23:00:00.000Z');
  assert.equal(new Date(zonedToUtc(2026, 3, 8, 9, 0, 'Asia/Kolkata')).toISOString(), '2026-03-08T03:30:00.000Z');
});
test('time and quota: a later "in" clause is found; "5h30m" is read; a short rate limit is not an exhausted allowance; gpt is a model family', () => {
  const now = at('2026-11-17T10:00:00Z');
  assert.equal(parseClockTime('Usage limit reached in your plan. Try again in 5 hours.', { machineZone: L, now }).resetAt, '2026-11-17T15:00:00.000Z');
  assert.equal(parseClockTime('try again in 5h30m', { machineZone: L, now }).resetAt, '2026-11-17T15:30:00.000Z');
  const r = parseQuotaMessage('429: rate limit exceeded, retry after 20 seconds', { provider: 'x', machineZone: L, now }); assert.equal(r.state, 'RATE_LIMITED'); assert.equal(pauseOrBlock(r, now).action, 'RETRY_LATER');
  assert.equal(parseQuotaMessage("You've hit your GPT-5 usage limit", { provider: 'codex', machineZone: L, now }).scope, 'MODEL_FAMILY');
});

// ---- Second review of increment 4 ----
test('time: a full date with "at 9:00 AM" or "9 AM" is read completely; a stated offset or Z wins; words that merely start like a weekday do not matter; impossible dates are refused', () => {
  const now = at('2026-11-17T10:00:00Z'), p = (s, z = 'America/New_York') => parseClockTime(s, { machineZone: z, now }).resetAt;
  assert.equal(p('resets Nov 20, 2026 at 9:00 AM', 'UTC'), '2026-11-20T09:00:00.000Z'); assert.equal(p('resets Nov 20, 2026 9 AM', 'UTC'), '2026-11-20T09:00:00.000Z'); assert.equal(p('resets Mar 5th 2027 9am', 'UTC'), '2027-03-05T09:00:00.000Z');
  assert.equal(p('resets Nov 20, 2026', 'UTC'), null); // a year but no time: never "the next occurrence"
  assert.equal(p('resets 2026-11-25T09:00:00Z'), '2026-11-25T09:00:00.000Z'); assert.equal(p('resets 2026-11-25T09:00:00+02:00', 'UTC'), '2026-11-25T07:00:00.000Z');
  assert.equal(p('Monthly usage limit reached. Resets at 5pm.', 'UTC'), '2026-11-17T17:00:00.000Z'); assert.equal(p('Friendly note: resets at 5pm', 'UTC'), '2026-11-17T17:00:00.000Z');
  assert.equal(p('resets Tuesday at 9am', 'UTC'), null);
  for (const t of ['resets Feb 30 at 9am', 'resets 2026-02-30 09:00 UTC', 'resets Feb 30, 2026 9 AM']) assert.equal(p(t, 'UTC'), null, t);
  assert.equal(p('resets Feb 29 at 9am', 'UTC'), null); // no such date this year or next: no reset time rather than a guess
});
