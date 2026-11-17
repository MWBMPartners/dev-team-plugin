import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonicalJson, sha256Hex } from '../lib/canonical.mjs';
import { readSimpleToml } from '../lib/toml.mjs';
import { event, EVENTS } from '../lib/log.mjs';
import { discover } from '../lib/discovery.mjs';
import { codex } from '../adapters/codex.mjs';
import { claudeCode } from '../adapters/claude-code.mjs';
import { listAdapters } from '../adapters/index.mjs';
import { runScenario } from '../sim/run.mjs';
import { validate, loadSchema } from '../lib/schema.mjs';
import { pluginRoot } from '../lib/paths.mjs';
import { hashContract } from '../../.claude/plans/orchestrator-v2/hash-contract.mjs';

const root = pluginRoot();
const sample = readFileSync(join(root, 'tests/fixtures/codex-debug-models.sample.json'), 'utf8');
const tmp = () => mkdtempSync(join(tmpdir(), 'dt-d-'));
const okRun = (out) => async (cmd, args) => { if (cmd === 'codex' && args[0] === 'debug') return { stdout: out }; if (cmd === 'codex') return { stdout: 'Logged in' }; throw new Error('absent'); };
const schemaOf = (n) => loadSchema(join(root, n));

test('canonical JSON: key order and spaces do not change the hash, a value does, undefined throws, and it agrees with the plan-lock script', () => {
  assert.equal(sha256Hex(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] })), sha256Hex(canonicalJson({ a: [2, { c: 2, d: 1 }], b: 1 })));
  assert.notEqual(canonicalJson({ a: 1 }), canonicalJson({ a: 2 }));
  assert.throws(() => canonicalJson({ a: undefined })); assert.throws(() => canonicalJson(NaN));
  const doc = JSON.parse(readFileSync(join(root, '.claude/plans/orchestrator-v2/plan-contract.orchestrator-v2.v1.json'), 'utf8'));
  assert.equal(sha256Hex(canonicalJson(doc.contract)), hashContract(doc)); assert.equal(hashContract(doc), doc.planHash);
});
test('toml: simple values and sections are read; anything else is reported, not guessed', () => {
  const r = readSimpleToml('model = "gpt-x"\nmodel_reasoning_effort = "medium"\nn = 3\nok = true\n[tui]\ntheme = "dark"\n[[arr]]\nx = [1,2]\n');
  assert.equal(r.values.model, 'gpt-x'); assert.equal(r.values.model_reasoning_effort, 'medium'); assert.equal(r.values['tui.theme'], 'dark');
  assert.ok(r.unsupportedLines.includes('[[arr]]')); assert.ok(r.unsupportedLines.includes('x = [1,2]'));
});
test('events: a day file validates line by line, an unknown name is refused, a secret is removed', () => {
  const d = tmp(); event(d, 'DISCOVERY_COMPLETED', { n: 1, key: 'sk_live_abcdefgh12345678' }, new Date('2026-11-17T01:00:00Z'));
  const lines = readFileSync(join(d, '2026-11-17.jsonl'), 'utf8').trim().split('\n');
  for (const l of lines) assert.ok(validate(schemaOf('schemas/local/event.schema.json'), JSON.parse(l)).ok);
  assert.ok(!lines[0].includes('sk_live_')); assert.throws(() => event(d, 'MADE_UP', {})); assert.ok(EVENTS.length > 5);
});
test('codex discovery: two profiles, only allowed fields kept, hidden is UNKNOWN, an upgrade is LEGACY, provenance recorded', async () => {
  const dir = tmp(); const r = await discover({ adapters: [codex], dataDir: dir, run: okRun(sample), home: dir });
  assert.equal(r.profiles.length, 2);
  const p = r.profiles.find((x) => x.providerModelId === 'gpt-5.5-codex');
  assert.equal(p.contextWindow, 272000); assert.deepEqual(p.reasoningControls, ['low', 'medium', 'high']); assert.equal(p.provenance.contextWindow, 'RUNTIME_DISCOVERY');
  assert.equal(p.availability, 'AVAILABLE'); assert.equal(p.lifecycleStatus, 'ACTIVE'); assert.equal(p.capabilityTier, 2);
  assert.equal(r.profiles.find((x) => x.providerModelId === 'codex-auto-review').lifecycleStatus, 'UNKNOWN');
  assert.ok(!readFileSync(join(dir, 'catalogue', 'codex.json'), 'utf8').includes('model_messages'));
  assert.equal(p.latencyClass, 'UNKNOWN');
  const up = JSON.parse(sample); up.models[0].upgrade = 'gpt-9'; const r2 = await discover({ adapters: [codex], dataDir: tmp(), run: okRun(JSON.stringify(up)), home: dir });
  assert.equal(r2.profiles[0].lifecycleStatus, 'LEGACY');
  for (const prof of r.profiles) assert.ok(validate(schemaOf('schemas/local/model-capability-profile.schema.json'), prof).ok, JSON.stringify(validate(schemaOf('schemas/local/model-capability-profile.schema.json'), prof).errors));
});
test('discovery: a vanished model is RETIRED? then RETIRED; a failure keeps the old cache as stale; refresh and the 24-hour lifetime work', async () => {
  const dir = tmp(); let t = Date.parse('2026-11-17T00:00:00Z'); const now = () => t;
  const two = JSON.parse(sample), one = { models: [two.models[0]] };
  await discover({ adapters: [codex], dataDir: dir, run: okRun(JSON.stringify(two)), home: dir, now });
  t += 1000; let r = await discover({ adapters: [codex], dataDir: dir, run: okRun(JSON.stringify(one)), home: dir, now, refresh: true });
  assert.deepEqual(r.removed, [{ provider: 'codex', model: 'codex-auto-review', status: 'RETIRED?' }]);
  t += 1000; r = await discover({ adapters: [codex], dataDir: dir, run: okRun(JSON.stringify(one)), home: dir, now, refresh: true });
  assert.equal(r.removed[0].status, 'RETIRED');
  const boom = async () => { throw new Error('nope'); };
  t += 1000; r = await discover({ adapters: [codex], dataDir: dir, run: boom, home: dir, now, refresh: true });
  assert.deepEqual(r.stale, ['codex']); assert.ok(r.profiles.length >= 1); assert.ok(r.problems.some((p) => p.code === 'DISCOVERY_FAILED'));
  assert.equal(JSON.parse(readFileSync(join(dir, 'catalogue', 'codex.json'), 'utf8')).stale, true);
  // a fresh cache is used without asking; an old one is refreshed
  const dir2 = tmp(); await discover({ adapters: [codex], dataDir: dir2, run: okRun(sample), home: dir2, now });
  let asked = 0; const counting = async (c, a) => { asked++; return okRun(sample)(c, a); };
  await discover({ adapters: [codex], dataDir: dir2, run: counting, home: dir2, now }); assert.equal(asked, 0);
  t += 25 * 3600 * 1000; await discover({ adapters: [codex], dataDir: dir2, run: counting, home: dir2, now }); assert.ok(asked > 0);
});
test('discovery: a cache file that cannot be read is reported and ignored; a failing first run writes no empty cache', async () => {
  const dir = tmp(); mkdirSync(join(dir, 'catalogue')); writeFileSync(join(dir, 'catalogue', 'codex.json'), '{not json');
  const r = await discover({ adapters: [codex], dataDir: dir, run: okRun(sample), home: dir });
  assert.ok(r.problems.some((p) => p.code === 'CACHE_UNREADABLE')); assert.equal(r.profiles.length, 2);
  const d2 = tmp(); await discover({ adapters: [codex], dataDir: d2, run: async () => { throw new Error('x'); }, home: d2 });
  assert.ok(!existsSync(join(d2, 'catalogue', 'codex.json')));
});
test('claude code discovery: aliases with a logged-in flag only when the status command says so', async () => {
  const dir = tmp();
  let r = await discover({ adapters: [claudeCode], dataDir: dir, run: async () => ({ stdout: '{"loggedIn":true}' }), home: dir });
  assert.equal(r.profiles.length, 4); assert.ok(r.profiles.every((p) => p.availability === 'AVAILABLE'));
  assert.equal(r.profiles.find((p) => p.providerModelId === 'fable').capabilityTier, 4);
  r = await discover({ adapters: [claudeCode], dataDir: tmp(), run: async () => { throw new Error('x'); }, home: dir });
  assert.ok(r.profiles.every((p) => p.availability === 'UNKNOWN'));
});
test('the registry lists five adapters, two verified, and every unverified capability is UNKNOWN', () => {
  const a = listAdapters(); assert.equal(a.length, 8); assert.equal(a.filter((x) => x.verified).length, 2);
  for (const u of a.filter((x) => !x.verified && x.id !== 'ollama')) assert.ok(Object.values(u.supports).every((v) => v === 'UNKNOWN'));
  assert.deepEqual(a.map((x) => x.id).sort(), ['claude-code', 'codex', 'copilot-cli', 'deepseek', 'gemini-cli', 'grok-build', 'kimi-cli', 'ollama']);
});
test('the simulator scenarios run and every expectation holds', async () => {
  for (const f of ['smoke.json', 'discovery-changes.json']) { const r = await runScenario(join(root, 'engine/sim/scenarios', f)); assert.ok(r.assertions.length >= 2); for (const x of r.assertions) assert.ok(x.ok, `${f}: ${x.detail}`); }
});
test('the new schemas catch mistakes: a bad autopilot state, a bad version, a hook without a command', () => {
  const ap = JSON.parse(readFileSync(join(root, 'tests/fixtures/autopilot.sample.json'), 'utf8'));
  assert.ok(validate(schemaOf('schemas/autopilot.schema.json'), ap).ok);
  assert.ok(!validate(schemaOf('schemas/autopilot.schema.json'), { ...ap, state: 'PAUSED' }).ok);
  const { schema, ...noSchema } = ap; assert.ok(!validate(schemaOf('schemas/autopilot.schema.json'), noSchema).ok);
  assert.ok(!validate(schemaOf('schemas/plugin-manifest.schema.json'), { name: 'x', version: 'one', description: 'd' }).ok);
  assert.ok(!validate(schemaOf('schemas/hooks.schema.json'), { hooks: { SessionStart: [{ hooks: [{ type: 'command' }] }] } }).ok);
});

// ---- Fixes after the independent review of 0b ----
test('a cache with the wrong shape is reported and ignored, never a crash; a future date is not "fresh"', async () => {
  for (const bad of ['{}', '[]', '{"fetchedAt":"2026-11-17T00:00:00Z","ttlHours":24,"stale":false}', '{"fetchedAt":"2026-11-17T00:00:00Z","ttlHours":24,"stale":false,"profiles":[null]}']) {
    const dir = tmp(); mkdirSync(join(dir, 'catalogue')); writeFileSync(join(dir, 'catalogue', 'codex.json'), bad);
    const r = await discover({ adapters: [codex], dataDir: dir, run: async () => { throw new Error('x'); }, home: dir });
    assert.ok(r.problems.some((p) => p.code === 'CACHE_UNREADABLE'), bad);
  }
  const dir = tmp(); mkdirSync(join(dir, 'catalogue')); writeFileSync(join(dir, 'catalogue', 'codex.json'), '{"fetchedAt":"2099-01-01T00:00:00Z","ttlHours":24,"stale":false,"profiles":[]}');
  const r = await discover({ adapters: [codex], dataDir: dir, run: okRun(sample), home: dir }); assert.equal(r.profiles.length, 2);
});
test('codex: odd entries are dropped; a "not logged in" text is not a login', async () => {
  const dir = tmp(); const messy = JSON.stringify([null, 'x', { slug: 5 }, { slug: '' }, { slug: 'good' }, { slug: 'good' }, { nope: 1 }]);
  const r = await discover({ adapters: [codex], dataDir: dir, run: okRun(messy), home: dir });
  assert.deepEqual(r.profiles.map((p) => p.providerModelId), ['good']);
  const run = async (c, a) => (c === 'codex' && a[0] === 'login' ? { stdout: 'Not logged in' } : okRun(sample)(c, a));
  const r2 = await discover({ adapters: [codex], dataDir: tmp(), run, home: dir });
  assert.ok(r2.profiles.every((p) => p.availability === 'UNKNOWN'));
});
test('an older fallback file never retires a model; a retired model no longer says it is available; events are written', async () => {
  const dir = tmp(); const ev = join(dir, 'ev'); let t = Date.parse('2026-11-17T00:00:00Z'); const now = () => t;
  const two = JSON.parse(sample), one = { models: [two.models[0]] };
  await discover({ adapters: [codex], dataDir: dir, run: okRun(JSON.stringify(two)), home: dir, now, eventDir: ev });
  // live command fails; an older cache file in the home folder lacks the hidden model
  const home = tmp(); mkdirSync(join(home, '.codex')); writeFileSync(join(home, '.codex', 'models_cache.json'), JSON.stringify(one));
  const failLive = async (c, a) => { if (c === 'codex' && a[0] === 'debug') throw new Error('x'); return { stdout: 'Logged in' }; };
  t += 1000; let r = await discover({ adapters: [codex], dataDir: dir, run: failLive, home, now, refresh: true, eventDir: ev });
  assert.deepEqual(r.removed, []); assert.ok(r.problems.some((p) => p.code === 'NOT_LIVE_SOURCE'));
  t += 1000; r = await discover({ adapters: [codex], dataDir: dir, run: okRun(JSON.stringify(one)), home: dir, now, refresh: true, eventDir: ev });
  const gone = r.profiles.find((p) => p.providerModelId === 'codex-auto-review');
  assert.equal(gone.lifecycleStatus, 'RETIRED?'); assert.equal(gone.availability, 'UNKNOWN'); assert.ok(!('availability' in gone.provenance));
  const lines = readFileSync(join(ev, '2026-11-17.jsonl'), 'utf8');
  assert.ok(lines.includes('DISCOVERY_COMPLETED') && lines.includes('MODEL_RETIRED_CANDIDATE'));
});

test('odd Codex values never make a saved list that fails its own schema', async () => {
  const dir = tmp(); const odd = JSON.stringify({ models: [{ slug: 'a', context_window: 272000.5, visibility: 'list' }, { slug: 'b', default_reasoning_level: 3, supported_reasoning_levels: [1], visibility: 'list' }] });
  const r = await discover({ adapters: [codex], dataDir: dir, run: okRun(odd), home: dir });
  assert.equal(r.profiles.length, 2); assert.ok(r.profiles.every((p) => p.contextWindow === 'UNKNOWN' && p.defaultReasoning === 'UNKNOWN'));
  const again = await discover({ adapters: [codex], dataDir: dir, run: async () => { throw new Error('should not be asked: the cache is fresh'); }, home: dir });
  assert.equal(again.problems.length, 0); assert.equal(again.profiles.length, 2);
});
test('a profile that fails its schema is reported and not saved', async () => {
  const bad = { id: 'bad', provider: 'p', verified: false, supports: {}, async discoverModels() { return { models: [{ id: 'x', facts: {} }] }; }, normaliseProfile() { return { provider: 'p' }; }, classifyError() { return null; } };
  const r = await discover({ adapters: [bad], dataDir: tmp(), run: async () => ({}), home: tmp() });
  assert.ok(r.problems.some((p) => p.code === 'PROFILE_INVALID')); assert.equal(r.profiles.length, 0);
});

test('ollama adapter: lists local models as free, guesses their tier, treats -cloud models as unpriced; absent is a clean failure', async () => {
  const { ollama } = await import('../adapters/ollama.mjs');
  const run = async () => ({ stdout: 'NAME ID SIZE MODIFIED\nqwen2.5-coder:32b a 19GB now\ngpt-oss:120b-cloud b - now\n' });
  const r = await discover({ adapters: [ollama], dataDir: tmp(), run, home: tmp() });
  const q = r.profiles.find((p) => p.providerModelId === 'qwen2.5-coder:32b'), c = r.profiles.find((p) => p.providerModelId.endsWith('-cloud'));
  assert.equal(q.monetaryCost, 0); assert.equal(q.capabilityTier, 2); assert.equal(c.monetaryCost, 'UNKNOWN');
  const none = await discover({ adapters: [ollama], dataDir: tmp(), run: async () => { throw new Error('x'); }, home: tmp() });
  assert.ok(none.problems.some((p) => p.code === 'DISCOVERY_FAILED'));
});

import { checkProjectDocs, checkApiDocs } from '../lib/projectdocs.mjs';
test('project documents check: finds missing sections; api check wants a Swagger UI beside an OpenAPI file', () => {
  const p = tmp(); assert.equal(checkProjectDocs(p).findings[0].code, 'NO_PROJECT_DOC');
  mkdirSync(join(p, '.dev-team')); writeFileSync(join(p, '.dev-team', 'PROJECT.md'), '# X\n## Goal\nx\n## Stage plan\n1\n## Current status  ← keep\nok\n');
  const miss = checkProjectDocs(p).findings.map((f) => f.message).join(' '); assert.ok(miss.includes('Definition of done') && miss.includes('Requirements and prerequisites') && !miss.includes('"Goal"'));
  const a = tmp(); assert.equal(checkApiDocs(a).hasOpenApi, false); assert.deepEqual(checkApiDocs(a).findings, []);
  writeFileSync(join(a, 'openapi.yaml'), 'openapi: 3.0.0\n'); assert.equal(checkApiDocs(a).findings[0].code, 'NO_SWAGGER_UI');
  mkdirSync(join(a, 'swagger-ui')); writeFileSync(join(a, 'swagger-ui', 'index.html'), '<html>'); assert.deepEqual(checkApiDocs(a).findings, []);
});
