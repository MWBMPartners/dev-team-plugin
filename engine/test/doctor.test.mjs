import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDoctor } from '../lib/doctor.mjs';
import { validate, loadSchema } from '../lib/schema.mjs';
import { pluginRoot } from '../lib/paths.mjs';

process.env.DEV_TEAM_DATA_DIR_RESOLVED = mkdtempSync(join(tmpdir(), 'dt-doc-'));
const fake = (present) => async (cmd) => { if (!present.includes(cmd)) throw new Error('nope'); return { stdout: `${cmd} 1.0\n` }; };

test('Codex present and logged in', async () => {
  const r = await runDoctor({ run: fake(['git', 'jq', 'codex']) });
  assert.equal(r.codexLoggedIn, true); assert.ok(!r.fallbacks.some((f) => f.includes('Codex')));
});
test('Codex absent gives the Claude-only fallback note; Ollama absent says so', async () => {
  const r = await runDoctor({ run: fake(['git']) });
  assert.ok(r.fallbacks.some((f) => f.includes('Codex is not installed'))); assert.ok(r.fallbacks.some((f) => f.includes('Ollama')));
});
test('the result matches its schema', async () => {
  const r = await runDoctor({ run: async () => ({ stdout: 'sk_live_abcdefgh12345678 should never be echoed beyond the version line' }) });
  assert.ok(validate(loadSchema(join(pluginRoot(), 'schemas/engine/doctor.output.schema.json')), r).ok);
});
