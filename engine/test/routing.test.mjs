import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { route, requiredTier } from '../lib/routing.mjs';
import { ollamaEntries, parseOllamaList, guessLocalTier } from '../lib/discover.mjs';
import { parseYaml, loadRouting, DEFAULT_ASK_FIRST } from '../lib/config.mjs';
import { pluginRoot } from '../lib/paths.mjs';

const seed = JSON.parse(readFileSync(join(pluginRoot(), 'engine/data/catalogue.seed.json'), 'utf8')).models;
const cfg = (o = {}) => ({ order: 'local-first', orderDecidedBy: 'test', askedBefore: true, askFirst: DEFAULT_ASK_FIRST, pin: {}, ...o });
const local = ollamaEntries(['qwen2.5-coder:32b', 'llama3.2:3b']);

test('role floors: a reviewer is never below tier 3; high risk raises a builder', () => {
  assert.equal(requiredTier('reviewer'), 3); assert.equal(requiredTier('builder'), 2); assert.equal(requiredTier('builder', 'HIGH'), 3); assert.equal(requiredTier('scout'), 1);
});
test('local-first: a capable local model builds; the cloud is not used', () => {
  const r = route({ role: 'builder', providers: ['claude', 'ollama'] }, [...seed, ...local], cfg());
  assert.equal(r.decision.local, true); assert.match(r.decision.model, /qwen/);
});
test('local-first: a reviewer still goes to the cloud, because local models are below tier 3', () => {
  const r = route({ role: 'reviewer', providers: ['claude', 'ollama'] }, [...seed, ...local], cfg());
  assert.equal(r.decision.local, false); assert.equal(r.decision.model, 'opus');
});
test('cloud-first starts on the cloud, and falls back to local when the allowance is used up', () => {
  const c = cfg({ order: 'cloud-first' });
  assert.equal(route({ role: 'builder', providers: ['claude', 'ollama'] }, [...seed, ...local], c).decision.model, 'sonnet');
  const r = route({ role: 'builder', providers: ['claude', 'ollama'], exhausted: ['claude'] }, [...seed, ...local], c);
  assert.equal(r.decision.local, true);
});
test('allowance used up and nothing local is strong enough: a clear no, not a weaker model', () => {
  const r = route({ role: 'architect', providers: ['claude', 'ollama'], exhausted: ['claude'] }, [...seed, ...local], cfg({ order: 'cloud-first' }));
  assert.equal(r.ok, false); assert.equal(r.code, 'NO_SUITABLE_AGENT_AVAILABLE');
});
test('ask-first: fable is never chosen unasked; the cheaper opus is', () => {
  const r = route({ role: 'architect', providers: ['claude'] }, seed, cfg());
  assert.equal(r.decision.model, 'opus'); assert.ok(r.heldBack.some((h) => h.model === 'fable'));
});
test('ask-first: when only an approval-needing model qualifies, the answer is NEEDS_APPROVAL with a question', () => {
  const r = route({ role: 'architect', providers: ['gemini'] }, seed, cfg());
  assert.equal(r.code, 'NEEDS_APPROVAL'); assert.ok(r.questions.some((q) => q.id === 'approve-model'));
  assert.equal(route({ role: 'architect', providers: ['gemini'], approved: ['gemini-top'] }, seed, cfg()).decision.model, 'gemini-top');
});
test('an unpriced model needs approval while "unpriced" is on the list, and not once it is removed', () => {
  assert.equal(route({ role: 'scout', providers: ['kimi'] }, seed.filter((m) => m.provider === 'kimi'), cfg()).code, 'NEEDS_APPROVAL');
  assert.equal(route({ role: 'scout', providers: ['kimi'] }, seed.filter((m) => m.provider === 'kimi'), cfg({ askFirst: [] })).ok, true);
});
test('local models are never held back, even when everything is on the ask-first list', () => {
  const r = route({ role: 'mechanical', providers: ['ollama'] }, local, cfg({ askFirst: ['unpriced', 'llama3.2:3b'] }));
  assert.equal(r.ok, true);
});
test('a reviewer prefers a different provider from the builder, and records the independence level', () => {
  const r = route({ role: 'reviewer', providers: ['claude', 'codex'], builtBy: 'claude' }, seed, cfg());
  assert.equal(r.decision.provider, 'codex'); assert.equal(r.decision.independence, 'CROSS_PROVIDER');
  assert.equal(route({ role: 'reviewer', providers: ['claude'], builtBy: 'claude' }, seed, cfg()).decision.independence, 'SAME_PROVIDER_FRESH_AGENT');
});
test('a pin is carried through exactly, with a warning; a pin that cannot be met stops and asks', () => {
  const r = route({ role: 'architect', providers: ['claude'] }, seed, cfg({ pin: { opus: 'exact-id-1' } }));
  assert.equal(r.decision.exactId, 'exact-id-1'); assert.ok(r.warnings.some((w) => w.includes('pinned')));
  const miss = route({ role: 'architect', providers: ['claude'], exhausted: ['claude'] }, seed, cfg({ pin: { opus: 'exact-id-1' } }));
  assert.equal(miss.code, 'PIN_UNAVAILABLE');
});
test('every decision says why, and unverified providers are flagged', () => {
  const r = route({ role: 'reviewer', providers: ['grok'] }, seed.map((m) => (m.provider === 'grok' ? { ...m, priced: true, tier: 3 } : m)), cfg());
  assert.ok(r.reasons.length >= 3); assert.ok(r.warnings.some((w) => w.includes('unverified')));
});

test('yaml subset: nested keys, flow lists and maps, comments', () => {
  const y = parseYaml('profile: standard # note\nrouting:\n  order: cloud-first\n  ask-first: [fable, mythos]\n  pin: {opus: abc}\n');
  assert.deepEqual(y, { profile: 'standard', routing: { order: 'cloud-first', 'ask-first': ['fable', 'mythos'], pin: { opus: 'abc' } } });
});
test('order precedence: session > project > profile > device > built-in; and "asked before" follows the project', () => {
  const home = mkdtempSync(join(tmpdir(), 'dt-home-')), proj = mkdtempSync(join(tmpdir(), 'dt-proj-'));
  assert.equal(loadRouting({ home, projectDir: proj }).order, 'local-first'); assert.equal(loadRouting({ home, projectDir: proj }).askedBefore, false);
  mkdirSync(join(home, '.dev-team')); writeFileSync(join(home, '.dev-team', 'device.yml'), 'routing:\n  order: cloud-first\n');
  assert.equal(loadRouting({ home, projectDir: proj }).order, 'cloud-first');
  mkdirSync(join(proj, '.dev-team')); writeFileSync(join(proj, '.dev-team', 'config.yml'), 'profile: local-first\n');
  assert.equal(loadRouting({ home, projectDir: proj }).order, 'local-first');
  writeFileSync(join(proj, '.dev-team', 'config.yml'), 'profile: local-first\nrouting:\n  order: cloud-first\n');
  assert.equal(loadRouting({ home, projectDir: proj }).order, 'cloud-first'); assert.equal(loadRouting({ home, projectDir: proj }).askedBefore, true);
  assert.equal(loadRouting({ home, projectDir: proj, sessionOrder: 'local-first' }).orderDecidedBy, "this session's choice");
});
test('ollama list is parsed and local models are guessed by size, marked as guesses', () => {
  assert.deepEqual(parseOllamaList('NAME ID SIZE MODIFIED\nqwen2.5-coder:32b abc 19 GB now\nllama3.2:3b def 2 GB now\n'), ['qwen2.5-coder:32b', 'llama3.2:3b']);
  assert.equal(guessLocalTier('qwen2.5-coder:32b'), 2); assert.equal(guessLocalTier('llama3.2:3b'), 1);
  assert.equal(ollamaEntries(['x:7b'])[0].tierSource, 'guess-from-name');
});

// ---- Fixes after the first independent review (17 Nov 2026) ----
import { BadRequest } from '../lib/routing.mjs';
test('approved, providers and exhausted must be lists; a string never counts as approval', () => {
  for (const k of ['approved', 'providers', 'exhausted']) assert.throws(() => route({ role: 'architect', providers: ['claude'], [k]: 'not-fable-please' }, seed, cfg()), BadRequest);
});
test('ask-first names are matched ignoring capitals', () => {
  const r = route({ role: 'architect', providers: ['gemini'] }, seed, cfg({ askFirst: ['Gemini-Top'] }));
  assert.equal(r.code, 'NEEDS_APPROVAL');
  assert.equal(route({ role: 'architect', providers: ['gemini'], approved: ['GEMINI-TOP'] }, seed, cfg({ askFirst: ['Gemini-Top'] })).ok, true);
});
test('a pinned model that fits the job but cannot be used stops the job, even when others qualify', () => {
  const r = route({ role: 'reviewer', providers: ['claude', 'codex'], exhausted: ['claude'] }, seed, cfg({ pin: { opus: 'X' } }));
  assert.equal(r.code, 'PIN_UNAVAILABLE');
});
test('a local model with the same name as a pinned cloud model does not take the pin', () => {
  const clash = [{ ...local[0], id: 'opus', alias: 'opus', tier: 3, roles: ['architect'] }];
  const r = route({ role: 'architect', providers: ['ollama'] }, clash, cfg({ pin: { opus: 'X' } }));
  assert.equal(r.ok, true); assert.equal(r.decision.exactId, null);
});
test('a tier-4 model never beats a usable tier-3 model for checking work, even from a different provider', () => {
  const r = route({ role: 'reviewer', providers: ['claude', 'gemini'], builtBy: 'claude', approved: ['gemini-top'] }, seed, cfg());
  assert.equal(r.decision.tier, 3);
});
test('minTier raises the need, so an approved Fable can actually be reached', () => {
  const r = route({ role: 'architect', providers: ['claude'], minTier: 4, approved: ['fable'] }, seed, cfg());
  assert.equal(r.decision.model, 'fable');
  assert.equal(route({ role: 'architect', providers: ['claude'], minTier: 4 }, seed, cfg()).code, 'NEEDS_APPROVAL');
  assert.throws(() => route({ role: 'architect', minTier: 9 }, seed, cfg()), BadRequest);
});
test('risk is read ignoring capitals and an unknown risk is refused; role names are checked exactly', () => {
  assert.equal(route({ role: 'builder', providers: ['claude'], risk: 'high' }, seed, cfg()).decision.tier, 3);
  assert.throws(() => route({ role: 'builder', risk: 'severe' }, seed, cfg()), BadRequest);
  assert.throws(() => route({ role: 'toString' }, seed, cfg()), BadRequest);
});
test('yaml: pin versions keep their exact text, and a list written one item per line is read', () => {
  const y = parseYaml('routing:\n  pin: {opus: 4.10, sonnet: 007}\n  ask-first:\n    - opus\n    - fable\n');
  assert.deepEqual(y.routing.pin, { opus: '4.10', sonnet: '007' }); assert.deepEqual(y.routing['ask-first'], ['opus', 'fable']);
});
