// @ts-check
// File:    engine/lib/doctor.mjs
// Purpose: A read-only health check: which tools are here, where the engine keeps its files, and
//          what the plugin will do without the pieces that are missing. It never reads or prints
//          account details; for Codex it only says whether a login exists.
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { accessSync, constants, mkdirSync } from 'node:fs';
import { dataDir } from './paths.mjs';

const execFile = promisify(execFileCb);

/** Ask a program for its version. `run` is replaceable so tests never need the real programs. */
async function probe(run, cmd, args) {
  try { const { stdout } = await run(cmd, args, { timeout: 5000 }); return { present: true, version: String(stdout).split('\n')[0].trim() }; }
  catch { return { present: false, version: null }; }
}

/** @param {{run?: Function}} [opts] */
export async function runDoctor(opts = {}) {
  const run = opts.run ?? execFile;
  const tools = {};
  for (const [name, args] of [['git', ['--version']], ['jq', ['--version']], ['gh', ['--version']], ['bats', ['--version']],
    ['claude', ['--version']], ['codex', ['--version']], ['ollama', ['--version']]]) tools[name] = await probe(run, name, args);

  let codexLoggedIn = false;
  if (tools.codex.present) {
    try { await run('codex', ['login', 'status'], { timeout: 5000 }); codexLoggedIn = true; } catch { codexLoggedIn = false; }
  }
  let dir = null, writable = false;
  try { dir = dataDir(); mkdirSync(dir, { recursive: true }); accessSync(dir, constants.W_OK); writable = true; } catch { /* reported below */ }

  const fallbacks = [];
  if (!tools.codex.present) fallbacks.push('Codex is not installed: independent review falls back to a fresh Claude reviewer, and the work is "not fully reviewed".');
  else if (!codexLoggedIn) fallbacks.push('Codex is installed but not logged in: treat it as unavailable.');
  if (!tools.ollama.present) fallbacks.push('Ollama is not installed: local models are unavailable, so work starts on cloud models.');
  if (!tools.jq.present) fallbacks.push('jq is missing: the Bash guard can only scan the raw hook input as plain text.');
  if (!writable) fallbacks.push('The engine data folder is not writable: learning, leases and snapshots are unavailable.');

  return {
    node: process.version,
    dataDir: dir,
    dataDirIsFallback: process.env.DEV_TEAM_DATA_DIR_IS_FALLBACK === '1',
    dataDirWritable: writable,
    tools,
    codexLoggedIn,
    fallbacks,
  };
}
