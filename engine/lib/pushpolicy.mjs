// @ts-check
// File:    engine/lib/pushpolicy.mjs
// Purpose: Decides whether the plugin may push after a task. The default is NO: it never pushes on its own. Only when
//          the owner turns `git.push-after-task` on may it push, and then only the RUN branch (never the default branch,
//          never a force), only a commit a checker has cleared, and only with the agent confident and a deterministic
//          check passed (the REQUIRE_HIGH_CONFIDENCE level). The Bash guard hook stays as a separate safety net.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseYamlChecked } from './config.mjs';
import { gateCheck } from './gates.mjs';

/** Is git.push-after-task on in the project's .dev-team/config.yml? Anything that is not a clear on is off. */
export function pushAfterTaskSetting(projectDir) {
  const p = join(projectDir, '.dev-team', 'config.yml');
  if (!existsSync(p)) return { on: false, reason: 'no .dev-team/config.yml, so the built-in default (off) applies' };
  let parsed; try { parsed = parseYamlChecked(readFileSync(p, 'utf8')); } catch { return { on: false, reason: 'the config file could not be read, so the cautious value (off) applies' }; }
  if (parsed.problems.some((x) => x.path === 'git' || x.path.startsWith('git.'))) return { on: false, reason: 'a git setting is ambiguous, so the cautious value (off) applies' };
  const v = parsed.value.git?.['push-after-task'];
  return v === true ? { on: true, reason: 'git.push-after-task is on' } : { on: false, reason: v === undefined ? 'git.push-after-task is not set (off)' : 'git.push-after-task is not a clear "on" (off)' };
}

const DEFAULTS = new Set(['main', 'master']);
/**
 * @param {{projectDir: string, branch: string, defaultBranch?: string, checkerCleared: boolean, confident?: boolean, deterministicPass?: boolean, force?: boolean}} i
 */
export function pushPolicy(i) {
  const s = pushAfterTaskSetting(i.projectDir);
  const refuse = (why) => ({ allowed: false, reason: why, setting: s });
  if (typeof i.branch !== 'string' || i.branch.trim() === '' || /[\s~^:?*\[\\]/.test(i.branch) || i.branch.startsWith('-') || i.branch.includes('..')) throw new RangeError('branch must be a plain branch name');
  const b = i.branch.trim();
  const short = b.replace(/^refs\/heads\//i, '').toLowerCase(); // refs/heads/main is main
  if (i.force === true) return refuse('A forced push is never allowed.');
  if (DEFAULTS.has(short) || (i.defaultBranch && short === String(i.defaultBranch).replace(/^refs\/heads\//i, '').toLowerCase())) return refuse('The default branch is never pushed to by the plugin.');
  if (!s.on) return refuse(`Not pushing: ${s.reason}.`);
  if (i.checkerCleared !== true) return refuse('Not pushing: no checker has cleared this commit.');
  const g = gateCheck('PUSH_RUN_BRANCH', { confident: i.confident === true, deterministicPass: i.deterministicPass === true });
  if (!g.allowed) return refuse(`Not pushing: ${g.needs.join(' and ')} is needed first.`);
  return { allowed: true, reason: `Push the run branch ${b} only.`, setting: s };
}
