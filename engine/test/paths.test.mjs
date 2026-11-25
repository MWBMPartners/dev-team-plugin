import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { projectKey } from '../lib/paths.mjs';

const g = (cwd, ...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd, stdio: 'pipe' });
function repo() { const d = mkdtempSync(join(tmpdir(), 'dt-paths-')); g(d, 'init', '-q'); g(d, 'commit', '-q', '--allow-empty', '-m', 'one'); return d; }
test('a worktree gives the same key as its main checkout', () => {
  const a = repo(), w = join(mkdtempSync(join(tmpdir(), 'dt-wt-')), 'w'); g(a, 'worktree', 'add', '-q', w, '-b', 'x');
  assert.equal(projectKey(a), projectKey(w));
});
test('different repositories give different keys', () => { assert.notEqual(projectKey(repo()), projectKey(repo())); });
