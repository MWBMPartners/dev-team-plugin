import test from 'node:test';
import assert from 'node:assert/strict';
import { reserveCheck, pressure, budgetStatus } from '../lib/budget.mjs';
import { estimate, shareWarning } from '../lib/estimate.mjs';

test('reserves: a routine task cannot take the last 25% of the strongest model; planning and security can; an unknown allowance applies no reserve and no number', () => {
  assert.equal(reserveCheck({ remainingPercent: 20, tier: 4, taskTypes: ['ROUTINE_IMPLEMENTATION'] }).allowed, false);
  assert.equal(reserveCheck({ remainingPercent: 20, tier: 4, taskTypes: ['DEEP_PLANNING'] }).allowed, true); assert.equal(reserveCheck({ remainingPercent: 20, tier: 4, taskTypes: ['SECURITY_REVIEW'] }).allowed, true);
  assert.equal(reserveCheck({ remainingPercent: 60, tier: 4, taskTypes: ['ROUTINE_IMPLEMENTATION'] }).allowed, true);
  assert.equal(reserveCheck({ remainingPercent: 10, tier: 3, taskTypes: ['DOCUMENTATION'] }).allowed, false); assert.equal(reserveCheck({ remainingPercent: 10, tier: 2, taskTypes: ['DOCUMENTATION'] }).allowed, true);
  const u = reserveCheck({ remainingPercent: null, tier: 4, taskTypes: ['DOCUMENTATION'] }); assert.equal(u.allowed, true); assert.equal(u.state, 'UNKNOWN');
  assert.equal(reserveCheck({ remainingPercent: 20, tier: 4, taskTypes: ['DOCUMENTATION'], reserves: { frontierReservePercent: 10 } }).allowed, true);
  assert.throws(() => reserveCheck({ remainingPercent: 120, tier: 4, taskTypes: [] }), RangeError); assert.throws(() => reserveCheck({ remainingPercent: 'x', tier: 4, taskTypes: [] }), RangeError);
});
test('pressure states', () => { assert.deepEqual([60, 40, 20, 5, null].map(pressure), ['NORMAL', 'ELEVATED', 'HIGH', 'CRITICAL', 'UNKNOWN']); });
test('budget: warns at 80%, stops at the limit; a limit with no spend figure is an error, not a pass', () => {
  assert.equal(budgetStatus({ limit: { tokens: 100 }, spent: { tokens: 50 } }).status, 'OK'); assert.equal(budgetStatus({ limit: { tokens: 100 }, spent: { tokens: 85 } }).status, 'WARN');
  assert.equal(budgetStatus({ limit: { tokens: 100, credits: 5 }, spent: { tokens: 85, credits: 5 } }).status, 'STOP'); assert.equal(budgetStatus({ limit: { money: 10 }, spent: { money: 10 } }).status, 'STOP');
  assert.throws(() => budgetStatus({ limit: { tokens: 100 }, spent: {} }), RangeError); assert.throws(() => budgetStatus({ limit: { tokens: 0 }, spent: { tokens: 0 } }), RangeError);
});
test('estimate: LOW <= LIKELY <= HIGH, the caveat is always there, bigger tasks cost more, a pricier model costs more; history replaces the guess after 10 records', () => {
  const small = estimate({ taskTypes: ['DOCUMENTATION'], costBand: 1 }), big = estimate({ taskTypes: ['DEEP_PLANNING'], costBand: 1 }), dear = estimate({ taskTypes: ['DOCUMENTATION'], costBand: 5 });
  for (const e of [small, big, dear]) { assert.ok(e.low <= e.likely && e.likely <= e.high); assert.match(e.caveat, /not a bill/); }
  assert.ok(big.likely > small.likely); assert.ok(dear.likely > small.likely); assert.equal(small.source, 'BUILT_IN_BANDS');
  const hist = Array.from({ length: 10 }, (_, i) => ({ taskType: 'DOCUMENTATION', units: i + 1 })); const h = estimate({ taskTypes: ['DOCUMENTATION'], costBand: 1, history: hist }); assert.equal(h.source, 'LOCAL_HISTORY');
  assert.equal(estimate({ taskTypes: ['DOCUMENTATION'], costBand: 1, history: hist.slice(0, 9) }).source, 'BUILT_IN_BANDS');
  assert.ok(estimate({ taskTypes: ['DOCUMENTATION'], costBand: 0 }).likely > 0);
  assert.throws(() => estimate({ taskTypes: ['NOPE'], costBand: 1 }), RangeError); assert.throws(() => estimate({ taskTypes: [], costBand: 1 }), RangeError); assert.throws(() => estimate({ taskTypes: ['DOCUMENTATION'], costBand: -1 }), RangeError);
});
test('share warning: fires above the threshold on a known allowance; an unknown allowance never produces a number', () => {
  assert.equal(shareWarning(30, 100).warn, true); assert.equal(shareWarning(10, 100).warn, false); const u = shareWarning(30, null); assert.deepEqual([u.warn, u.state, u.share], [false, 'UNKNOWN', undefined]);
  assert.throws(() => shareWarning(1, 0), RangeError);
});

import { route } from '../lib/routing.mjs';
import { dryRun } from '../lib/dryrun.mjs';
import { readFileSync } from 'node:fs'; import { join } from 'node:path'; import { pluginRoot } from '../lib/paths.mjs'; import { DEFAULT_ASK_FIRST } from '../lib/config.mjs';
const seed = JSON.parse(readFileSync(join(pluginRoot(), 'engine/data/catalogue.seed.json'), 'utf8')).models;
const cfg = (o = {}) => ({ order: 'local-first', orderDecidedBy: 't', askedBefore: true, askFirst: DEFAULT_ASK_FIRST, pin: {}, ...o });
test('route: a low allowance keeps the strong model for planning and security; routine work moves down; unknown applies nothing', () => {
  const routine = route({ role: 'architect', taskTypes: ['ARCHITECTURE_REVIEW'], risk: 'NORMAL', providers: ['claude', 'codex'], quotaRemaining: { claude: 10 } }, seed, cfg());
  assert.equal(routine.decision.provider, 'claude'); // architecture review may use the reserve
  const doc = route({ role: 'builder', taskTypes: ['COMPLEX_IMPLEMENTATION'], risk: 'NORMAL', providers: ['claude', 'codex'], quotaRemaining: { claude: 10 } }, seed, cfg());
  assert.notEqual(doc.decision?.model, 'opus'); assert.ok(doc.dropped.some((x) => /kept for planning/.test(x)));
  const unknown = route({ role: 'builder', taskTypes: ['COMPLEX_IMPLEMENTATION'], providers: ['claude'], quotaRemaining: { claude: null } }, seed, cfg()); assert.ok(unknown.decision);
  assert.throws(() => route({ role: 'builder', providers: ['claude'], quotaRemaining: { claude: 150 } }, seed, cfg()), /quotaRemaining/); assert.throws(() => route({ role: 'builder', providers: ['claude'], quotaRemaining: [] }, seed, cfg()), /quotaRemaining/);
});
test('dry-run shows LOW/LIKELY/HIGH with the caveat and the allowance pressure when it was given', () => {
  const r = dryRun([{ name: 'p', role: 'architect', taskTypes: ['DEEP_PLANNING'], risk: 'NORMAL', quotaRemaining: { claude: 40 } }], (q) => route({ providers: ['claude'], ...q }, seed, cfg()));
  assert.ok(r.rows[0].cost.low <= r.rows[0].cost.likely && r.rows[0].cost.likely <= r.rows[0].cost.high); assert.equal(r.rows[0].quota, 'ELEVATED');
});
