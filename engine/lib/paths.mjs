// @ts-check
// File:    engine/lib/paths.mjs
// Purpose: Where things are: the plugin, the project being worked on, and the engine's own
//          machine-local folder. Machine-local state never goes inside a project.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { dirname, join, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export class BadInput extends Error {}

/** The plugin's own folder (set by the launcher; worked out from this file's place otherwise). */
export function pluginRoot() {
  return process.env.DEV_TEAM_PLUGIN_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

/** The engine's machine-local data folder, as the launcher decided. Refuses if there is none. */
export function dataDir() {
  const d = process.env.DEV_TEAM_DATA_DIR_RESOLVED ?? process.env.CLAUDE_PLUGIN_DATA ?? process.env.DEV_TEAM_DATA_DIR;
  if (!d) throw new BadInput('no data folder: run the engine through scripts/engine.sh, or set DEV_TEAM_DATA_DIR');
  return d;
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

/** The top folder of the repository holding `cwd`. */
export function repoRoot(cwd = process.cwd()) {
  try { return git(['rev-parse', '--show-toplevel'], cwd); } catch { throw new BadInput('not inside a git repository'); }
}

/**
 * A short, stable name for a project: the same for every worktree of one repository, and for a clone
 * of the same history, and it reveals nothing about the path or the owner.
 */
export function projectKey(root) {
  const common = git(['rev-parse', '--git-common-dir'], root);
  const abs = realpathSync(isAbsolute(common) ? common : resolve(root, common));
  let firstCommit = '';
  try { firstCommit = git(['rev-list', '--max-parents=0', 'HEAD'], root).split('\n')[0]; } catch { /* no commits yet */ }
  return createHash('sha256').update(`${abs}|${firstCommit}`).digest('hex').slice(0, 16);
}

/** The machine-local folder for one project. */
export function projectDataDir(root) { return join(dataDir(), 'projects', projectKey(root)); }
