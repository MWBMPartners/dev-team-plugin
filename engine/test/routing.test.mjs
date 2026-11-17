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

// ---- Fixes after the second independent review ----
test('pin versions keep their exact text in every yaml style', () => {
  const y = parseYaml('routing:\n  pin:\n    opus: 4.10\n    sonnet: 007\n');
  assert.deepEqual(y.routing.pin, { opus: '4.10', sonnet: '007' });
});
test('complex must be true or false; a lookalike never lowers the strength needed', () => {
  for (const bad of ['true', 1, 'yes']) assert.throws(() => route({ role: 'builder', providers: ['claude'], complex: bad }, seed, cfg()), BadRequest);
  assert.equal(route({ role: 'builder', providers: ['claude'], complex: true }, seed, cfg()).decision.tier, 3);
});

// ---- Fixes after the third independent review ----
test('an empty or wrongly shaped pin stops the job instead of guessing', () => {
  const load = (yaml) => { const proj = mkdtempSync(join(tmpdir(), 'dt-pin-')); mkdirSync(join(proj, '.dev-team')); writeFileSync(join(proj, '.dev-team', 'config.yml'), yaml); return loadRouting({ home: proj, projectDir: proj }); };
  for (const y of ['routing:\n  pin:\n    opus: ""\n', 'routing:\n  pin:\n    opus:\n', 'routing:\n  pin: opus\n', 'routing:\n  pin:\n    - opus\n', 'routing:\n  pin: {opus: [1, 2]}\n']) {
    const c = load(y); assert.ok(c.badPins.length > 0, y);
    assert.equal(route({ role: 'architect', providers: ['claude'] }, seed, c).code, 'PIN_INVALID');
  }
  assert.deepEqual(load('routing:\n  pin:\n    opus: 4.10\n').pin, { opus: '4.10' });
});
test('local models are found when the provider is written in capitals', async () => {
  const { discoverOllama } = await import('../lib/discover.mjs');
  const found = await discoverOllama(async () => ({ stdout: 'NAME ID SIZE MODIFIED\nqwen2.5-coder:32b a 1GB now\n' }));
  assert.equal(found.length, 1);
});

// ---- Fixes after the fourth independent review ----
test('two pins for one model that differ only in capitals and in version stop the job', () => {
  const proj = mkdtempSync(join(tmpdir(), 'dt-pin2-')); mkdirSync(join(proj, '.dev-team'));
  writeFileSync(join(proj, '.dev-team', 'config.yml'), 'routing:\n  pin: {opus: 4.1, OPUS: 4.2}\n');
  const c = loadRouting({ home: proj, projectDir: proj });
  assert.ok(c.badPins.length > 0); assert.equal(route({ role: 'architect', providers: ['claude'] }, seed, c).code, 'PIN_INVALID');
});
test('Ollama cloud-hosted models are not treated as free local models', () => {
  const [e] = ollamaEntries(['gpt-oss:120b-cloud']);
  assert.equal(e.local, false); assert.equal(e.priced, false);
  assert.equal(route({ role: 'builder', providers: ['ollama'] }, [e], cfg()).code, 'NEEDS_APPROVAL');
});

// ---- Fix after the fifth independent review ----
test('a config file with Windows line endings and trailing comments is read the same as one without', () => {
  const y = parseYaml('routing:\r\n  ask-first:\r\n    - mythos   # costly\r\n    - fable   # costly\r\n  pin:\r\n    opus: 4.1   # chosen\r\n');
  assert.deepEqual(y.routing['ask-first'], ['mythos', 'fable']); assert.deepEqual(y.routing.pin, { opus: '4.1' });
});

// ---- Fixes after the sixth independent review ----
const loadYaml = (yaml) => { const proj = mkdtempSync(join(tmpdir(), 'dt-y-')); mkdirSync(join(proj, '.dev-team')); writeFileSync(join(proj, '.dev-team', 'config.yml'), yaml); return loadRouting({ home: proj, projectDir: proj }); };
test('a setting or pin written twice is never resolved by guessing', () => {
  const c = loadYaml('routing:\n  pin:\n    opus: 4.1\n    opus: 4.2\n');
  assert.equal(route({ role: 'architect', providers: ['claude'] }, seed, c).code, 'PIN_INVALID');
  const d = loadYaml('routing:\n  ask-first: [fable]\n  ask-first: []\n');
  assert.equal(route({ role: 'architect', providers: ['claude'] }, seed, d).code, 'SETTINGS_INVALID');
});
test('a # inside quotes is kept; an unsafe key name is reported; a profile named after an object property is ignored', () => {
  assert.deepEqual(parseYaml('routing:\n  pin:\n    opus: "4.1 #rc"\n').routing.pin, { opus: '4.1 #rc' });
  assert.ok(loadYaml('routing:\n  pin:\n    __proto__: x\n').badPins.length > 0);
  const c = loadYaml('profile: constructor\n'); assert.equal(c.order, 'local-first'); assert.equal(c.askedBefore, false);
});
test('a very long line of spaces is read quickly', () => {
  const t0 = Date.now(); parseYaml('a: b' + ' '.repeat(200000) + '\n'); assert.ok(Date.now() - t0 < 1000);
});

// ---- Fixes after the seventh independent review ----
test('a one-line pin map: a repeated name is reported, and a comma inside quotes does not split the version', () => {
  assert.equal(route({ role: 'architect', providers: ['claude'] }, seed, loadYaml('routing:\n  pin: {opus: 4.1, opus: 4.2}\n')).code, 'PIN_INVALID');
  assert.deepEqual(loadYaml('routing:\n  pin: {opus: "4.1, beta"}\n').pin, { opus: '4.1, beta' });
  assert.ok(loadYaml('routing:\n  pin: {opus: "4.1, beta}\n').badPins.length > 0);
});
test('an unrelated key that merely starts with routing never blocks routing', () => {
  const c = loadYaml('routing-notes:\n  a: 1\nrouting-notes:\n  a: 2\n');
  assert.equal(c.badSettings.length, 0);
  assert.equal(route({ role: 'architect', providers: ['claude'] }, seed, c).ok, true);
});

// ---- Fixes after the eighth independent review: the reader fails closed ----
test('quoted names are read; a line the reader cannot understand under routing stops routing', () => {
  assert.deepEqual(loadYaml('routing:\n  pin: {"opus": "4.1"}\n').pin, { opus: '4.1' });
  assert.deepEqual(loadYaml('routing:\n  pin:\n    "opus": 4.1\n').pin, { opus: '4.1' });
  assert.equal(route({ role: 'architect', providers: ['claude'] }, seed, loadYaml('routing:\n  ask-first: [fable]\n  this is not valid\n')).code, 'SETTINGS_INVALID');
});
test('absurd nesting and a close-before-open are reported, never silently emptied', () => {
  const deep = loadYaml('routing:\n  ask-first: ' + '['.repeat(20000) + '\n');
  assert.ok(deep.badSettings.length > 0);
  assert.ok(loadYaml('routing:\n  ask-first: [fable], [mythos]\n').badSettings.length > 0);
});
test('an apostrophe in plain text is just text and blocks nothing', () => {
  const c = loadYaml("note: {a: it's}\nrouting:\n  order: cloud-first   # it's fine\n");
  assert.equal(c.badSettings.length, 0); assert.equal(c.order, 'cloud-first');
});
